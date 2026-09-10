"""
ZYRA AI Gateway — Tool Registry
Defines, validates, and executes AI agent tools with tenant scoping and audit logging.
"""

from __future__ import annotations

import functools
import inspect
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

logger = logging.getLogger("zyra.tools.registry")


# ── Tool Definition ────────────────────────────────────────────────────────────

@dataclass
class ToolDefinition:
    """Metadata for a registered tool."""
    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=dict)
    required: list[str] = field(default_factory=list)
    category: str = "general"
    tenant_scoped: bool = True
    requires_approval: bool = False
    handler: Callable[..., Any] | None = None


# ── Registry ───────────────────────────────────────────────────────────────────

class ToolRegistry:
    """
    Central registry for all ZYRA agent tools.
    Tools are registered once at startup and can be invoked by any agent.
    """

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._register_builtin_tools()

    def _register_builtin_tools(self) -> None:
        """Register ZYRA's built-in tools."""
        # get_business_overview
        self.register(ToolDefinition(
            name="get_business_overview",
            description="Get a high-level overview of the business: revenue, orders, customers, and key metrics.",
            parameters={
                "type": "object",
                "properties": {
                    "period": {"type": "string", "description": "Time period: today, week, month, quarter", "default": "month"},
                },
            },
            required=[],
            category="analytics",
        ))

        # get_sales_data
        self.register(ToolDefinition(
            name="get_sales_data",
            description="Get detailed sales data including top products, revenue trends, and conversion metrics.",
            parameters={
                "type": "object",
                "properties": {
                    "granularity": {"type": "string", "description": "Data granularity: daily, weekly, monthly", "default": "daily"},
                    "limit": {"type": "integer", "description": "Max number of results", "default": 50},
                },
            },
            required=[],
            category="analytics",
        ))

        # get_customer_insights
        self.register(ToolDefinition(
            name="get_customer_insights",
            description="Get customer analytics: acquisition channels, retention rates, top customers, segments.",
            parameters={
                "type": "object",
                "properties": {
                    "segment": {"type": "string", "description": "Customer segment filter", "default": "all"},
                },
            },
            required=[],
            category="crm",
        ))

        # get_inventory_status
        self.register(ToolDefinition(
            name="get_inventory_status",
            description="Get current inventory levels, low stock alerts, and stock movement history.",
            parameters={
                "type": "object",
                "properties": {
                    "low_stock_only": {"type": "boolean", "description": "Only return low stock items", "default": False},
                },
            },
            required=[],
            category="operations",
        ))

        # get_financial_summary
        self.register(ToolDefinition(
            name="get_financial_summary",
            description="Get financial summary: revenue, costs, margins, cash flow for a given period.",
            parameters={
                "type": "object",
                "properties": {
                    "period": {"type": "string", "description": "Time period", "default": "month"},
                    "include_projections": {"type": "boolean", "description": "Include forward projections", "default": False},
                },
            },
            required=[],
            category="finance",
        ))

        # search_memories
        self.register(ToolDefinition(
            name="search_memories",
            description="Search the business brain's memory for relevant facts, decisions, and preferences.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "memory_type": {"type": "string", "description": "Filter by memory type (FACT, PREFERENCE, GOAL, etc.)", "default": ""},
                    "limit": {"type": "integer", "description": "Max results", "default": 10},
                },
            },
            required=["query"],
            category="brain",
        ))

        # save_memory
        self.register(ToolDefinition(
            name="save_memory",
            description="Save a new memory to the business brain. Use this to record important facts, decisions, or learnings.",
            parameters={
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "The memory content"},
                    "memory_type": {"type": "string", "description": "Type: FACT, PREFERENCE, GOAL, DECISION, EVENT, LEARNING, POLICY, CONSTRAINT"},
                    "confidence": {"type": "number", "description": "Confidence score 0-100", "default": 80},
                },
            },
            required=["content", "memory_type"],
            category="brain",
            requires_approval=True,
        ))

        # create_approval
        self.register(ToolDefinition(
            name="create_approval",
            description="Create an approval request for actions that need human confirmation (price changes, campaigns, etc.).",
            parameters={
                "type": "object",
                "properties": {
                    "approval_type": {"type": "string", "description": "Type: CAMPAIGN, DISCOUNT, EXPENSE, PRODUCT, PRICE_CHANGE, ORDER_REFUND, etc."},
                    "title": {"type": "string", "description": "Approval title"},
                    "description": {"type": "string", "description": "Detailed description", "default": ""},
                    "risk": {"type": "string", "description": "Risk level: low, medium, high, critical", "default": "medium"},
                    "cost": {"type": "number", "description": "Estimated cost", "default": 0},
                },
            },
            required=["approval_type", "title"],
            category="approval",
            requires_approval=False,
        ))

        logger.info("Registered %d built-in tools", len(self._tools))

    def register(self, tool: ToolDefinition) -> None:
        """Register a tool definition."""
        self._tools[tool.name] = tool
        logger.debug("Tool registered: %s (%s)", tool.name, tool.category)

    def get(self, name: str) -> ToolDefinition | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def list_tools(
        self,
        category: str | None = None,
        tenant_scoped: bool | None = None,
    ) -> list[ToolDefinition]:
        """List tools, optionally filtered by category or tenant scope."""
        tools = list(self._tools.values())
        if category:
            tools = [t for t in tools if t.category == category]
        if tenant_scoped is not None:
            tools = [t for t in tools if t.tenant_scoped == tenant_scoped]
        return tools

    def list_categories(self) -> list[str]:
        """List all unique tool categories."""
        return sorted(set(t.category for t in self._tools.values()))

    def to_openai_schema(self) -> list[dict[str, Any]]:
        """Convert tools to OpenAI function calling schema format."""
        schema = []
        for tool in self._tools.values():
            entry: dict[str, Any] = {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            }
            schema.append(entry)
        return schema

    def to_anthropic_schema(self) -> list[dict[str, Any]]:
        """Convert tools to Anthropic tool use schema format."""
        schema = []
        for tool in self._tools.values():
            schema.append({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.parameters,
            })
        return schema

    def get_system_prompt_section(self) -> str:
        """Generate a text section describing available tools for system prompts."""
        lines = ["\nAVAILABLE TOOLS (use these to answer user queries):\n"]
        for category in self.list_categories():
            cat_tools = [t for t in self._tools.values() if t.category == category]
            lines.append(f"  [{category.upper()}]")
            for tool in cat_tools:
                lines.append(f"    - {tool.name}: {tool.description}")
                if tool.parameters.get("properties"):
                    props = tool.parameters["properties"]
                    for pname, pinfo in props.items():
                        req = " (required)" if pname in tool.required else ""
                        default = f" [default: {pinfo['default']}]" if "default" in pinfo else ""
                        lines.append(f"        {pname}: {pinfo.get('description', '')}{req}{default}")
            lines.append("")
        return "\n".join(lines)


# Global singleton
_tool_registry: ToolRegistry | None = None


def get_tool_registry() -> ToolRegistry:
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = ToolRegistry()
    return _tool_registry
