"""Fixer agent: targeted repair of one failing scene after a render failure.

Context given to the model: render error summary + last 100 log lines + the
current source + the scene spec. Only this scene is repaired; each fix is
saved as a new source version. The orchestrator caps fixes at
MAX_RENDER_RETRIES (default 2, i.e. 3 renders total).
"""
from __future__ import annotations

import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import CoderError, ErrorCode
from app.models.db import ModelCall, Scene
from app.providers.openai_compatible import ChatResult, LLMError, get_llm_client
from app.services.coder import CODER_PROMPT_VERSION, extract_code, static_guard

FIXER_PROMPT_VERSION = "FIXER_PROMPT_V1"

FIXER_PROMPT_V1 = f"""\
You are the Fixer agent of AI Tutor Video ({FIXER_PROMPT_VERSION}, built on \
Coder prompt {CODER_PROMPT_VERSION}).
A Manim scene failed to render. You receive: the render error summary, the tail \
of the render log, the current Python source, and the storyboard spec for this \
scene. Repair ONLY this scene so it renders with Manim Community 0.19.

Rules:
- Return the COMPLETE corrected source in a single ```python fenced block (no prose).
- Keep the public class name ``GeneratedScene`` and construct() signature.
- Only ``manim`` imports plus the standard-library ``math`` module; no network, \
no os/sys/subprocess, no environment variables, no file IO.
- Prefer simplifying the failing animation over exotic constructs.
"""


def build_repair_user_prompt(scene: Scene, source_code: str, error_summary: str,
                             log_tail: str) -> str:
    return (
        f"## Scene spec\n"
        f"scene_id: {scene.scene_id}\n"
        f"concept: {scene.concept}\n"
        f"narration: {scene.narration}\n"
        f"visual_instructions: {scene.visual_instructions}\n"
        f"required_objects: {', '.join(scene.required_objects) or '(none)'}\n"
        f"target duration: {scene.estimated_seconds:g}s\n\n"
        f"## Render error summary\n{error_summary}\n\n"
        f"## Render log (last 100 lines)\n{log_tail}\n\n"
        f"## Current source\n```python\n{source_code}```\n\n"
        "Return only the fixed ```python code."
    )


def repair_scene_code(
    session: Session, job_id: str, scene: Scene, source_code: str,
    error_summary: str, log_tail: str,
) -> str:
    """One targeted repair pass; returns guarded source, raises CoderError."""
    llm = get_llm_client()
    user = build_repair_user_prompt(scene, source_code, error_summary, log_tail)
    started = time.monotonic()
    try:
        result = llm.chat(system=FIXER_PROMPT_V1, user=user, json_mode=False, temperature=0.3)
    except LLMError as exc:
        session.add(ModelCall(
            job_id=job_id, agent="fixer", purpose=f"repair:{scene.scene_id}",
            model=settings.LLM_MODEL, duration_ms=int((time.monotonic() - started) * 1000),
            ok=False, error=exc.message[:2000],
        ))
        session.commit()
        raise CoderError(ErrorCode.MODEL_UPSTREAM, exc.message) from exc

    code = extract_code(result.text)
    errors = static_guard(code)
    session.add(ModelCall(
        job_id=job_id, agent="fixer", purpose=f"repair:{scene.scene_id}",
        model=result.model,
        prompt_tokens=result.prompt_tokens, completion_tokens=result.completion_tokens,
        duration_ms=int((time.monotonic() - started) * 1000),
        ok=not errors,
        error=("static guard failed: " + "; ".join(errors)) if errors else None,
    ))
    session.commit()
    if errors:
        raise CoderError(
            ErrorCode.FAILED_CODE,
            f"scene {scene.scene_id}: repaired code failed static guard: " + "; ".join(errors),
        )
    return code


def log_tail_of(log_text: str, lines: int = 100) -> str:
    return "\n".join(log_text.splitlines()[-lines:])
