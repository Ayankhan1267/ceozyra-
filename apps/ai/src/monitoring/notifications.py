"""
ZYRA AI Gateway — Notification Service
In-app notifications for approvals, agent alerts, and system events.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

logger = logging.getLogger("zyra.notifications.service")


class NotificationType(str, Enum):
    APPROVAL_PENDING = "approval_pending"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    AGENT_ALERT = "agent_alert"
    SYSTEM = "system"
    INSIGHT = "insight"
    ERROR = "error"


class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class Notification:
    """A single notification."""
    id: str
    tenant_id: str
    type: str
    priority: str
    title: str
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    read: bool = False
    read_at: str | None = None
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "type": self.type,
            "priority": self.priority,
            "title": self.title,
            "message": self.message,
            "data": self.data,
            "read": self.read,
            "read_at": self.read_at,
            "created_at": self.created_at,
        }


class NotificationService:
    """
    In-memory notification service with DB persistence.
    Stores notifications per tenant and supports filtering, marking read, etc.
    """

    def __init__(self):
        self._notifications: dict[str, list[Notification]] = {}  # tenant_id -> list

    def create(
        self,
        tenant_id: str,
        type: str,
        title: str,
        message: str,
        priority: str = "medium",
        data: dict[str, Any] | None = None,
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> Notification:
        """Create a new notification."""
        import uuid
        notification = Notification(
            id=uuid.uuid4().hex,
            tenant_id=tenant_id,
            type=type,
            priority=priority,
            title=title,
            message=message,
            data=data or {},
        )
        # Store reference info in notification data
        if ref_type:
            notification.data["ref_type"] = ref_type
        if ref_id:
            notification.data["ref_id"] = ref_id

        if tenant_id not in self._notifications:
            self._notifications[tenant_id] = []
        self._notifications[tenant_id].append(notification)

        # Also persist to DB if available
        self._persist_to_db(notification)

        logger.info(
            "notification created tenant=%s type=%s title=%s id=%s",
            tenant_id, type, title, notification.id,
        )
        return notification

    def _persist_to_db(self, notification: Notification) -> None:
        """Persist notification to database."""
        try:
            import json
            import psycopg2.extras
            from main import _execute_returning

            sql = """
                INSERT INTO "notifications"
                    ("id", "tenantId", "type", "priority", "title", "message",
                     "data", "read", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, false, NOW(), NOW())
                ON CONFLICT ("id") DO NOTHING
            """
            _execute_returning(sql, (
                notification.id,
                notification.tenant_id,
                notification.type,
                notification.priority,
                notification.title,
                notification.message,
                psycopg2.extras.Json(notification.data) if notification.data else None,
            ))
        except Exception as exc:
            logger.debug("notification DB persist skipped: %s", exc)

    def get_notifications(
        self,
        tenant_id: str,
        unread_only: bool = False,
        limit: int = 50,
    ) -> list[Notification]:
        """Get notifications for a tenant."""
        # Try DB first, fall back to in-memory
        try:
            from main import _query_all
            conditions = ['"tenantId" = %s']
            params: list[Any] = [tenant_id]
            if unread_only:
                conditions.append('"read" = false')
            where = ' AND '.join(conditions)
            rows = _query_all(
                f'SELECT * FROM "notifications" WHERE {where} ORDER BY "createdAt" DESC LIMIT %s',
                tuple(params + [limit]),
            )
            return [
                Notification(
                    id=str(r.get("id", "")),
                    tenant_id=str(r.get("tenantId", "")),
                    type=str(r.get("type", "")),
                    priority=str(r.get("priority", "medium")),
                    title=str(r.get("title", "")),
                    message=str(r.get("message", "")),
                    data=r.get("data") or {},
                    read=bool(r.get("read", False)),
                    read_at=r.get("readAt").isoformat() if r.get("readAt") else None,
                    created_at=r.get("createdAt").isoformat() if r.get("createdAt") else "",
                )
                for r in rows
            ]
        except Exception:
            # Fallback to in-memory
            notifs = self._notifications.get(tenant_id, [])
            if unread_only:
                notifs = [n for n in notifs if not n.read]
            return sorted(notifs, key=lambda n: n.created_at, reverse=True)[:limit]

    def mark_read(self, tenant_id: str, notification_id: str) -> bool:
        """Mark a notification as read."""
        # Try DB first
        try:
            from main import _query_one, _execute_returning
            row = _query_one(
                'SELECT * FROM "notifications" WHERE "id" = %s AND "tenantId" = %s',
                (notification_id, tenant_id),
            )
            if row:
                _execute_returning(
                    'UPDATE "notifications" SET "read" = true, "readAt" = NOW(), "updatedAt" = NOW() WHERE "id" = %s',
                    (notification_id,),
                )
                return True
        except Exception:
            pass

        # Fallback to in-memory
        notifs = self._notifications.get(tenant_id, [])
        for n in notifs:
            if n.id == notification_id:
                n.read = True
                n.read_at = datetime.utcnow().isoformat()
                return True
        return False

    def mark_all_read(self, tenant_id: str) -> int:
        """Mark all notifications as read for a tenant. Returns count marked."""
        count = 0
        # Try DB
        try:
            from main import _execute_returning
            result = _execute_returning(
                'UPDATE "notifications" SET "read" = true, "readAt" = NOW(), "updatedAt" = NOW() WHERE "tenantId" = %s AND "read" = false',
                (tenant_id,),
            )
            if result:
                count = result.get("_rowcount_", 0)
        except Exception:
            pass

        # Fallback
        for n in self._notifications.get(tenant_id, []):
            if not n.read:
                n.read = True
                n.read_at = datetime.utcnow().isoformat()
                count += 1
        return count

    def get_unread_count(self, tenant_id: str) -> int:
        """Get count of unread notifications."""
        # Try DB
        try:
            from main import _query_one
            row = _query_one(
                'SELECT COUNT(*) AS cnt FROM "notifications" WHERE "tenantId" = %s AND "read" = false',
                (tenant_id,),
            )
            if row:
                return row.get("cnt", 0)
        except Exception:
            pass

        return sum(1 for n in self._notifications.get(tenant_id, []) if not n.read)

    def delete(self, tenant_id: str, notification_id: str) -> bool:
        """Delete a notification."""
        # Try DB
        try:
            from main import get_conn
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'DELETE FROM "notifications" WHERE "id" = %s AND "tenantId" = %s',
                        (notification_id, tenant_id),
                    )
                    conn.commit()
                    return cur.rowcount > 0
        except Exception:
            pass

        # Fallback
        notifs = self._notifications.get(tenant_id, [])
        self._notifications[tenant_id] = [n for n in notifs if n.id != notification_id]
        return True

    # ── Convenience creators ──────────────────────────────────────────────────

    def notify_approval(self, tenant_id: str, approval_id: str, title: str) -> Notification:
        """Create a notification for a new approval request."""
        return self.create(
            tenant_id=tenant_id,
            type=NotificationType.APPROVAL_PENDING.value,
            priority="high",
            title="Approval Required",
            message=f"'{title}' needs your approval.",
            data={"approval_id": approval_id},
        )

    def notify_agent_alert(
        self, tenant_id: str, agent_role: str, message: str
    ) -> Notification:
        """Create an alert from an AI agent."""
        return self.create(
            tenant_id=tenant_id,
            type=NotificationType.AGENT_ALERT.value,
            priority="medium",
            title=f"{agent_role.upper()} Alert",
            message=message,
            data={"agent_role": agent_role},
        )

    def notify_insight(self, tenant_id: str, title: str, message: str) -> Notification:
        """Create an AI-generated insight notification."""
        return self.create(
            tenant_id=tenant_id,
            type=NotificationType.INSIGHT.value,
            priority="medium",
            title=title,
            message=message,
        )

    def notify_error(self, tenant_id: str, title: str, message: str) -> Notification:
        """Create an error notification."""
        return self.create(
            tenant_id=tenant_id,
            type=NotificationType.ERROR.value,
            priority="urgent",
            title=title,
            message=message,
        )


# Global singleton
_notification_service: NotificationService | None = None


def get_notification_service() -> NotificationService:
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
