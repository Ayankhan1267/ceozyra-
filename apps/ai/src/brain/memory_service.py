"""
ZYRA Business Brain — Memory Service
CRUD and text-search for BusinessMemory records.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("zyra.brain.memory")

TABLE = "business_memories"

_COLUMNS = (
    "id", "tenantId", "type", "content", "source", "confidence",
    "entityType", "entityId", "metadata", "createdAt", "updatedAt",
)

_VALID_TYPES = {"FACT", "PREFERENCE", "GOAL", "DECISION", "EVENT", "LEARNING", "POLICY", "CONSTRAINT"}


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

class MemoryService:

    @staticmethod
    def create_memory(
        tenant_id: str,
        type: str,
        content: str,
        source: str | None = None,
        confidence: float | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict | None:
        import psycopg2.extras

        memory_type = type.upper()
        if memory_type not in _VALID_TYPES:
            raise ValueError(
                f"Invalid memory type '{type}'. Allowed: {sorted(_VALID_TYPES)}"
            )

        sql = f"""
            INSERT INTO "{TABLE}"
                (tenantId, type, content, source, confidence, "entityType", "entityId", metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {", ".join(f'"{c}"' for c in _COLUMNS)}
        """
        params = (
            tenant_id, memory_type, content, source, confidence,
            entity_type, entity_id,
            psycopg2.extras.Json(metadata) if metadata is not None else None,
        )
        record = _execute_returning(sql, params)
        if record:
            logger.info("memory created id=%s type=%s tenant=%s", record.get("id"), memory_type, tenant_id)
        return record

    @staticmethod
    def get_memory(memory_id: str, tenant_id: str) -> dict | None:
        sql = f"""
            SELECT {", ".join(f'"{c}"' for c in _COLUMNS)}
            FROM "{TABLE}"
            WHERE id = %s AND tenantId = %s
        """
        return _query_one(sql, (memory_id, tenant_id))

    @staticmethod
    def list_memories(
        tenant_id: str,
        type: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filters = ['tenantId = %s']
        params: list[Any] = [tenant_id]

        if type:
            filters.append("type = %s")
            params.append(type.upper())
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
            ORDER BY "createdAt" DESC
            LIMIT %s OFFSET %s
        """

        total_row = _query_one(count_sql, tuple(params))
        total = total_row["cnt"] if total_row else 0
        rows = _query_all(list_sql, tuple(params + [limit, offset]))
        return rows, total

    @staticmethod
    def update_memory(memory_id: str, tenant_id: str, **updates) -> dict | None:
        if not updates:
            return MemoryService.get_memory(memory_id, tenant_id)

        import psycopg2.extras

        allowed = {"content", "source", "confidence", "entityType", "entityId", "metadata"}
        set_parts: list[str] = []
        params: list[Any] = []

        col_map = {"entityType": "entityType", "entityId": "entityId"}

        for key, value in updates.items():
            if key not in allowed:
                continue
            col = col_map.get(key, key)
            set_parts.append(f'"{col}" = %s')
            if key == "metadata" and value is not None:
                params.append(psycopg2.extras.Json(value))
            else:
                params.append(value)

        if not set_parts:
            return MemoryService.get_memory(memory_id, tenant_id)

        sql = f"""
            UPDATE "{TABLE}"
            SET {", ".join(set_parts)}, "updatedAt" = NOW()
            WHERE id = %s AND tenantId = %s
            RETURNING {", ".join(f'"{c}"' for c in _COLUMNS)}
        """
        params.extend([memory_id, tenant_id])
        record = _execute_returning(sql, tuple(params))
        if record:
            logger.info("memory updated id=%s tenant=%s", memory_id, tenant_id)
        return record

    @staticmethod
    def delete_memory(memory_id: str, tenant_id: str) -> bool:
        from main import get_conn
        sql = f'DELETE FROM "{TABLE}" WHERE id = %s AND tenantId = %s'
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (memory_id, tenant_id))
                    conn.commit()
                    return cur.rowcount > 0
        except Exception as exc:
            logger.error("delete_memory %s failed: %s", memory_id, exc)
            return False

    @staticmethod
    def search_memories(
        tenant_id: str,
        query: str,
        type: str | None = None,
        limit: int = 10,
    ) -> list[dict]:
        filters = ["tenantId = %s", "content ILIKE %s"]
        params: list[Any] = [tenant_id, f"%{query}%"]

        if type:
            filters.append("type = %s")
            params.append(type.upper())

        where_clause = " AND ".join(filters)
        sql = f"""
            SELECT {", ".join(f'"{c}"' for c in _COLUMNS)}
            FROM "{TABLE}"
            WHERE {where_clause}
            ORDER BY confidence DESC NULLS LAST, "createdAt" DESC
            LIMIT %s
        """
        return _query_all(sql, tuple(params + [limit]))
