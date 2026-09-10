"""
ZYRA AI Gateway — Configuration
Loads and validates all environment variables required by the AI service.
"""

import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Service ──────────────────────────────────────────────────────────────
    SERVICE_NAME: str = "zyra-ai-gateway"
    SERVICE_PORT: int = Field(default=8000, alias="ZYRA_AI_PORT")
    ENVIRONMENT: str = Field(default="development")

    # ── Ollama ───────────────────────────────────────────────────────────────
    OLLAMA_URL: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="llama3.2:3b")
    OLLAMA_EMBEDDING_MODEL: str = Field(default="nomic-embed-text")
    OLLAMA_TIMEOUT: float = Field(default=120.0)
    OLLAMA_MAX_RETRIES: int = Field(default=2)
    OLLAMA_REQUEST_TIMEOUT: float = Field(default=100.0)

    # ── OpenAI-compatible API ────────────────────────────────────────────────
    OPENAI_API_KEY: str = Field(default="")
    OPENAI_MODEL: str = Field(default="gpt-4o-mini")

    # ── Anthropic ────────────────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = Field(default="")
    ANTHROPIC_MODEL: str = Field(default="claude-3-haiku-20240307")

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(default="")
    ZYRA_DATABASE_URL: str = Field(default="")
    DATABASE_URL_PROD: str = Field(default="")

    # ── AI Provider ──────────────────────────────────────────────────────────
    # One of: "ollama", "openai", "anthropic"
    AI_PROVIDER: str = Field(default="ollama")

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = Field(default="http://localhost:3000,http://localhost:3001")

    # ── Agent defaults ───────────────────────────────────────────────────────
    DEFAULT_AGENT_MODEL: str = Field(default="")
    AGENT_MAX_CONTEXT_TOKENS: int = Field(default=4096)
    AGENT_TEMPERATURE: float = Field(default=0.7)

    @property
    def resolved_ollama_url(self) -> str:
        return self.OLLAMA_URL.rstrip("/")

    @property
    def resolved_ollama_model(self) -> str:
        return self.DEFAULT_AGENT_MODEL or self.OLLAMA_MODEL

    @property
    def resolved_ollama_embedding_model(self) -> str:
        return self.OLLAMA_EMBEDDING_MODEL

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def database_url_resolved(self) -> str:
        return (
            self.ZYRA_DATABASE_URL
            or self.DATABASE_URL_PROD
            or self.DATABASE_URL
            or ""
        )

    @property
    def active_provider(self) -> str:
        return self.AI_PROVIDER.lower()


@lru_cache
def get_settings() -> Settings:
    return Settings()
