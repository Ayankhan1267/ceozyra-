"""
ZYRA Business Brain — Decision Service
CRUD for BusinessDecision records.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("zyra.brain.decision")

TABLE = "business_decisions"
_COLUMNS = (
    "id", "tenantId", "title", "description", "rationale", "options",
    "decidedValue", "impact", "confidence", "decidedBy", "decidedAt",
    "createdAt", "updatedAt",
)


# ── DB helpers (deferred imports to avoid circular with main.py) ─────────────

def _execute_returning(sql: str, params: tuple) -> dict | None:
    from main import get_conn
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


def _query_one(sql: str, params: tuple = ()) -> dict | None:
    from main import get_conn
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description] if cur.description else []
                row = cur.fetchone()
                if row is None:
                    return None
                return dict(zip(cols, row))
    except Exception:
        return None


def _query_all(sql: str, params: tuple = ()) -> list[dict]:
    from main import get_conn
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description] if cur.description else []
                rows = cur.fetchall()
                return [dict(zip(cols, row)) for row in rows]
    except Exception:
        return []


# ── Service ──────────────────────────────────────────────────────────────────

class DecisionService:

    @staticmethod
    def create_decision(
        tenant_id: str,
        title: str,
        description: str | None = None,
        rationale: str | None = None,
        options: list | dict | None = None,
        decided_value: dict | None = None,
        impact: str | None = None,
        confidence: float | None = None,
        decided_by: str | None = None,
    ) -> dict | None:
        import psycopg2.extras

        sql = f"""
            INSERT INTO "{TABLE}"
                (tenantId, title, description, rationale, options, "decidedValue", impact, confidence, "decidedBy")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {", ".join(f'"{c}"' for c in _COLUMNS)}
        """
        params = (
            tenant_id, title, description, rationale,
            psycopg2.extras.Json(options) if options is not None else None,
            psycopg2.extras.Json(decided_value) if decided_value is not None else None,
            impact, confidence, decided_by,
        )
        record = _execute_returning(sql, params)
        if record:
            logger.info("decision created id=%s title=%s tenant=%s", record.get("id"), title, tenant_id)
        return record

    @staticmethod
    def get_decision(decision_id: str, tenant_id: str) -> dict | None:
        sql = f"""
            SELECT {", ".join(f'"{c}"' for c in _COLUMNS)}
            FROM "{TABLE}"
            WHERE id = %s AND tenantId = %s
        """
        return _query_one(sql, (decision_id, tenant_id))

    @staticmethod
    def list_decisions(
        tenant_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        total_row = _query_one(
            f'SELECT COUNT(*) AS cnt FROM "{TABLE}" WHERE tenantId = %s',
            (tenant_id,),
        )
        total = total_row["cnt"] if total_row else 0
        cols_str = ", ".join('"' + c + '"' for c in _COLUMNS)
        rows = _query_all(
            f"SELECT {cols_str} FROM \"{TABLE}\" "
            f"WHERE tenantId = %s ORDER BY \"createdAt\" DESC LIMIT %s OFFSET %s",
            (tenant_id, limit, offset),
        )
        return rows, total

    @staticmethod
    def update_decision(decision_id: str, tenant_id: str, **updates) -> dict | None:
        if not updates:
            return DecisionService.get_decision(decision_id, tenant_id)

        import psycopg2.extras

        allowed = {"title", "description", "rationale", "options", "decidedValue", "impact", "confidence", "decidedBy"}
        json_keys = {"options", "decidedValue"}
        set_parts: list[str] = []
        params: list[Any] = []

        for key, value in updates.items():
            if key not in allowed:
                continue
            col = key
            set_parts.append(f'"{col}" = %s')
            if key in json_keys and value is not None:
                params.append(psycopg2.extras.Json(value))
            else:
                params.append(value)

        if not set_parts:
            return DecisionService.get_decision(decision_id, tenant_id)

        sql = f"""
            UPDATE "{TABLE}"
            SET {", ".join(set_parts)}, "updatedAt" = NOW()
            WHERE id = %s AND tenantId = %s
            RETURNING {", ".join(f'"{c}"' for c in _COLUMNS)}
        """
        params.extend([decision_id, tenant_id])
        record = _execute_returning(sql, tuple(params))
        if record:
            logger.info("decision updated id=%s tenant=%s", decision_id, tenant_id)
        return record
