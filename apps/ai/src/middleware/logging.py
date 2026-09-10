"""
ZYRA AI Gateway — Request logging middleware
Logs all incoming requests with timing and status.
"""

from __future__ import annotations

import logging
import time
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("zyra.gateway.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.monotonic()
        request_id = request.headers.get("x-request-id", "-")
        tenant_id = request.headers.get("x-tenant-id", "-")

        logger.info(
            "REQUEST  method=%s path=%s client=%s request_id=%s tenant=%s",
            request.method,
            request.url.path,
            request.client.host if request.client else "?",
            request_id,
            tenant_id,
        )

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed_ms = round((time.monotonic() - start) * 1000, 1)
            logger.error(
                "ERROR    method=%s path=%s error=%s elapsed_ms=%s request_id=%s tenant=%s",
                request.method,
                request.url.path,
                str(exc)[:200],
                elapsed_ms,
                request_id,
                tenant_id,
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )

        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        logger.info(
            "RESPONSE method=%s path=%s status=%d elapsed_ms=%s request_id=%s tenant=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
            tenant_id,
        )

        response.headers["x-request-id"] = request_id
        response.headers["x-process-time"] = str(elapsed_ms)
        return response
