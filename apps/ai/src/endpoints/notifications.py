"""
ZYRA AI Gateway — Notifications endpoint
List, read, and delete notifications for a tenant.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("zyra.endpoints.notifications")
router = APIRouter()


@router.get("/notifications")
def list_notifications(
    tenantId: str | None = None,
    tenantSlug: str | None = None,
    unread_only: bool = False,
    limit: int = 50,
):
    """List notifications for a tenant."""
    from main import _resolve_tenant
    from monitoring.notifications import get_notification_service

    tenant_id = tenantId or _resolve_tenant(None, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    ns = get_notification_service()
    notifs = ns.get_notifications(tenant_id, unread_only=unread_only, limit=limit)
    return {
        "notifications": [n.to_dict() for n in notifs],
        "unread_count": ns.get_unread_count(tenant_id),
    }


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, tenantId: str | None = None, tenantSlug: str | None = None):
    """Mark a notification as read."""
    from main import _resolve_tenant
    from monitoring.notifications import get_notification_service

    tenant_id = tenantId or _resolve_tenant(None, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    ns = get_notification_service()
    ok = ns.mark_read(tenant_id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(tenantId: str | None = None, tenantSlug: str | None = None):
    """Mark all notifications as read for a tenant."""
    from main import _resolve_tenant
    from monitoring.notifications import get_notification_service

    tenant_id = tenantId or _resolve_tenant(None, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    ns = get_notification_service()
    count = ns.mark_all_read(tenant_id)
    return {"ok": True, "marked_count": count}


@router.delete("/notifications/{notification_id}")
def delete_notification(notification_id: str, tenantId: str | None = None, tenantSlug: str | None = None):
    """Delete a notification."""
    from main import _resolve_tenant
    from monitoring.notifications import get_notification_service

    tenant_id = tenantId or _resolve_tenant(None, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    ns = get_notification_service()
    ok = ns.delete(tenant_id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"ok": True}


@router.get("/notifications/unread-count")
def unread_count(tenantId: str | None = None, tenantSlug: str | None = None):
    """Get unread notification count."""
    from main import _resolve_tenant
    from monitoring.notifications import get_notification_service

    tenant_id = tenantId or _resolve_tenant(None, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    ns = get_notification_service()
    return {"unread_count": ns.get_unread_count(tenant_id)}
