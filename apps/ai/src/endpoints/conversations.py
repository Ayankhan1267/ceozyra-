"""
ZYRA AI Gateway — Conversation endpoints
REST API for managing AI chat conversations and messages.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from brain.conversation_service import ConversationService

logger = logging.getLogger("zyra.endpoints.conversations")
router = APIRouter()

# ── Models ────────────────────────────────────────────────────────────────────


class CreateConversationRequest(BaseModel):
    tenantId: str = Field(..., description="Tenant ID")
    tenantSlug: str | None = Field(default=None, description="Optional tenant slug (resolved to tenantId)")
    agentRole: str = Field(default="general", description="Agent role for this conversation")
    title: str | None = Field(default=None, description="Optional conversation title")


class ConversationResponse(BaseModel):
    id: str
    tenant_id: str
    agent_role: str
    title: str | None
    created_at: str
    updated_at: str


class ConversationDetailResponse(ConversationResponse):
    messages: list[dict[str, Any]]
    total_messages: int


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    metadata: dict[str, Any] | None
    created_at: str


class AddMessageRequest(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")
    metadata: dict[str, Any] | None = Field(default=None, description="Optional metadata")


class ListConversationsResponse(BaseModel):
    conversations: list[ConversationResponse]
    total: int
    limit: int
    offset: int


# ── Helpers ───────────────────────────────────────────────────────────────────

_conversation_service: ConversationService | None = None


def get_service() -> ConversationService:
    global _conversation_service
    if _conversation_service is None:
        _conversation_service = ConversationService()
    return _conversation_service


def _resolve_tenant(tenant_id: str | None, tenant_slug: str | None) -> str | None:
    if tenant_id:
        return tenant_id
    if tenant_slug:
        from main import _query_one
        row = _query_one('SELECT "id" FROM "tenants" WHERE "slug" = %s', (tenant_slug,))
        return row["id"] if row else None
    return None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/conversations", response_model=ConversationResponse)
def create_conversation(req: CreateConversationRequest):
    tenant_id = _resolve_tenant(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide a valid tenantId or tenantSlug.")

    try:
        service = get_service()
        result = service.create_conversation(
            tenant_id=tenant_id,
            agent_role=req.agentRole,
            title=req.title,
        )
        logger.info("Created conversation %s for tenant %s", result.get("id"), tenant_id)
        return result
    except Exception as exc:
        logger.error("create_conversation error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create conversation.") from exc


@router.get("/conversations", response_model=ListConversationsResponse)
def list_conversations(
    tenantId: str = Query(..., description="Tenant ID"),
    tenantSlug: str | None = Query(default=None, description="Optional tenant slug"),
    agentRole: str | None = Query(default=None, description="Filter by agent role"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    tenant_id = _resolve_tenant(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    try:
        service = get_service()
        rows, total = service.list_conversations(
            tenant_id=tenant_id,
            agent_role=agentRole,
            limit=limit,
            offset=offset,
        )
        return {
            "conversations": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as exc:
        logger.error("list_conversations error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to list conversations.") from exc


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    tenantId: str = Query(..., description="Tenant ID"),
    tenantSlug: str | None = Query(default=None, description="Optional tenant slug"),
):
    tenant_id = _resolve_tenant(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    try:
        service = get_service()
        conv = service.get_conversation(conversation_id, tenant_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        messages, _ = service.get_messages(conversation_id, tenant_id)
        return {**conv, "messages": messages, "total_messages": len(messages)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_conversation error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get conversation.") from exc


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
def get_messages(
    conversation_id: str,
    tenantId: str = Query(..., description="Tenant ID"),
    tenantSlug: str | None = Query(default=None, description="Optional tenant slug"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    tenant_id = _resolve_tenant(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    try:
        service = get_service()
        conv = service.get_conversation(conversation_id, tenant_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        rows, _ = service.get_messages(conversation_id, tenant_id, limit=limit, offset=offset)
        return rows
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_messages error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get messages.") from exc


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
def add_message(
    conversation_id: str,
    req: AddMessageRequest,
    tenantId: str = Query(..., description="Tenant ID"),
    tenantSlug: str | None = Query(default=None, description="Optional tenant slug"),
):
    tenant_id = _resolve_tenant(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    try:
        service = get_service()
        conv = service.get_conversation(conversation_id, tenant_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        result = service.add_message(
            conversation_id=conversation_id,
            role=req.role,
            content=req.content,
            metadata=req.metadata,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("add_message error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to add message.") from exc


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    tenantId: str = Query(..., description="Tenant ID"),
    tenantSlug: str | None = Query(default=None, description="Optional tenant slug"),
):
    tenant_id = _resolve_tenant(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    try:
        service = get_service()
        deleted = service.delete_conversation(conversation_id, tenant_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        return {"detail": "Conversation deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("delete_conversation error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete conversation.") from exc
