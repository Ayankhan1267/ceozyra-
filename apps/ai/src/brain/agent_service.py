"""
ZYRA Business Brain — Agent Service
CRUD for Agent, AgentRun, and AgentTask records.
"""

from __future__ import annotations

import logging
from typing import Any

import psycopg2.extras

logger = logging.getLogger("zyra.brain.agent")


# ── deferred DB helpers (avoids circular with main.py) ────────────────────────

def _query_one(sql, params):
    from main import get_conn
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
                if row:
                    cols = [d[0] for d in cur.description]
                    return dict(zip(cols, row))
                return None
    except Exception as exc:
        logger.error("query_one failed: %s", exc)
        return None


def _query_all(sql, params):
    from main import get_conn
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
                if rows:
                    cols = [d[0] for d in cur.description]
                    return [dict(zip(cols, r)) for r in rows]
                return []
    except Exception as exc:
        logger.error("query_all failed: %s", exc)
        return []

# ── table metadata ───────────────────────────────────────────────────────────

AGENT_COLUMNS = (
    "id", "tenantId", "name", "description", "type", "agentType",
    "config", "autonomyLevel", "isActive", "createdAt", "updatedAt",
)
RUN_COLUMNS = (
    "id", "agentId", "agentType", "tenantId", "userId", "input",
    "output", "context", "status", "error", "startedAt", "completedAt",
    "createdAt", "updatedAt",
)
TASK_COLUMNS = (
    "id", "tenantId", "agentId", "assignedTo", "title", "description",
    "priority", "status", "input", "output", "deadline", "completedAt",
    "createdAt", "updatedAt",
)

T_AGENT = "agents"
T_RUN = "agent_runs"
T_TASK = "agent_tasks"

JSON_COLS_AGENT = {"config"}
JSON_COLS_RUN = {"input", "output", "context"}
JSON_COLS_TASK = {"input", "output"}


# ── shared helpers ───────────────────────────────────────────────────────────

def _execute_returning(sql: str, params: tuple) -> dict | None:
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
                conn.commit()
                if row:
                    cols = [d[0] for d in cur.description]
                    return dict(zip(cols, row))
            return None
    except Exception as exc:
        logger.error("execute_returning failed: %s", exc)
        return None


def _build_json(val: Any) -> Any:
    if val is not None:
        return psycopg2.extras.Json(val)
    return None


# ── Agent Service ────────────────────────────────────────────────────────────

class AgentService:

    # ── Agent CRUD ────────────────────────────────────────────────────────────

    @staticmethod
    def create_agent(
        tenant_id: str,
        name: str,
        description: str | None = None,
        agent_type: str = "general",
        config: dict | None = None,
        autonomy_level: int = 1,
    ) -> dict | None:
        sql = f"""
            INSERT INTO "{T_AGENT}"
                (tenantId, name, description, type, agentType, config, autonomyLevel)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING {", ".join(f'"{c}"' for c in AGENT_COLUMNS)}
        """
        return _execute_returning(sql, (
            tenant_id, name, description, agent_type, agent_type,
            _build_json(config), autonomy_level,
        ))

    @staticmethod
    def get_agent_by_id(agent_id: str, tenant_id: str) -> dict | None:
        sql = f"""
            SELECT {", ".join(f'"{c}"' for c in AGENT_COLUMNS)}
            FROM "{T_AGENT}"
            WHERE id = %s AND tenantId = %s
        """
        return _query_one(sql, (agent_id, tenant_id))

    @staticmethod
    def list_agents(tenant_id: str) -> list[dict]:
        sql = f"""
            SELECT {", ".join(f'"{c}"' for c in AGENT_COLUMNS)}
            FROM "{T_AGENT}"
            WHERE tenantId = %s
            ORDER BY "createdAt" DESC
        """
        return _query_all(sql, (tenant_id,))

    @staticmethod
    def update_agent(agent_id: str, tenant_id: str, **updates) -> dict | None:
        if not updates:
            return AgentService.get_agent_by_id(agent_id, tenant_id)

        allowed = {"name", "description", "type", "agentType", "config", "autonomyLevel", "isActive"}
        set_parts: list[str] = []
        params: list[Any] = []

        for key, value in updates.items():
            if key not in allowed:
                continue
            set_parts.append(f'"{key}" = %s')
            if key in JSON_COLS_AGENT and value is not None:
                params.append(_build_json(value))
            else:
                params.append(value)

        if not set_parts:
            return AgentService.get_agent_by_id(agent_id, tenant_id)

        sql = f"""
            UPDATE "{T_AGENT}"
            SET {", ".join(set_parts)}, "updatedAt" = NOW()
            WHERE id = %s AND tenantId = %s
            RETURNING {", ".join(f'"{c}"' for c in AGENT_COLUMNS)}
        """
        params.extend([agent_id, tenant_id])
        return _execute_returning(sql, tuple(params))

    # ── AgentRun CRUD ─────────────────────────────────────────────────────────

    @staticmethod
    def create_run(
        tenant_id: str,
        agent_id: str | None,
        agent_type: str | None,
        user_id: str | None,
        input_data: dict,
    ) -> dict | None:
        sql = f"""
            INSERT INTO "{T_RUN}"
                (agentId, agentType, tenantId, userId, input, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING {", ".join(f'"{c}"' for c in RUN_COLUMNS)}
        """
        return _execute_returning(sql, (
            agent_id, agent_type, tenant_id, user_id,
            _build_json(input_data), "PENDING",
        ))

    @staticmethod
    def update_run(run_id: str, tenant_id: str, **updates) -> dict | None:
        cols_str = ", ".join('"' + c + '"' for c in RUN_COLUMNS)
        if not updates:
            return _query_one(
                f"SELECT {cols_str} FROM \"{T_RUN}\" WHERE id = %s AND tenantId = %s",
                (run_id, tenant_id),
            )

        allowed = {"status", "output", "context", "error", "startedAt", "completedAt"}
        set_parts: list[str] = []
        params: list[Any] = []

        for key, value in updates.items():
            if key not in allowed:
                continue
            col = key
            set_parts.append(f'"{col}" = %s')
            if key in JSON_COLS_RUN and value is not None:
                params.append(_build_json(value))
            else:
                params.append(value)

        if not set_parts:
            return _query_one(
                f"SELECT {cols_str} FROM \"{T_RUN}\" WHERE id = %s AND tenantId = %s",
                (run_id, tenant_id),
            )

        sql = f"""
            UPDATE "{T_RUN}"
            SET {", ".join(set_parts)}, "updatedAt" = NOW()
            WHERE id = %s AND tenantId = %s
            RETURNING {cols_str}
        """
        params.extend([run_id, tenant_id])
        return _execute_returning(sql, tuple(params))

    @staticmethod
    def list_runs(
        tenant_id: str,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = ['"tenantId" = %s']
        params: list[Any] = [tenant_id]

        if status:
            filters.append('"status" = %s')
            params.append(status)

        where_clause = " AND ".join(filters)

        count_sql = f'SELECT COUNT(*) AS cnt FROM "{T_RUN}" WHERE {where_clause}'
        list_sql = f"""
            SELECT {", ".join(f'"{c}"' for c in RUN_COLUMNS)}
            FROM "{T_RUN}"
            WHERE {where_clause}
            ORDER BY "createdAt" DESC
            LIMIT %s OFFSET %s
        """
        total_row = _query_one(count_sql, tuple(params))
        total = total_row["cnt"] if total_row else 0
        rows = _query_all(list_sql, tuple(params + [limit, offset]))
        return rows, total

    # ── AgentTask CRUD ────────────────────────────────────────────────────────

    @staticmethod
    def create_task(
        tenant_id: str,
        agent_id: str | None,
        assigned_to: str | None,
        title: str,
        description: str | None = None,
        priority: str = "MEDIUM",
        input_data: dict | None = None,
        deadline: str | None = None,
    ) -> dict | None:
        sql = f"""
            INSERT INTO "{T_TASK}"
                (tenantId, agentId, assignedTo, title, description, priority, input, deadline)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {", ".join(f'"{c}"' for c in TASK_COLUMNS)}
        """
        return _execute_returning(sql, (
            tenant_id, agent_id, assigned_to, title, description, priority,
            _build_json(input_data), deadline,
        ))

    @staticmethod
    def list_tasks(
        tenant_id: str,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = ['"tenantId" = %s']
        params: list[Any] = [tenant_id]

        if status:
            filters.append('"status" = %s')
            params.append(status)
        if priority:
            filters.append('"priority" = %s')
            params.append(priority)

        where_clause = " AND ".join(filters)

        count_sql = f'SELECT COUNT(*) AS cnt FROM "{T_TASK}" WHERE {where_clause}'
        list_sql = f"""
            SELECT {", ".join(f'"{c}"' for c in TASK_COLUMNS)}
            FROM "{T_TASK}"
            WHERE {where_clause}
            ORDER BY
                CASE "priority" WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END,
                "createdAt" DESC
            LIMIT %s OFFSET %s
        """
        total_row = _query_one(count_sql, tuple(params))
        total = total_row["cnt"] if total_row else 0
        rows = _query_all(list_sql, tuple(params + [limit, offset]))
        return rows, total

    @staticmethod
    def update_task(task_id: str, tenant_id: str, **updates) -> dict | None:
        cols_str = ", ".join('"' + c + '"' for c in TASK_COLUMNS)
        if not updates:
            return _query_one(
                f"SELECT {cols_str} FROM \"{T_TASK}\" WHERE id = %s AND tenantId = %s",
                (task_id, tenant_id),
            )

        allowed = {"title", "description", "priority", "status", "assignedTo", "input", "output", "deadline"}
        set_parts: list[str] = []
        params: list[Any] = []
        completed_at_sql = ""

        for key, value in updates.items():
            if key not in allowed:
                continue
            if key == "status":
                set_parts.append(f'"{key}" = %s')
                params.append(value)
                if value == "COMPLETED":
                    completed_at_sql = ', "completedAt" = NOW()'
                elif value in ("PENDING", "ASSIGNED"):
                    completed_at_sql = ', "completedAt" = NULL'
            else:
                col = key
                set_parts.append(f'"{col}" = %s')
                if key in JSON_COLS_TASK and value is not None:
                    params.append(_build_json(value))
                else:
                    params.append(value)

        if not set_parts:
            return _query_one(
                f"SELECT {cols_str} FROM \"{T_TASK}\" WHERE id = %s AND tenantId = %s",
                (task_id, tenant_id),
            )

        sql = f"""
            UPDATE "{T_TASK}"
            SET {", ".join(set_parts)}{completed_at_sql}, "updatedAt" = NOW()
            WHERE id = %s AND tenantId = %s
            RETURNING {cols_str}
        """
        params.extend([task_id, tenant_id])
        return _execute_returning(sql, tuple(params))
