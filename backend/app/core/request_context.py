"""Per-request context: request_id carried in a ContextVar so handlers and
exception handlers can stamp it into response bodies / headers."""
from __future__ import annotations

import secrets
import contextvars

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


def new_request_id() -> str:
    return f"req_{secrets.token_hex(8)}"


def set_request_id(value: str) -> None:
    _request_id_var.set(value)


def current_request_id() -> str:
    return _request_id_var.get()
