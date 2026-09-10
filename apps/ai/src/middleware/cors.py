"""
ZYRA AI Gateway — CORS configuration
"""

from __future__ import annotations

from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings


def setup_cors(app) -> None:
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["x-request-id", "x-process-time"],
    )
