"""Health probes: /api/v1/health/live and /api/v1/health/ready."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.core.request_context import current_request_id

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("/live")
def live() -> dict:
    return {"ok": True, "request_id": current_request_id()}


@router.get("/ready")
def ready() -> dict:
    return {
        "ok": True,
        "renderer": settings.RENDERER_MODE,
        "request_id": current_request_id(),
    }
