"""
ZYRA Business Brain — Event Service
CRUD and listing for BusinessEvent records.
"""

from __future__ import annotations

import logging
from typing import Any

import psycopg2.extras

logger = logging.getLogger("zyra.brain.event")

TABLE = "business_events"
_COLUMNS = (
    "id", "tenantId", "type", "entityType", "entityId", "payload",
    "occurredAt", "createdAt",
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

class EventService:

    @staticmethod
    def log_event(
        tenant_id: str,
        event_type: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        payload: dict | None = None,
        occurred_at: str | None = None,
    ) -> dict | None:
        sql = f"""
            INSERT INTO "{TABLE}"
                (tenantId, type, "entityType", "entityId", payload, occurredAt)
            VALUES (%s, %s, %s, %s, %s, COALESCE(%s, NOW()))
            RETURNING {", ".join(f'"{c}"' for c in _COLUMNS)}
        """
        params = (
            tenant_id, event_type, entity_type, entity_id,
            psycopg2.extras.Json(payload) if payload is not None else None,
            occurred_at,
        )
        record = _execute_returning(sql, params)
        if record:
            logger.info("event logged id=%s type=%s tenant=%s", record.get("id"), event_type, tenant_id)
        return record

    @staticmethod
    def get_events(
        tenant_id: str,
        event_type: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = ['"tenantId" = %s']
        params: list[Any] = [tenant_id]

        if event_type:
            filters.append('"type" = %s')
            params.append(event_type)
        if entity_type:
            filters.append('"entityType" = %s')
            params.append(entity_type)
        if entity_id:
            filters.append('"entityId" = %s')
            params.append(entity_id)

        where_clause = " AND ".join(filters)

        count_sql = f'SELECT COUNT(*) AS cnt FROM "{TABLE}" WHERE {where_clause}'
        list_sql = f"""
            SELECT {", ".join(f'"{c}"' for c in _COLUMNS)}
            FROM "{TABLE}"
            WHERE {where_clause}
            ORDER BY "occurredAt" DESC, "createdAt" DESC
            LIMIT %s OFFSET %s
        """
        total_row = _query_one(count_sql, tuple(params))
        total = total_row["cnt"] if total_row else 0
        rows = _query_all(list_sql, tuple(params + [limit, offset]))
        return rows, total
