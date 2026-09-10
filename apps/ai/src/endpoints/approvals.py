"""
ZYRA AI Gateway — Approval Engine endpoints
Create, list, approve, reject, and cancel approval requests.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("zyra.endpoints.approvals")
router = APIRouter()

# ── Pydantic request/response models ─────────────────────────────────────────

class CreateApprovalRequest(BaseModel):
    tenantId: str | None = Field(default=None, description="Tenant ID (preferred)")
    tenantSlug: str | None = Field(default=None, description="Tenant slug (alternative to tenantId)")
    type: str = Field(..., description="Approval type: CAMPAIGN, DISCOUNT, EXPENSE, PRODUCT, PRICE_CHANGE, ORDER_REFUND, INTEGRATION, AUTOMATION, CONTENT_PUBLISH, AD_SPEND")
    title: str = Field(..., min_length=1, max_length=255, description="Approval title")
    description: str | None = Field(default=None, max_length=2000, description="Detailed description")
    data: dict[str, Any] | None = Field(default=None, description="Arbitrary approval payload")
    requestedBy: str | None = Field(default=None, description="User ID of requester")
    expectedOutcome: dict[str, Any] | None = Field(default=None, description="Expected outcome if approved")
    risk: str | None = Field(default=None, description="Risk level: low, medium, high, critical")
    confidence: float | None = Field(default=None, ge=0.0, le=100.0, description="Confidence score 0-100")
    cost: float | None = Field(default=None, ge=0.0, description="Estimated cost")
    affectedEntities: dict[str, Any] | None = Field(default=None, description="Affected entities (customers, orders, etc.)")
    expiresAt: str | None = Field(default=None, description="ISO datetime for expiry")
    runId: str | None = Field(default=None, description="Related agent run ID")


class ApprovalActionRequest(BaseModel):
    approvedBy: str | None = Field(default=None, description="User ID of decider")
    reason: str | None = Field(default=None, max_length=1000, description="Reason for decision")


class ApprovalResponse(BaseModel):
    id: str
    tenantId: str
    type: str
    title: str
    description: str | None
    data: dict[str, Any] | None
    status: str
    requestedBy: str | None
    approvedBy: str | None
    reason: str | None
    evidence: dict[str, Any] | None
    expectedOutcome: dict[str, Any] | None
    risk: str | None
    confidence: float | None
    cost: float | None
    affectedEntities: dict[str, Any] | None
    rollbackRef: str | None
    runId: str | None
    expiresAt: str | None
    decidedAt: str | None
    createdAt: str
    updatedAt: str


# ── Helpers ───────────────────────────────────────────────────────────────────

VALID_TYPES = {
    "CAMPAIGN", "DISCOUNT", "EXPENSE", "PRODUCT", "PRICE_CHANGE",
    "ORDER_REFUND", "INTEGRATION", "AUTOMATION", "CONTENT_PUBLISH", "AD_SPEND",
}
VALID_STATUSES = {"PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"}
VALID_RISKS = {"low", "medium", "high", "critical"}


def _row_to_approval(row: dict[str, Any]) -> ApprovalResponse:
    """Convert a DB row dict to a serializable approval response."""
    return ApprovalResponse(
        id=str(row.get("id", "")),
        tenantId=str(row.get("tenantId", "")),
        type=str(row.get("type", "")),
        title=str(row.get("title", "")),
        description=row.get("description"),
        data=row.get("data"),
        status=str(row.get("status", "")),
        requestedBy=row.get("requestedBy"),
        approvedBy=row.get("approvedBy"),
        reason=row.get("reason"),
        evidence=row.get("evidence"),
        expectedOutcome=row.get("expectedOutcome"),
        risk=row.get("risk"),
        confidence=float(row["confidence"]) if row.get("confidence") is not None else None,
        cost=float(row["cost"]) if row.get("cost") is not None else None,
        affectedEntities=row.get("affectedEntities"),
        rollbackRef=row.get("rollbackRef"),
        runId=row.get("runId"),
        expiresAt=row.get("expiresAt").isoformat() if row.get("expiresAt") else None,
        decidedAt=row.get("decidedAt").isoformat() if row.get("decidedAt") else None,
        createdAt=row.get("createdAt").isoformat() if row.get("createdAt") else "",
        updatedAt=row.get("updatedAt").isoformat() if row.get("updatedAt") else "",
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/approvals", response_model=ApprovalResponse, status_code=201)
def create_approval(body: CreateApprovalRequest):
    """
    Create a new approval request.

    Requires either tenantId or tenantSlug to resolve the tenant.
    """
    from main import _resolve_tenant, _query_one

    # Resolve tenant
    tenant_id = body.tenantId or _resolve_tenant(None, body.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide a valid tenantId or tenantSlug.")

    # Validate type
    type_upper = body.type.upper()
    if type_upper not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid approval type '{body.type}'. Valid types: {sorted(VALID_TYPES)}",
        )

    # Validate risk if provided
    risk = body.risk.lower() if body.risk else None
    if risk and risk not in VALID_RISKS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid risk level '{body.risk}'. Valid: {sorted(VALID_RISKS)}",
        )

    # Validate expiresAt if provided
    expires_at = None
    if body.expiresAt:
        try:
            expires_at = datetime.fromisoformat(body.expiresAt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Invalid expiresAt format: '{body.expiresAt}'. Use ISO 8601.")

    import json
    data_json = json.dumps(body.data) if body.data else None
    expected_outcome_json = json.dumps(body.expectedOutcome) if body.expectedOutcome else None
    affected_entities_json = json.dumps(body.affectedEntities) if body.affectedEntities else None

    row = _query_one(
        """
        INSERT INTO "approvals"
            ("tenantId", "type", "title", "description", "data",
             "requestedBy", "expectedOutcome", "risk", "confidence", "cost",
             "affectedEntities", "expiresAt", "runId", "status", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDING', NOW(), NOW())
        RETURNING *
        """,
        (
            tenant_id,
            type_upper,
            body.title,
            body.description,
            data_json,
            body.requestedBy,
            expected_outcome_json,
            risk,
            body.confidence,
            body.cost,
            affected_entities_json,
            expires_at,
            body.runId,
        ),
    )

    if not row:
        logger.error("Failed to create approval for tenant=%s title=%s", tenant_id, body.title)
        raise HTTPException(status_code=500, detail="Failed to create approval request.")

    # Audit log
    try:
        from monitoring.audit_logger import get_audit_logger
        get_audit_logger().log(
            tenant_id=tenant_id,
            action="approval.created",
            actor_type="user",
            actor_id=body.requestedBy or "unknown",
            resource_type="approval",
            resource_id=str(row.get("id")),
            metadata={"type": type_upper, "title": body.title, "risk": risk},
        )
    except Exception:
        pass

    # Notify relevant users
    try:
        from monitoring.notifications import get_notification_service
        ns = get_notification_service()
        ns.create(
            tenant_id=tenant_id,
            title=f"Approval needed: {body.title}",
            message=f"Type: {type_upper} | Risk: {risk or 'N/A'} | Requested by: {body.requestedBy or 'AI'}",
            ntype="APPROVAL_REQUESTED",
            priority="high" if risk in ("high", "critical") else "medium",
            ref_type="approval",
            ref_id=str(row.get("id")),
        )
    except Exception:
        pass

    logger.info("Approval created: id=%s tenant=%s type=%s title=%s", row.get("id"), tenant_id, type_upper)
    return _row_to_approval(row)


@router.get("/approvals")
def list_approvals(
    tenantId: str | None = None,
    tenantSlug: str | None = None,
    status: str | None = None,
    type: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    List approvals, optionally filtered by tenant, status, and type.

    - limit: max results (default 50, max 200)
    - offset: pagination offset
    """
    from main import _resolve_tenant, _query_all

    tenant_id = tenantId or _resolve_tenant(None, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide a valid tenantId or tenantSlug.")

    # Clamp limit
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    conditions = ['"tenantId" = %s']
    params: list[Any] = [tenant_id]

    if status:
        status_upper = status.upper()
        if status_upper not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{status}'. Valid: {sorted(VALID_STATUSES)}",
            )
        conditions.append('"status" = %s')
        params.append(status_upper)

    if type:
        type_upper = type.upper()
        if type_upper not in VALID_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid type '{type}'. Valid: {sorted(VALID_TYPES)}",
            )
        conditions.append('"type" = %s')
        params.append(type_upper)

    where = ' AND '.join(conditions)
    sql = f"""
        SELECT * FROM "approvals"
        WHERE {where}
        ORDER BY "createdAt" DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    rows = _query_all(sql, tuple(params))
    approvals = [_row_to_approval(r) for r in rows]

    # Count total
    count_row = _query_one(f'SELECT COUNT(*) AS cnt FROM "approvals" WHERE {where}', tuple(params[:-2]))
    total = count_row["cnt"] if count_row else 0

    logger.info("Listed approvals: tenant=%s status=%s type=%s count=%d total=%d", tenant_id, status, type, len(approvals), total)
    return {"approvals": approvals, "total": total, "limit": limit, "offset": offset}


@router.get("/approvals/{approval_id}", response_model=ApprovalResponse)
def get_approval(approval_id: str):
    """Get a single approval by ID."""
    from main import _query_one

    row = _query_one('SELECT * FROM "approvals" WHERE "id" = %s', (approval_id,))
    if not row:
        raise HTTPException(status_code=404, detail=f"Approval '{approval_id}' not found.")

    logger.info("Retrieved approval: id=%s status=%s", approval_id, row.get("status"))
    return _row_to_approval(row)


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalResponse)
def approve_approval(approval_id: str, body: ApprovalActionRequest):
    """
    Approve a PENDING approval request.

    Sets status to APPROVED, records decidedAt and decider.
    """
    from main import _query_one

    row = _query_one('SELECT * FROM "approvals" WHERE "id" = %s', (approval_id,))
    if not row:
        raise HTTPException(status_code=404, detail=f"Approval '{approval_id}' not found.")

    if row.get("status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: approval is already '{row['status']}'. Only PENDING approvals can be approved.",
        )

    updated = _query_one(
        """
        UPDATE "approvals"
        SET "status" = 'APPROVED',
            "approvedBy" = %s,
            "reason" = %s,
            "decidedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = %s
        RETURNING *
        """,
        (body.approvedBy, body.reason, approval_id),
    )

    if not updated:
        raise HTTPException(status_code=500, detail="Failed to approve approval.")

    logger.info("Approval approved: id=%s by=%s", approval_id, body.approvedBy)

    try:
        from monitoring.audit_logger import get_audit_logger
        get_audit_logger().log_approval_decided(
            tenant_id=str(row.get("tenantId", "")),
            approval_id=approval_id,
            decision="APPROVED",
            decider=body.approvedBy or "unknown",
            reason=body.reason,
        )
    except Exception:
        pass

    return _row_to_approval(updated)


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalResponse)
def reject_approval(approval_id: str, body: ApprovalActionRequest):
    """
    Reject a PENDING approval request.

    Sets status to REJECTED, records decidedAt and decider.
    """
    from main import _query_one

    row = _query_one('SELECT * FROM "approvals" WHERE "id" = %s', (approval_id,))
    if not row:
        raise HTTPException(status_code=404, detail=f"Approval '{approval_id}' not found.")

    if row.get("status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject: approval is already '{row['status']}'. Only PENDING approvals can be rejected.",
        )

    updated = _query_one(
        """
        UPDATE "approvals"
        SET "status" = 'REJECTED',
            "approvedBy" = %s,
            "reason" = %s,
            "decidedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = %s
        RETURNING *
        """,
        (body.approvedBy, body.reason, approval_id),
    )

    if not updated:
        raise HTTPException(status_code=500, detail="Failed to reject approval.")

    logger.info("Approval rejected: id=%s by=%s", approval_id, body.approvedBy)

    try:
        from monitoring.audit_logger import get_audit_logger
        get_audit_logger().log_approval_decided(
            tenant_id=str(row.get("tenantId", "")),
            approval_id=approval_id,
            decision="REJECTED",
            decider=body.approvedBy or "unknown",
            reason=body.reason,
        )
    except Exception:
        pass

    return _row_to_approval(updated)


@router.post("/approvals/{approval_id}/cancel", response_model=ApprovalResponse)
def cancel_approval(approval_id: str):
    """
    Cancel a PENDING approval request.

    Sets status to CANCELLED. No decider required.
    """
    from main import _query_one

    row = _query_one('SELECT * FROM "approvals" WHERE "id" = %s', (approval_id,))
    if not row:
        raise HTTPException(status_code=404, detail=f"Approval '{approval_id}' not found.")

    if row.get("status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel: approval is already '{row['status']}'. Only PENDING approvals can be cancelled.",
        )

    updated = _query_one(
        """
        UPDATE "approvals"
        SET "status" = 'CANCELLED',
            "updatedAt" = NOW()
        WHERE "id" = %s
        RETURNING *
        """,
        (approval_id,),
    )

    if not updated:
        raise HTTPException(status_code=500, detail="Failed to cancel approval.")

    logger.info("Approval cancelled: id=%s", approval_id)

    try:
        from monitoring.audit_logger import get_audit_logger
        get_audit_logger().log_approval_decided(
            tenant_id=str(row.get("tenantId", "")),
            approval_id=approval_id,
            decision="CANCELLED",
            decider="system",
            reason=None,
        )
    except Exception:
        pass

    return _row_to_approval(updated)
