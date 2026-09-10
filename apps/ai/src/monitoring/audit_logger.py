"""
ZYRA AI Gateway — Audit Logger
Records all significant events for compliance and debugging.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("zyra.audit")


@dataclass
class AuditEntry:
    """A single audit log entry."""
    id: str
    tenant_id: str
    action: str
    actor_type: str  # "user", "agent", "system"
    actor_id: str
    resource_type: str
    resource_id: str | None = None
    changes: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "action": self.action,
            "actor_type": self.actor_type,
            "actor_id": self.actor_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "changes": self.changes,
            "metadata": self.metadata,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at,
        }


class AuditLogger:
    """
    Centralized audit logging for ZYRA.
    Logs to in-memory list + PostgreSQL audit_log table.
    """

    def __init__(self):
        self._entries: list[AuditEntry] = []

    def log(
        self,
        tenant_id: str,
        action: str,
        actor_type: str,
        actor_id: str,
        resource_type: str,
        resource_id: str | None = None,
        changes: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditEntry:
        """Create and store an audit entry."""
        entry = AuditEntry(
            id=uuid.uuid4().hex,
            tenant_id=tenant_id,
            action=action,
            actor_type=actor_type,
            actor_id=actor_id,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes or {},
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        self._entries.append(entry)
        logger.info(
            "audit action=%s actor=%s:%s resource=%s:%s tenant=%s",
            action, actor_type, actor_id, resource_type, resource_id, tenant_id,
        )

        # Persist to DB
        self._persist(entry)
        return entry

    def _persist(self, entry: AuditEntry) -> None:
        """Persist audit entry to database."""
        try:
            import json
            import psycopg2.extras
            from main import _execute_returning

            sql = """
                INSERT INTO "audit_log"
                    ("id", "tenantId", "action", "actorType", "actorId",
                     "resourceType", "resourceId", "changes", "metadata",
                     "ipAddress", "userAgent", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT ("id") DO NOTHING
            """
            _execute_returning(sql, (
                entry.id,
                entry.tenant_id,
                entry.action,
                entry.actor_type,
                entry.actor_id,
                entry.resource_type,
                entry.resource_id,
                psycopg2.extras.Json(entry.changes) if entry.changes else None,
                psycopg2.extras.Json(entry.metadata) if entry.metadata else None,
                entry.ip_address,
                entry.user_agent,
            ))
        except Exception as exc:
            logger.debug("audit DB persist skipped: %s", exc)

    # ── Convenience methods ────────────────────────────────────────────────────

    def log_approval_created(self, tenant_id: str, user_id: str, approval_id: str) -> AuditEntry:
        return self.log(
            tenant_id=tenant_id,
            action="approval.created",
            actor_type="user",
            actor_id=user_id,
            resource_type="approval",
            resource_id=approval_id,
        )

    def log_approval_decided(
        self, tenant_id: str, user_id: str, approval_id: str, decision: str
    ) -> AuditEntry:
        return self.log(
            tenant_id=tenant_id,
            action=f"approval.{decision}",
            actor_type="user",
            actor_id=user_id,
            resource_type="approval",
            resource_id=approval_id,
            changes={"decision": decision},
        )

    def log_agent_run(
        self, tenant_id: str, agent_role: str, run_id: str, model: str, tokens: int
    ) -> AuditEntry:
        return self.log(
            tenant_id=tenant_id,
            action="agent.run",
            actor_type="agent",
            actor_id=agent_role,
            resource_type="agent_run",
            resource_id=run_id,
            metadata={"model": model, "total_tokens": tokens},
        )

    def log_order_status_change(
        self, tenant_id: str, user_id: str, order_id: str, old_status: str, new_status: str
    ) -> AuditEntry:
        return self.log(
            tenant_id=tenant_id,
            action="order.status_changed",
            actor_type="user",
            actor_id=user_id,
            resource_type="order",
            resource_id=order_id,
            changes={"old_status": old_status, "new_status": new_status},
        )

    def log_product_change(
        self, tenant_id: str, user_id: str, product_id: str, action: str, changes: dict
    ) -> AuditEntry:
        return self.log(
            tenant_id=tenant_id,
            action=f"product.{action}",
            actor_type="user",
            actor_id=user_id,
            resource_type="product",
            resource_id=product_id,
            changes=changes,
        )

    def query(
        self,
        tenant_id: str,
        action: str | None = None,
        resource_type: str | None = None,
        limit: int = 50,
    ) -> list[AuditEntry]:
        """Query audit entries."""
        entries = [e for e in self._entries if e.tenant_id == tenant_id]
        if action:
            entries = [e for e in entries if e.action == action]
        if resource_type:
            entries = [e for e in entries if e.resource_type == resource_type]
        return sorted(entries, key=lambda e: e.created_at, reverse=True)[:limit]


# Global singleton
_audit_logger: AuditLogger | None = None


def get_audit_logger() -> AuditLogger:
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger
