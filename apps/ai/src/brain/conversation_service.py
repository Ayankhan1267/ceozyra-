"""
ZYRA AI Gateway — Conversation persistence service
Stores AI chat conversations and messages in PostgreSQL via raw SQL.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any

logger = logging.getLogger("zyra.brain.conversation")

_CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS ai_conversations (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    agent_role VARCHAR(50) NOT NULL DEFAULT 'general',
    title VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ai_messages (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_tenant ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id);
"""

_tables_created = False


def _ensure_tables():
    global _tables_created
    if _tables_created:
        return
    try:
        from main import get_conn
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLES_SQL)
            conn.commit()
        _tables_created = True
        logger.info("ai_conversations tables ensured")
    except Exception as exc:
        logger.error("Failed to create ai_conversations tables: %s", exc)


class ConversationService:
    """CRUD service for AI chat conversations and messages."""

    def __init__(self):
        _ensure_tables()

    # ── Conversations ─────────────────────────────────────────────────────

    def create_conversation(
        self,
        tenant_id: str,
        agent_role: str = "general",
        title: str | None = None,
    ) -> dict[str, Any]:
        conv_id = uuid.uuid4().hex
        try:
            from main import get_conn
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO ai_conversations (id, tenant_id, agent_role, title)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id, tenant_id, agent_role, title, created_at, updated_at
                        """,
                        (conv_id, tenant_id, agent_role, title),
                    )
                    row = cur.fetchone()
                    cols = [d[0] for d in cur.description]
                conn.commit()
            return dict(zip(cols, row))
        except Exception as exc:
            logger.error("create_conversation error: %s", exc)
            raise

    def get_conversation(
        self,
        conversation_id: str,
        tenant_id: str,
    ) -> dict[str, Any] | None:
        try:
            from main import _query_one
            return _query_one(
                'SELECT id, tenant_id, agent_role, title, created_at, updated_at '
                'FROM ai_conversations WHERE id = %s AND tenant_id = %s',
                (conversation_id, tenant_id),
            )
        except Exception as exc:
            logger.error("get_conversation error: %s", exc)
            return None

    def list_conversations(
        self,
        tenant_id: str,
        agent_role: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        try:
            from main import _query_all, _query_one
            where = 'WHERE tenant_id = %s'
            params: tuple = (tenant_id,)
            if agent_role:
                where += ' AND agent_role = %s'
                params += (agent_role,)

            total_row = _query_one(
                f'SELECT COUNT(*) AS cnt FROM ai_conversations {where}',
                params,
            )
            total = total_row["cnt"] if total_row else 0

            rows = _query_all(
                f'SELECT id, tenant_id, agent_role, title, created_at, updated_at '
                f'FROM ai_conversations {where} '
                f'ORDER BY updated_at DESC LIMIT %s OFFSET %s',
                params + (limit, offset),
            )
            return rows or [], total
        except Exception as exc:
            logger.error("list_conversations error: %s", exc)
            return [], 0

    def update_conversation_title(
        self,
        conversation_id: str,
        tenant_id: str,
        title: str,
    ) -> dict[str, Any] | None:
        try:
            from main import _query_one
            return _query_one(
                'UPDATE ai_conversations SET title = %s, updated_at = NOW() '
                'WHERE id = %s AND tenant_id = %s '
                'RETURNING id, tenant_id, agent_role, title, created_at, updated_at',
                (title, conversation_id, tenant_id),
            )
        except Exception as exc:
            logger.error("update_conversation_title error: %s", exc)
            return None

    def delete_conversation(
        self,
        conversation_id: str,
        tenant_id: str,
    ) -> bool:
        try:
            from main import _query_one
            row = _query_one(
                'DELETE FROM ai_conversations WHERE id = %s AND tenant_id = %s '
                'RETURNING id',
                (conversation_id, tenant_id),
            )
            return row is not None
        except Exception as exc:
            logger.error("delete_conversation error: %s", exc)
            return False

    # ── Messages ──────────────────────────────────────────────────────────

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        msg_id = uuid.uuid4().hex
        try:
            from main import get_conn
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO ai_messages (id, conversation_id, role, content, metadata)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, conversation_id, role, content, metadata, created_at
                        """,
                        (msg_id, conversation_id, role, content, metadata),
                    )
                    row = cur.fetchone()
                    cols = [d[0] for d in cur.description]
                conn.commit()
            result = dict(zip(cols, row))
            # Touch parent conversation updated_at
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE ai_conversations SET updated_at = NOW() WHERE id = %s',
                        (conversation_id,),
                    )
                conn.commit()
            return result
        except Exception as exc:
            logger.error("add_message error: %s", exc)
            raise

    def get_messages(
        self,
        conversation_id: str,
        tenant_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        try:
            from main import _query_all, _query_one
            # Verify conversation belongs to tenant
            conv = _query_one(
                'SELECT id FROM ai_conversations WHERE id = %s AND tenant_id = %s',
                (conversation_id, tenant_id),
            )
            if not conv:
                return [], 0

            total_row = _query_one(
                'SELECT COUNT(*) AS cnt FROM ai_messages WHERE conversation_id = %s',
                (conversation_id,),
            )
            total = total_row["cnt"] if total_row else 0

            rows = _query_all(
                'SELECT id, conversation_id, role, content, metadata, created_at '
                'FROM ai_messages WHERE conversation_id = %s '
                'ORDER BY created_at ASC LIMIT %s OFFSET %s',
                (conversation_id, limit, offset),
            )
            return rows or [], total
        except Exception as exc:
            logger.error("get_messages error: %s", exc)
            return [], 0
