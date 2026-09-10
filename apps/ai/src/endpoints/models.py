"""
ZYRA AI Gateway — Models endpoint
Lists available models from the configured AI provider.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from providers.factory import ProviderFactory

logger = logging.getLogger("zyra.endpoints.models")
router = APIRouter()


@router.get("/models")
async def list_models():
    provider = ProviderFactory.create_from_settings()
    try:
        result = await provider.list_models()
        return result.model_dump()
    except Exception as exc:
        logger.error("Failed to list models: %s", exc)
        return {"object": "list", "data": [], "provider": provider.name, "error": str(exc)}


@router.get("/models/health")
async def model_health():
    provider = ProviderFactory.create_from_settings()
    health = await provider.health()
    return {"provider": provider.name, **health}
