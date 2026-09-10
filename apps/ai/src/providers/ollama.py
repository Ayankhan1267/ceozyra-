"""
ZYRA AI Gateway — Ollama provider implementation
Self-hosted LLM via Ollama REST API.
"""

from __future__ import annotations

import json
import logging
import time
from typing import AsyncIterator

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

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

logger = logging.getLogger("zyra.providers.ollama")


class OllamaProvider(AIProvider):
    name = "ollama"
    _client: httpx.AsyncClient | None = None
    _base_url: str = ""
    _default_model: str = ""
    _default_embedding_model: str = ""
    _request_timeout: float = 100.0

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        default_model: str = "llama3.2:3b",
        default_embedding_model: str = "nomic-embed-text",
        request_timeout: float = 100.0,
    ):
        self._base_url = base_url.rstrip("/")
        self._default_model = default_model
        self._default_embedding_model = default_embedding_model
        self._request_timeout = request_timeout

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    self._request_timeout,
                    connect=5.0,
                    read=self._request_timeout,
                    write=10.0,
                ),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _resolve_model(self, request: ChatCompletionRequest) -> str:
        return request.model or self._default_model

    def _messages_to_ollama(
        self, messages: list[ChatMessage]
    ) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in messages]

    @retry(
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, AIProviderError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        before_sleep=lambda rs: logger.warning(
            "Ollama request retry %s/%s: %s",
            rs.attempt_number,
            3,
            rs.outcome.exception() if rs.outcome else "unknown",
        ),
    )
    async def _post(self, path: str, payload: dict) -> dict:
        url = f"{self._base_url}/{path.lstrip('/')}"
        try:
            resp = await self.client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            error_body = ""
            try:
                error_body = exc.response.text[:500]
            except Exception:
                pass
            raise AIProviderError(
                f"Ollama HTTP {exc.response.status_code}: {error_body}",
                status_code=exc.response.status_code,
                provider="ollama",
            ) from exc
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            raise AIProviderError(
                f"Ollama connection error: {exc}",
                status_code=503,
                provider="ollama",
            ) from exc

    # ── Public API ────────────────────────────────────────────────────────────

    async def chat(
        self,
        request: ChatCompletionRequest,
    ) -> ChatCompletionResponse | AsyncIterator[ChatCompletionChunk]:
        model = self._resolve_model(request)
        payload: dict = {
            "model": model,
            "messages": self._messages_to_ollama(request.messages),
            "stream": request.stream,
            "options": {"temperature": request.temperature},
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        if request.stream:
            return self._chat_stream(model, payload)

        t0 = time.monotonic()
        data = await self._post("/api/chat", payload)
        elapsed_ms = round((time.monotonic() - t0) * 1000, 1)
        logger.debug("Ollama non-stream response received in %sms", elapsed_ms)

        message = data.get("message", {})
        return ChatCompletionResponse(
            id=data.get("id", f"ollama-{int(time.time())}"),
            model=model,
            choices=[
                {
                    "index": 0,
                    "message": {
                        "role": message.get("role", "assistant"),
                        "content": message.get("content", ""),
                    },
                    "finish_reason": "stop" if data.get("done") else "length",
                }
            ],
            usage={
                "prompt_tokens": data.get("prompt_eval_count", 0),
                "completion_tokens": data.get("eval_count", 0),
                "total_tokens": (data.get("prompt_eval_count", 0) + data.get("eval_count", 0)),
            },
        )

    async def _chat_stream(
        self, model: str, payload: dict
    ) -> AsyncIterator[ChatCompletionChunk]:
        url = f"{self._base_url}/api/chat"
        chunk_id = f"ollama-{int(time.time())}"

        async with self.client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue

                msg = data.get("message", {})
                content = msg.get("content", "")
                done = data.get("done", False)

                yield ChatCompletionChunk(
                    id=chunk_id,
                    model=model,
                    choices=[
                        {
                            "index": 0,
                            "delta": {"content": content},
                            "finish_reason": None,
                        }
                    ],
                )

                if done:
                    yield ChatCompletionChunk(
                        id=chunk_id,
                        model=model,
                        choices=[
                            {
                                "index": 0,
                                "delta": {},
                                "finish_reason": "stop",
                            }
                        ],
                    )
                    break

    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        model = request.model or self._default_embedding_model
        texts = [request.input] if isinstance(request.input, str) else list(request.input)

        embeddings: list[dict] = []
        for text in texts:
            data = await self._post("/api/embeddings", {"model": model, "prompt": text})
            embeddings.append(
                {
                    "object": "embedding",
                    "embedding": data.get("embedding", []),
                    "index": len(embeddings),
                }
            )

        return EmbeddingResponse(
            model=model,
            data=embeddings,
            usage={"prompt_tokens": sum(len(t.split()) for t in texts)},
        )

    async def list_models(self) -> ModelListResponse:
        resp = await self.client.get(f"{self._base_url}/api/tags")
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("models", []):
            models.append(
                ModelInfo(
                    id=m.get("name", ""),
                    owned_by=m.get("details", {}).get("parent_model", "ollama"),
                )
            )
        return ModelListResponse(data=models)

    async def health(self) -> dict:
        try:
            resp = await self.client.get(f"{self._base_url}/api/tags", timeout=5.0)
            resp.raise_for_status()
            return {"status": "healthy", "provider": "ollama"}
        except Exception as exc:
            logger.warning("Ollama health check failed: %s", exc)
            return {"status": "unhealthy", "provider": "ollama", "error": str(exc)}
