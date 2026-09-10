"""
ZYRA AI Gateway — Provider abstraction layer
Defines the protocol that all LLM providers must implement.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator, Protocol

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "system" | "user" | "assistant"
    content: str


class ChatCompletionRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    stream: bool = False
    temperature: float = 0.7
    max_tokens: int | None = None


class ChatCompletionChunk(BaseModel):
    """A single streaming chunk."""
    id: str = ""
    object: str = "chat.completion.chunk"
    model: str = ""
    choices: list[dict] = []


class ChatCompletionResponse(BaseModel):
    """Full non-streaming response."""
    id: str
    object: str = "chat.completion"
    model: str
    choices: list[dict]
    usage: dict | None = None


class EmbeddingRequest(BaseModel):
    input: str | list[str]
    model: str | None = None


class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: list[dict]
    model: str
    usage: dict


class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    owned_by: str = "ollama"


class ModelListResponse(BaseModel):
    object: str = "list"
    data: list[ModelInfo]


class AIProviderError(Exception):
    def __init__(self, message: str, status_code: int = 500, provider: str = "unknown"):
        super().__init__(message)
        self.status_code = status_code
        self.provider = provider


class AIProvider(ABC):
    """Abstract base class for all AI providers."""

    name: str = "base"

    @abstractmethod
    async def chat(
        self,
        request: ChatCompletionRequest,
    ) -> ChatCompletionResponse | AsyncIterator[ChatCompletionChunk]:
        """Send a chat completion request."""

    @abstractmethod
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Generate embeddings for the given text."""

    @abstractmethod
    async def list_models(self) -> ModelListResponse:
        """List available models."""

    @abstractmethod
    async def health(self) -> dict:
        """Check if the provider is reachable."""
