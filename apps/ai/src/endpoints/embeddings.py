"""
ZYRA AI Gateway — Embeddings endpoint
OpenAI-compatible /v1/embeddings endpoint.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from config.settings import get_settings
from providers.base import EmbeddingRequest, EmbeddingResponse
from providers.factory import ProviderFactory

logger = logging.getLogger("zyra.endpoints.embeddings")
router = APIRouter()


@router.post("/embeddings")
async def create_embeddings(request: EmbeddingRequest):
    provider = ProviderFactory.create_from_settings()
    settings = get_settings()

    model = request.model or settings.OLLAMA_EMBEDDING_MODEL
    input_len = len(request.input) if isinstance(request.input, str) else len(request.input)
    logger.info("embedding model=%s input_len=%d", model, input_len)

    try:
        result: EmbeddingResponse = await provider.embed(request)
        return result.model_dump()
    except Exception as exc:
        status = getattr(exc, "status_code", 500)
        detail = str(exc)
        logger.error("Embedding error: %s", detail)
        raise HTTPException(status_code=status, detail=detail) from exc


@router.get("/embeddings/health")
async def embedding_health():
    provider = ProviderFactory.create_from_settings()
    health = await provider.health()
    return {"provider": provider.name, **health}
