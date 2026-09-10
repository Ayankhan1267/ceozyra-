"""
ZYRA AI Gateway — Chat completions endpoint
OpenAI-compatible /v1/chat/completions endpoint backed by the configured AI provider.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from config.settings import get_settings
from providers.base import ChatCompletionRequest, ChatCompletionResponse
from providers.factory import ProviderFactory

logger = logging.getLogger("zyra.endpoints.chat")
router = APIRouter()


@router.post("/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    provider = ProviderFactory.create_from_settings()
    settings = get_settings()

    logger.info(
        "chat_completions model=%s stream=%s messages=%d provider=%s",
        request.model or settings.OLLAMA_MODEL,
        request.stream,
        len(request.messages),
        provider.name,
    )

    if not request.messages:
        raise HTTPException(status_code=400, detail="messages array cannot be empty.")

    if not request.model:
        request.model = settings.OLLAMA_MODEL

    try:
        if request.stream:
            from sse_starlette import EventSourceResponse

            async def event_stream():
                try:
                    async for chunk in provider.chat(request):
                        yield {
                            "event": "chunk",
                            "data": chunk.model_dump_json(),
                        }
                    yield {"event": "done", "data": "{}"}
                except Exception as exc:
                    logger.error("Streaming error: %s", exc)
                    yield {"event": "error", "data": str(exc)}

            return EventSourceResponse(event_stream())

        result: ChatCompletionResponse = await provider.chat(request)
        return result.model_dump()

    except Exception as exc:
        status = getattr(exc, "status_code", 500)
        detail = str(exc)
        logger.error("Chat completion error: %s", detail)
        raise HTTPException(status_code=status, detail=detail) from exc
