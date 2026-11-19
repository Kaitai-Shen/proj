"""Unified error body + error-code enum per gateway contract v1.0 §0/§1.

Every error response is ``{"code", "message", "details"?, "request_id"}``.
Codes from contract §1: INVALID_INPUT | FAILED_PLAN | FAILED_CODE |
FAILED_RENDER | FAILED_COMPOSE | MODEL_UPSTREAM | INTERNAL.
Supplementary API-only codes (contract §4 mandates NOT_READY for storyboard;
NOT_FOUND is used for missing job/artifact resources).
"""
from __future__ import annotations

from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    # contract §1
    INVALID_INPUT = "INVALID_INPUT"
    FAILED_PLAN = "FAILED_PLAN"
    FAILED_CODE = "FAILED_CODE"
    FAILED_RENDER = "FAILED_RENDER"
    FAILED_COMPOSE = "FAILED_COMPOSE"
    MODEL_UPSTREAM = "MODEL_UPSTREAM"
    INTERNAL = "INTERNAL"
    # API-level supplementary codes
    NOT_READY = "NOT_READY"      # storyboard not generated yet (contract §4)
    NOT_FOUND = "NOT_FOUND"      # job / artifact does not exist (or ownership mismatch)


class ApiError(Exception):
    """Raise anywhere in request handling to produce a contract-shaped error."""

    def __init__(
        self,
        status_code: int,
        code: ErrorCode | str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code.value if isinstance(code, ErrorCode) else str(code)
        self.message = message
        self.details = details
        super().__init__(f"[{self.code}] {message}")

    def to_body(self, request_id: str | None) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details is not None:
            body["details"] = self.details
        if request_id:
            body["request_id"] = request_id
        return body


class PlanError(Exception):
    """Planner failure. ``code`` is FAILED_PLAN or MODEL_UPSTREAM."""

    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class CoderError(Exception):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class RenderError(Exception):
    def __init__(self, message: str, detail: str | None = None) -> None:
        self.message = message
        self.detail = detail
        super().__init__(message)


class ComposeError(Exception):
    def __init__(self, message: str, detail: str | None = None) -> None:
        self.message = message
        self.detail = detail
        super().__init__(message)
