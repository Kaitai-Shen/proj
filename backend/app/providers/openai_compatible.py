"""OpenAI-compatible LLM client wrapper (DeepSeek by default).

Services call ``get_llm_client().chat(...)``; tests monkeypatch
``LLMClient.chat`` as a class attribute so every service is intercepted.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

from openai import OpenAI

from app.core.config import settings
from app.core.errors import ErrorCode, PlanError


class LLMError(Exception):
    """Raised for any upstream/model-availability problem."""

    def __init__(self, message: str, code: ErrorCode = ErrorCode.MODEL_UPSTREAM) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass
class ChatResult:
    text: str
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    duration_ms: int


class LLMClient:
    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        self.base_url = base_url or settings.LLM_BASE_URL
        self.api_key = api_key if api_key is not None else settings.LLM_API_KEY
        self.model = model or settings.LLM_MODEL
        self.timeout = timeout
        self._client: OpenAI | None = None

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if not self.api_key:
                raise LLMError(
                    "LLM_API_KEY is not configured; cannot call the model provider"
                )
            self._client = OpenAI(
                base_url=self.base_url, api_key=self.api_key, timeout=self.timeout
            )
        return self._client

    def chat(
        self,
        *,
        system: str,
        user: str,
        json_mode: bool = True,
        temperature: float = 0.4,
    ) -> ChatResult:
        """One chat completion. Raises LLMError on empty key / network / API error."""
        started = time.monotonic()
        try:
            kwargs: dict = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": temperature,
                "timeout": self.timeout,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = self.client.chat.completions.create(**kwargs)
        except LLMError:
            raise
        except Exception as exc:  # openai SDK raises many types; normalize
            raise LLMError(f"LLM upstream call failed: {exc}") from exc
        text = (resp.choices[0].message.content or "") if resp.choices else ""
        usage = getattr(resp, "usage", None)
        return ChatResult(
            text=text,
            model=getattr(resp, "model", self.model) or self.model,
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            duration_ms=int((time.monotonic() - started) * 1000),
        )


_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client


def reset_llm_client() -> None:
    global _client
    _client = None


# Convenience re-export for services: PlanError carries MODEL_UPSTREAM/FAILED_PLAN codes.
__all__ = [
    "ChatResult",
    "LLMClient",
    "LLMError",
    "PlanError",
    "get_llm_client",
    "reset_llm_client",
]
