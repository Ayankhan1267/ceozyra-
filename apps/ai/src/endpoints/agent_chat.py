"""
ZYRA AI Gateway — ZYRA agent chat endpoint
Routes messages to the appropriate C-suite AI agent with tenant context.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse

from agents.registry import AgentRole, classify_message, get_agent
from brain.conversation_service import ConversationService
from config.settings import get_settings
from providers.base import ChatCompletionChunk, ChatCompletionRequest, ChatMessage
from providers.factory import ProviderFactory
from tenant.context import TenantContext, get_tenant_context

logger = logging.getLogger("zyra.endpoints.agent_chat")
router = APIRouter()
_conversation_service = ConversationService()


class AgentChatRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID for request isolation")
    tenant_slug: str | None = Field(default=None, description="Optional tenant slug")
    message: str = Field(..., min_length=1, description="User message to the agent")
    context: dict[str, Any] | None = Field(default=None, description="Optional extra context")
    agent_role: str | None = Field(default=None, description="Force a specific agent role")
    conversation_id: str | None = Field(default=None, description="Conversation ID for multi-turn context")
    conversation_history: list[dict[str, Any]] | None = Field(default=None)
    stream: bool = Field(default=False)


class AgentChatResponse(BaseModel):
    run_id: str
    conversation_id: str
    agent_role: str
    agent_label: str
    content: str
    model: str
    provider: str
    usage: dict[str, Any] | None = None
    latency_ms: float
    generated_at: str


@router.post("/agents/chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest):
    settings = get_settings()
    t0 = time.monotonic()
    run_id = uuid.uuid4().hex

    # Resolve tenant
    tenant_ctx: TenantContext = get_tenant_context(
        tenant_id=request.tenant_id,
        tenant_slug=request.tenant_slug,
    )

    if not tenant_ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Invalid tenant_id.")

    # Load tenant business context
    tenant_ctx.load()
    tenant_context_str = tenant_ctx.to_prompt_context()

    # Classify / resolve agent role
    if request.agent_role:
        try:
            role = AgentRole(request.agent_role.lower())
        except ValueError:
            valid = [r.value for r in AgentRole]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid agent_role '{request.agent_role}'. Valid: {valid}",
            )
    else:
        role = classify_message(request.message)

    agent_def = get_agent(role)

    # -- Conversation persistence ------------------------------------------
    conversation_id = request.conversation_id

    if not conversation_id:
        conv = _conversation_service.create_conversation(
            tenant_id=tenant_ctx.tenant_id,
            agent_role=role.value,
            title=request.message[:80],
        )
        conversation_id = conv["id"]

    db_messages, _ = _conversation_service.get_messages(conversation_id, tenant_ctx.tenant_id)
    conversation_history = [
        {"role": m["role"], "content": m["content"]} for m in db_messages
    ]

    system_prompt = _build_agent_prompt(
        agent=agent_def,
        tenant_context_str=tenant_context_str,
        conversation_history=conversation_history,
        extra_context=request.context or {},
    )

    # Build message list
    messages: list[ChatMessage] = [ChatMessage(role="system", content=system_prompt)]
    for turn in conversation_history[-10:]:
        messages.append(
            ChatMessage(
                role=turn.get("role", "user"),
                content=turn.get("content", ""),
            )
        )
    messages.append(ChatMessage(role="user", content=request.message))

    # Call provider
    provider = ProviderFactory.create_from_settings()
    model = settings.OLLAMA_MODEL

    try:
        chat_request = ChatCompletionRequest(
            messages=messages,
            model=model,
            stream=request.stream,
            temperature=settings.AGENT_TEMPERATURE,
            max_tokens=1024,
        )

        if request.stream:
            return _stream_response(
                run_id, role, agent_def, provider, chat_request
            )

        result = await provider.chat(chat_request)
        latency_ms = round((time.monotonic() - t0) * 1000, 1)

        from ..providers.base import ChatCompletionResponse
        assert isinstance(result, ChatCompletionResponse)

        content = ""
        if result.choices:
            content = result.choices[0].get("message", {}).get("content", "") or ""

        usage = _extract_usage(result.usage) or {}
        total_tokens = usage.get("total_tokens", 0)

        # Save user message and AI response to conversation
        try:
            _conversation_service.add_message(
                conversation_id=conversation_id,
                role="user",
                content=request.message,
            )
            _conversation_service.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=content,
                metadata={"run_id": run_id, "agent_role": role.value},
            )
        except Exception as exc:
            logger.error("Failed to persist messages (conversation_id=%s): %s", conversation_id, exc)

        # Record agent run
        try:
            from brain.agent_service import AgentService
            AgentService.create_run(
                tenant_id=tenant_ctx.tenant_id,
                agent_id=None,
                agent_type=role.value,
                user_id=None,
                input_data={"message": request.message},
            )
        except Exception:
            pass

        # Track budget usage
        try:
            from monitoring.budget_tracker import get_budget_tracker
            get_budget_tracker().record_usage(
                run_id=run_id,
                tenant_id=tenant_ctx.tenant_id,
                agent_role=role.value,
                provider=provider.name,
                model=model,
                total_tokens=total_tokens,
            )
        except Exception:
            pass

        # Audit log
        try:
            from monitoring.audit_logger import get_audit_logger
            get_audit_logger().log_agent_run(
                tenant_id=tenant_ctx.tenant_id,
                run_id=run_id,
                agent_role=role.value,
                model=model,
                provider=provider.name,
                tokens_used=total_tokens,
            )
        except Exception:
            pass

        logger.info(
            "agent_chat run_id=%s role=%s latency=%sms provider=%s conversation_id=%s",
            run_id, role.value, latency_ms, provider.name, conversation_id,
        )

        return AgentChatResponse(
            run_id=run_id,
            conversation_id=conversation_id,
            agent_role=role.value,
            agent_label=agent_def.label,
            content=content,
            model=result.model,
            provider=provider.name,
            usage=usage,
            latency_ms=latency_ms,
            generated_at=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as exc:
        status = getattr(exc, "status_code", 500)
        detail = str(exc)
        logger.error("Agent chat error (run_id=%s role=%s): %s", run_id, role.value, detail)
        raise HTTPException(status_code=status, detail=detail) from exc


def _build_agent_prompt(
    agent: Any,
    tenant_context_str: str,
    conversation_history: list[dict],
    extra_context: dict,
) -> str:
    parts: list[str] = [
        agent.system_prompt,
        "",
        "--- CURRENT BUSINESS CONTEXT ---",
        tenant_context_str,
        "--- END CONTEXT ---",
    ]

    if extra_context:
        parts.extend(["", "--- ADDITIONAL CONTEXT ---"])
        for k, v in extra_context.items():
            parts.append(f"{k}: {v}")
        parts.append("--- END ADDITIONAL CONTEXT ---")

    if conversation_history:
        parts.extend(["", "--- RECENT CONVERSATION ---"])
        for turn in conversation_history[-6:]:
            parts.append(
                f"{turn.get('role', 'user').upper()}: {turn.get('content', '')}"
            )
        parts.append("--- END CONVERSATION ---")

    parts.append(
        "\nAnswer the user's question concisely and data-driven. "
        "If the context does not contain relevant data, say so honestly."
    )
    return "\n".join(parts)


async def _stream_response(
    run_id: str,
    role: Any,
    agent: Any,
    provider: Any,
    chat_request: Any,
):
    async def event_stream():
        try:
            async for chunk in provider.chat(chat_request):
                delta = ""
                if chunk.choices:
                    delta = chunk.choices[0].get("delta", {}).get("content", "")
                yield {
                    "event": "chunk",
                    "data": json.dumps({
                        "run_id": run_id,
                        "agent_role": role.value,
                        "agent_label": agent.label,
                        "delta": delta,
                    }),
                }
            yield {
                "event": "done",
                "data": json.dumps({"run_id": run_id, "agent_role": role.value}),
            }
        except Exception as exc:
            logger.error("Stream error: %s", exc)
            yield {"event": "error", "data": str(exc)}

    return EventSourceResponse(event_stream())


def _extract_usage(usage: Any) -> dict[str, Any] | None:
    if usage is None:
        return None
    if isinstance(usage, dict):
        return usage
    if hasattr(usage, "model_dump"):
        return usage.model_dump()
    if hasattr(usage, "__dict__"):
        return dict(usage.__dict__)
    return None
