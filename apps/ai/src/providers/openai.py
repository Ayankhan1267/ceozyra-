"""
ZYRA AI Gateway — OpenAI provider implementation
Placeholder for future OpenAI integration.
Requires OPENAI_API_KEY env var.
"""

from __future__ import annotations

import logging

from providers.base import (
    AIProvider,
    AIProviderError,
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    ModelInfo,
    ModelListResponse,
)

logger = logging.getLogger("zyra.providers.openai")


class OpenAIProvider(AIProvider):
    name = "openai"
    _api_key: str = ""
    _default_model: str = "gpt-4o-mini"

    def __init__(
        self,
        api_key: str = "",
        default_model: str = "gpt-4o-mini",
    ):
        self._api_key = api_key
        self._default_model = default_model

    def _resolve_model(self, request: ChatCompletionRequest) -> str:
        return request.model or self._default_model

    async def chat(self, request: ChatCompletionRequest):
        if not self._api_key:
            raise AIProviderError(
                "OpenAI API key not configured. Set OPENAI_API_KEY.",
                status_code=500,
                provider="openai",
            )
        model = self._resolve_model(request)

        try:
            import openai  # type: ignore

            client = openai.AsyncOpenAI(api_key=self._api_key)
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                stream=request.stream,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )

            if request.stream:
                return self._stream_response(response)

            return ChatCompletionResponse(
                id=response.id,
                model=response.model,
                choices=[
                    {
                        "index": c.index,
                        "message": {
                            "role": c.message.role,
                            "content": c.message.content or "",
                        },
                        "finish_reason": c.finish_reason,
                    }
                    for c in response.choices
                ],
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
            )
        except ImportError:
            raise AIProviderError(
                "openai package not installed. Run: pip install openai",
                status_code=500,
                provider="openai",
            )
        except Exception as exc:
            raise AIProviderError(
                f"OpenAI API error: {exc}",
                status_code=500,
                provider="openai",
            ) from exc

    async def _stream_response(self, response):
        async for chunk in response:
            yield ChatCompletionChunk(
                id=chunk.id,
                model=chunk.model,
                choices=[
                    {
                        "index": c.index,
                        "delta": {"content": c.delta.content or ""},
                        "finish_reason": c.finish_reason,
                    }
                    for c in chunk.choices
                ],
            )

    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        if not self._api_key:
            raise AIProviderError(
                "OpenAI API key not configured.",
                status_code=500,
                provider="openai",
            )

        try:
            import openai  # type: ignore

            client = openai.AsyncOpenAI(api_key=self._api_key)
            texts = [request.input] if isinstance(request.input, str) else request.input
            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=texts,
            )
            return EmbeddingResponse(
                model="text-embedding-3-small",
                data=[
                    {
                        "object": "embedding",
                        "embedding": item.embedding,
                        "index": i,
                    }
                    for i, item in enumerate(response.data)
                ],
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                },
            )
        except ImportError:
            raise AIProviderError(
                "openai package not installed. Run: pip install openai",
                status_code=500,
                provider="openai",
            )
        except Exception as exc:
            raise AIProviderError(
                f"OpenAI embeddings error: {exc}",
                status_code=500,
                provider="openai",
            ) from exc

    async def list_models(self) -> ModelListResponse:
        return ModelListResponse(
            data=[
                ModelInfo(id="gpt-4o", owned_by="openai"),
                ModelInfo(id="gpt-4o-mini", owned_by="openai"),
                ModelInfo(id="text-embedding-3-small", owned_by="openai"),
            ]
        )

    async def health(self) -> dict:
        if not self._api_key:
            return {"status": "unconfigured", "provider": "openai"}
        return {"status": "configured", "provider": "openai"}
