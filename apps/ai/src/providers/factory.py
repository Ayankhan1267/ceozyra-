"""
ZYRA AI Gateway — Provider factory
Creates and returns the correct AI provider instance based on configuration.
"""

from __future__ import annotations

import logging

from providers.anthropic import AnthropicProvider
from providers.base import AIProvider, AIProviderError
from providers.ollama import OllamaProvider
from providers.openai import OpenAIProvider

logger = logging.getLogger("zyra.providers.factory")


class ProviderFactory:
    """Creates AI provider instances based on configuration."""

    @staticmethod
    def create(provider_name: str, **kwargs) -> AIProvider:
        name = provider_name.lower().strip()

        if name == "ollama":
            return OllamaProvider(**kwargs)
        if name == "openai":
            return OpenAIProvider(**kwargs)
        if name == "anthropic":
            return AnthropicProvider(**kwargs)

        logger.warning("Unknown provider '%s', falling back to ollama.", name)
        return OllamaProvider(**kwargs)

    @staticmethod
    def create_from_settings() -> AIProvider:
        from config.settings import get_settings

        settings = get_settings()
        provider_name = settings.active_provider

        kwargs: dict = {}
        if provider_name == "ollama":
            kwargs = {
                "base_url": settings.OLLAMA_URL,
                "default_model": settings.OLLAMA_MODEL,
                "default_embedding_model": settings.OLLAMA_EMBEDDING_MODEL,
                "request_timeout": settings.OLLAMA_REQUEST_TIMEOUT,
            }
        elif provider_name == "openai":
            kwargs = {
                "api_key": settings.OPENAI_API_KEY,
                "default_model": settings.OPENAI_MODEL,
            }
        elif provider_name == "anthropic":
            kwargs = {
                "api_key": settings.ANTHROPIC_API_KEY,
                "default_model": settings.ANTHROPIC_MODEL,
            }

        return ProviderFactory.create(provider_name, **kwargs)
