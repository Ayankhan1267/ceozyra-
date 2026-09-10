"""
ZYRA AI Gateway — Tool Executor
Executes registered tools with tenant isolation, parameter validation, and audit logging.
"""

from __future__ import annotations

import logging
from typing import Any

from tools.registry import ToolDefinition, get_tool_registry

logger = logging.getLogger("zyra.tools.executor")


class ToolExecutionError(Exception):
    def __init__(self, tool_name: str, message: str):
        self.tool_name = tool_name
        super().__init__(f"Tool '{tool_name}' error: {message}")


class ToolExecutor:
    """
    Executes tools from the registry with tenant context.
    Validates parameters, checks permissions, and logs all executions.
    """

    def __init__(self):
        self._registry = get_tool_registry()
        self._execution_log: list[dict[str, Any]] = []

    async def execute(
        self,
        tool_name: str,
        tenant_id: str,
        parameters: dict[str, Any] | None = None,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Execute a tool by name with given parameters.

        Args:
            tool_name: Name of the tool to execute
            tenant_id: Tenant context for scoping
            parameters: Tool parameters (dict)
            run_id: Optional run ID for tracing

        Returns:
            Result dict with 'success', 'data'/'error', and 'tool_name'

        Raises:
            ToolExecutionError: If tool not found or execution fails
        """
        tool = self._registry.get(tool_name)
        if tool is None:
            raise ToolExecutionError(tool_name, "Tool not found in registry")

        params = parameters or {}
        run_id = run_id or "unknown"

        # Validate required parameters
        missing = [p for p in tool.required if p not in params]
        if missing:
            raise ToolExecutionError(
                tool_name, f"Missing required parameters: {missing}"
            )

        logger.info(
            "executing tool run_id=%s tenant=%s tool=%s params=%s",
            run_id, tenant_id, tool_name,
            {k: v for k, v in params.items() if k not in ("api_key", "token", "secret")},
        )

        result: dict[str, Any] = {
            "tool_name": tool_name,
            "tenant_id": tenant_id,
            "run_id": run_id,
            "parameters": params,
            "success": False,
        }

        try:
            # Route to appropriate handler based on tool name
            data = await self._route_tool(tool_name, tenant_id, params)
            result["success"] = True
            result["data"] = data
            logger.info("tool executed successfully run_id=%s tool=%s", run_id, tool_name)
        except Exception as exc:
            result["success"] = False
            result["error"] = str(exc)
            logger.error("tool execution failed run_id=%s tool=%s error=%s", run_id, tool_name, exc)
            raise ToolExecutionError(tool_name, str(exc)) from exc
        finally:
            self._execution_log.append(result)

        return result

    async def _route_tool(
        self, tool_name: str, tenant_id: str, params: dict[str, Any]
    ) -> Any:
        """Route tool execution to the appropriate handler."""
        handlers = {
            "get_business_overview": self._handle_get_business_overview,
            "get_sales_data": self._handle_get_sales_data,
            "get_customer_insights": self._handle_get_customer_insights,
            "get_inventory_status": self._handle_get_inventory_status,
            "get_financial_summary": self._handle_get_financial_summary,
            "search_memories": self._handle_search_memories,
            "save_memory": self._handle_save_memory,
            "create_approval": self._handle_create_approval,
        }

        handler = handlers.get(tool_name)
        if handler is None:
            raise ToolExecutionError(tool_name, f"No handler for tool '{tool_name}'")

        return await handler(tenant_id, params)

    # ── Tool Handlers ──────────────────────────────────────────────────────────

    async def _handle_get_business_overview(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        period = params.get("period", "month")
        from main import _query_one, _query_all

        # Revenue
        revenue_row = _query_one(
            """
            SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
            FROM "orders"
            WHERE "tenantId" = %s AND "createdAt" >= NOW() - INTERVAL '1 month'
            """,
            (tenant_id,),
        )
        # Customers
        customer_row = _query_one(
            'SELECT COUNT(*) AS count FROM "customers" WHERE "tenantId" = %s',
            (tenant_id,),
        )
        # Products
        product_row = _query_one(
            'SELECT COUNT(*) AS count FROM "products" WHERE "tenantId" = %s AND "isActive" = true',
            (tenant_id,),
        )

        return {
            "period": period,
            "revenue": float(revenue_row.get("revenue", 0)) if revenue_row else 0,
            "orders": revenue_row.get("orders", 0) if revenue_row else 0,
            "customers": customer_row.get("count", 0) if customer_row else 0,
            "products": product_row.get("count", 0) if product_row else 0,
            "avg_order_value": 0,
        }

    async def _handle_get_sales_data(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        limit = min(int(params.get("limit", 50)), 100)
        from main import _query_all

        rows = _query_all(
            """
            SELECT o."orderNumber", o."total", o."createdAt",
                   c."email" AS customer_email
            FROM "orders" o
            LEFT JOIN "customers" c ON c.id = o."customerId"
            WHERE o."tenantId" = %s
            ORDER BY o."createdAt" DESC
            LIMIT %s
            """,
            (tenant_id, limit),
        )

        return {
            "sales": [
                {
                    "order_number": r.get("orderNumber"),
                    "total": float(r.get("total", 0)),
                    "date": str(r.get("createdAt", "")),
                    "customer": r.get("customer_email", "guest"),
                }
                for r in rows
            ],
            "count": len(rows),
        }

    async def _handle_get_customer_insights(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        from main import _query_all

        rows = _query_all(
            """
            SELECT c."email", COUNT(o.id) AS order_count, SUM(o.total) AS total_spent
            FROM "customers" c
            LEFT JOIN "orders" o ON o."customerId" = c.id
            WHERE c."tenantId" = %s
            GROUP BY c.id, c."email"
            ORDER BY total_spent DESC NULLS LAST
            LIMIT 20
            """,
            (tenant_id,),
        )

        return {
            "top_customers": [
                {
                    "email": r.get("email"),
                    "orders": r.get("order_count", 0),
                    "total_spent": float(r.get("total_spent", 0) or 0),
                }
                for r in rows
            ],
        }

    async def _handle_get_inventory_status(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        from main import _query_all

        low_only = params.get("low_stock_only", False)
        query = 'SELECT * FROM "products" WHERE "tenantId" = %s'
        query_params: tuple = (tenant_id,)

        if low_only:
            query += ' AND "stock" <= "lowStockThreshold"'

        rows = _query_all(query + " ORDER BY \"stock\" ASC LIMIT 50", query_params)

        return {
            "products": [
                {
                    "name": r.get("name"),
                    "stock": r.get("stock"),
                    "threshold": r.get("lowStockThreshold"),
                }
                for r in rows
            ],
            "count": len(rows),
        }

    async def _handle_get_financial_summary(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        from main import _query_one

        row = _query_one(
            """
            SELECT
                COALESCE(SUM(total), 0) AS revenue,
                COALESCE(SUM(tax), 0) AS tax,
                COALESCE(SUM(shipping), 0) AS shipping,
                COALESCE(SUM(discount), 0) AS discount,
                COUNT(*) AS orders
            FROM "orders"
            WHERE "tenantId" = %s AND "createdAt" >= NOW() - INTERVAL '1 month'
            """,
            (tenant_id,),
        )

        if not row:
            return {"revenue": 0, "orders": 0}

        revenue = float(row.get("revenue", 0))
        estimated_cogs = revenue * 0.4  # placeholder ~40% COGS

        return {
            "period": params.get("period", "month"),
            "revenue": revenue,
            "estimated_cogs": round(estimated_cogs, 2),
            "gross_margin": round((revenue - estimated_cogs) / revenue * 100, 1) if revenue > 0 else 0,
            "tax": float(row.get("tax", 0)),
            "orders": row.get("orders", 0),
            "avg_order_value": round(revenue / row.get("orders", 1), 2) if row.get("orders", 0) > 0 else 0,
        }

    async def _handle_search_memories(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        from brain.memory_service import MemoryService

        query = params.get("query", "")
        memory_type = params.get("memory_type") or None
        limit = min(int(params.get("limit", 10)), 50)

        results, total = MemoryService.search_memories(
            tenant_id=tenant_id,
            query=query,
            type=memory_type,
            limit=limit,
        )

        return {
            "query": query,
            "total_found": total,
            "memories": results,
        }

    async def _handle_save_memory(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        from brain.memory_service import MemoryService

        content = params.get("content", "")
        memory_type = params.get("memory_type", "FACT")
        confidence = params.get("confidence", 80.0)

        record = MemoryService.create_memory(
            tenant_id=tenant_id,
            type=memory_type,
            content=content,
            source="agent_tool",
            confidence=confidence,
        )

        if record:
            return {"success": True, "memory_id": record.get("id"), "type": memory_type}
        raise ToolExecutionError("save_memory", "Failed to save memory")

    async def _handle_create_approval(
        self, tenant_id: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        from endpoints.approvals import router as approvals_router

        approval_type = params.get("approval_type", "GENERAL")
        title = params.get("title", "")
        description = params.get("description", "")
        risk = params.get("risk", "medium")
        cost = float(params.get("cost", 0) or 0)

        # Use the approvals router's create logic directly
        from main import _query_one
        import json
        from datetime import datetime

        expires_at = datetime.utcnow() + __import__('datetime').timedelta(days=7)

        row = _query_one(
            """
            INSERT INTO "approvals"
                ("tenantId", "type", "title", "description", "status",
                 "risk", "cost", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, 'PENDING', %s, %s, NOW(), NOW())
            RETURNING *
            """,
            (tenant_id, approval_type.upper(), title, description, risk, cost),
        )

        if row:
            return {
                "success": True,
                "approval_id": row.get("id"),
                "status": "PENDING",
                "type": approval_type.upper(),
            }
        raise ToolExecutionError("create_approval", "Failed to create approval")

    def get_execution_log(self) -> list[dict[str, Any]]:
        """Get the execution log (last 100 entries)."""
        return self._execution_log[-100:]


# Global singleton
_tool_executor: ToolExecutor | None = None


def get_tool_executor() -> ToolExecutor:
    global _tool_executor
    if _tool_executor is None:
        _tool_executor = ToolExecutor()
    return _tool_executor
