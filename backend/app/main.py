"""FastAPI application assembly (AI Tutor Video gateway, contract v1.0)."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.api import artifacts as artifacts_api
from app.api import health as health_api
from app.api import jobs as jobs_api
from app.core.config import settings
from app.core.errors import ApiError, ErrorCode
from app.core.request_context import current_request_id, new_request_id, set_request_id
from app.models.db import init_engine
from app.tools import storage
from app.workers import local_worker

logger = logging.getLogger("aitv.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_engine(settings.DATABASE_URL)
    storage.ensure_dirs()
    if settings.WORKER_ENABLED:
        local_worker.start_worker()
    logger.info(
        "backend started: renderer=%s db=%s artifacts=%s",
        settings.RENDERER_MODE, settings.DATABASE_URL, settings.ARTIFACT_ROOT,
    )
    try:
        yield
    finally:
        if settings.WORKER_ENABLED:
            local_worker.stop_worker()


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Tutor Video Gateway",
        version="1.0.0",
        description="VideoGenerationGateway REST API per docs/gateway-api-contract.md v1.0",
        lifespan=lifespan,
    )

    # CORS wide open for development (frontend on :5180 calls :8000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id", "Content-Range", "Accept-Ranges"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        rid = request.headers.get("X-Request-Id") or new_request_id()
        set_request_id(rid)
        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        return response

    # ------------------------------------------------------ exception handlers
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_body(current_request_id()),
            headers={"X-Request-Id": current_request_id()},
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc):
        return JSONResponse(
            status_code=422,
            content={
                "code": ErrorCode.INVALID_INPUT.value,
                "message": "request validation failed",
                "details": {"errors": exc.errors()},
                "request_id": current_request_id(),
            },
            headers={"X-Request-Id": current_request_id()},
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc):
        return JSONResponse(
            status_code=422,
            content={
                "code": ErrorCode.INVALID_INPUT.value,
                "message": "validation failed",
                "details": {"errors": exc.errors()},
                "request_id": current_request_id(),
            },
            headers={"X-Request-Id": current_request_id()},
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "code": ErrorCode.INTERNAL.value,
                "message": "internal server error",
                "details": {"error": str(exc)[:500]},
                "request_id": current_request_id(),
            },
            headers={"X-Request-Id": current_request_id()},
        )

    @app.get("/")
    def root() -> dict:
        return {
            "name": "AI Tutor Video Gateway",
            "api": "/api/v1",
            "request_id": current_request_id(),
        }

    app.include_router(health_api.router)
    app.include_router(jobs_api.router)
    app.include_router(artifacts_api.router)
    return app


app = create_app()
