"""
ZYRA AI Gateway — Anthropic provider implementation
Placeholder for future Anthropic Claude integration.
Requires ANTHROPIC_API_KEY env var.
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

logger = logging.getLogger("zyra.providers.anthropic")


class AnthropicProvider(AIProvider):
    name = "anthropic"
    _api_key: str = ""
    _default_model: str = "claude-3-haiku-20240307"

    def __init__(
        self,
        api_key: str = "",
        default_model: str = "claude-3-haiku-20240307",
    ):
        self._api_key = api_key
        self._default_model = default_model

    def _resolve_model(self, request: ChatCompletionRequest) -> str:
        return request.model or self._default_model

    async def chat(self, request: ChatCompletionRequest):
        if not self._api_key:
            raise AIProviderError(
                "Anthropic API key not configured. Set ANTHROPIC_API_KEY.",
                status_code=500,
                provider="anthropic",
            )
        model = self._resolve_model(request)

        system_prompt = None
        user_messages: list[dict] = []
        for msg in request.messages:
            if msg.role == "system":
                system_prompt = msg.content
            else:
                user_messages.append({"role": msg.role, "content": msg.content})

        try:
            import anthropic  # type: ignore

            client = anthropic.AsyncAnthropic(api_key=self._api_key)
            response = await client.messages.create(
                model=model,
                max_tokens=request.max_tokens or 1024,
                temperature=request.temperature,
                system=system_prompt,
                messages=user_messages,
            )

            return ChatCompletionResponse(
                id=response.id,
                model=response.model,
                choices=[
                    {
                        "index": 0,
                        "message": {
                            "role": response.role,
                            "content": response.content[0].text,
                        },
                        "finish_reason": response.stop_reason,
                    }
                ],
                usage={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
                },
            )
        except ImportError:
            raise AIProviderError(
                "anthropic package not installed. Run: pip install anthropic",
                status_code=500,
                provider="anthropic",
            )
        except Exception as exc:
            raise AIProviderError(
                f"Anthropic API error: {exc}",
                status_code=500,
                provider="anthropic",
            ) from exc

    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        raise AIProviderError(
            "Embeddings not yet supported for Anthropic provider.",
            status_code=501,
            provider="anthropic",
        )

    async def list_models(self) -> ModelListResponse:
        return ModelListResponse(
            data=[
                ModelInfo(id="claude-3-haiku-20240307", owned_by="anthropic"),
                ModelInfo(id="claude-3-sonnet-20240229", owned_by="anthropic"),
                ModelInfo(id="claude-3-opus-20240229", owned_by="anthropic"),
            ]
        )

    async def health(self) -> dict:
        if not self._api_key:
            return {"status": "unconfigured", "provider": "anthropic"}
        return {"status": "configured", "provider": "anthropic"}
