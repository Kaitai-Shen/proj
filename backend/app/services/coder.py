"""Coder agent: per-scene Manim code generation.

- Fixed class name ``GeneratedScene`` (Scene subclass, construct()).
- Fixed-version prompt (CODER_PROMPT_V1): Manim Community 0.19 API + stdlib
  math only; network / os / subprocess / env access forbidden.
- Strips ```python fences; runs a static safety guard; violations are fed
  back for up to 2 retries, then the job fails with FAILED_CODE.
- Sources are versioned on disk (source_v{n}.py), never overwritten.
"""
from __future__ import annotations

import re
import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import CoderError, ErrorCode
from app.models.db import ModelCall, Scene
from app.providers.openai_compatible import ChatResult, LLMError, get_llm_client

CODER_PROMPT_VERSION = "CODER_PROMPT_V1"

CODER_PROMPT_V1 = f"""\
You are the Coder agent of AI Tutor Video ({CODER_PROMPT_VERSION}).
Write ONE complete, runnable Manim Community 0.19 scene for the given storyboard scene.

Hard requirements:
- Exactly one public scene class named ``GeneratedScene`` (subclass of manim Scene) \
with a ``construct(self)`` method. No other scene classes.
- Only these imports are allowed: ``manim`` (or ``from manim import *``), the Python \
standard-library ``math`` module, and nothing else.
- Strictly forbidden: any network access, ``os``/``sys``/``subprocess``/``socket``/\
``requests``/``urllib``/file IO, environment variables, ``eval``/``exec``, \
``__import__``, random file paths, or reading external data.
- Do not use LaTeX unless necessary; prefer Text(), shapes, transforms and \
self.play/self.wait. Keep the total on-screen time close to the requested duration.
- The code must run offline with Manim Community 0.19 and produce no user interaction.
- Output ONLY Python source code inside a single ```python fenced block. No prose.
"""


_FENCE_RE = re.compile(r"```(?:python)?\s*(.*?)```", re.DOTALL)
_CLASS_RE = re.compile(r"class\s+GeneratedScene\s*\(\s*Scene\s*\)")
_FORBIDDEN_PATTERNS = (
    (re.compile(r"^\s*(?:import|from)\s+(os|sys|subprocess|socket|requests|urllib|urllib2|http|shutil|pathlib|io|ctypes|multiprocessing|asyncio)\b", re.MULTILINE), "forbidden module import"),
    (re.compile(r"\b(?:os|sys)\s*\.\s*(?:environ|system|popen|exit)\b"), "forbidden os/sys access"),
    (re.compile(r"\bsubprocess\b|\bsocket\b|\brequests\b|\burllib\b"), "forbidden network/process access"),
    (re.compile(r"\b(?:eval|exec)\s*\("), "eval/exec is forbidden"),
    (re.compile(r"\b__import__\b"), "__import__ is forbidden"),
    (re.compile(r"\bopen\s*\("), "file IO is forbidden"),
)
MAX_ATTEMPTS = 3  # 1 initial + 2 retries


def extract_code(text: str) -> str:
    """Strip ```python fences; fall back to whole text when unfenced."""
    matches = _FENCE_RE.findall(text)
    if matches:
        return max(matches, key=len).strip() + "\n"
    return text.strip() + "\n"


def static_guard(code: str) -> list[str]:
    errors: list[str] = []
    if not _CLASS_RE.search(code):
        errors.append("code must define `class GeneratedScene(Scene)` with a construct() method")
    for pattern, label in _FORBIDDEN_PATTERNS:
        if pattern.search(code):
            errors.append(f"static guard violation: {label}")
    return errors


def _record_call(session: Session, job_id: str, result: ChatResult | None,
                 duration_ms: int, ok: bool, error: str | None) -> None:
    session.add(ModelCall(
        job_id=job_id, agent="coder", purpose=f"scene_code:{CODER_PROMPT_VERSION}",
        model=result.model if result else settings.LLM_MODEL,
        prompt_tokens=result.prompt_tokens if result else None,
        completion_tokens=result.completion_tokens if result else None,
        duration_ms=duration_ms, ok=ok, error=(error or None) and (error or "")[:2000],
    ))
    session.commit()


def build_scene_user_prompt(scene: Scene, lesson_plan: dict) -> str:
    return (
        f"Lesson title: {lesson_plan.get('title', '')}\n"
        f"Scene {scene.scene_id} (order {scene.order}) of {lesson_plan.get('scene_count_hint', '')}\n"
        f"concept: {scene.concept}\n"
        f"narration: {scene.narration}\n"
        f"visual_instructions: {scene.visual_instructions}\n"
        f"required_objects: {', '.join(scene.required_objects) or '(none)'}\n"
        f"target duration of this scene: {scene.estimated_seconds:g} seconds\n"
        "Return only the ```python fenced code for GeneratedScene."
    )


def generate_scene_code(
    session: Session, job_id: str, scene: Scene, lesson_plan: dict
) -> str:
    """Return guarded Manim source for one scene; raises CoderError on failure."""
    llm = get_llm_client()
    user = build_scene_user_prompt(scene, lesson_plan)
    last_errors: list[str] = []

    for _attempt in range(1, MAX_ATTEMPTS + 1):
        if last_errors:
            user = build_scene_user_prompt(scene, lesson_plan) + (
                "\n\nYour previous output violated these rules. Fix ALL of them and "
                "return the complete corrected code:\n- " + "\n- ".join(last_errors)
            )
        started = time.monotonic()
        try:
            result = llm.chat(system=CODER_PROMPT_V1, user=user, json_mode=False, temperature=0.5)
        except LLMError as exc:
            _record_call(session, job_id, None, int((time.monotonic() - started) * 1000), False, exc.message)
            raise CoderError(ErrorCode.MODEL_UPSTREAM, exc.message) from exc

        code = extract_code(result.text)
        errors = static_guard(code)
        if not errors:
            _record_call(session, job_id, result, int((time.monotonic() - started) * 1000), True, None)
            return code
        last_errors = errors
        _record_call(session, job_id, result, int((time.monotonic() - started) * 1000), False,
                     "static guard failed: " + "; ".join(errors))

    raise CoderError(
        ErrorCode.FAILED_CODE,
        f"scene {scene.scene_id}: generated code failed static guard after "
        f"{MAX_ATTEMPTS} attempts: " + "; ".join(last_errors),
    )
