"""Planner agent: topic -> validated LessonPlan JSON (contract §5).

- Fixed-version system prompt (PLANNER_PROMPT_V1).
- Output strictly validated per contract §5; JSON/parse/validation failures
  are fed back to the model for up to 2 retries (3 attempts total), then the
  job fails with FAILED_PLAN. Model-availability problems fail immediately
  with MODEL_UPSTREAM.
"""
from __future__ import annotations

import json
import re
import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ErrorCode, PlanError
from app.models.db import Job, ModelCall
from app.providers.openai_compatible import ChatResult, LLMError, get_llm_client

PLANNER_PROMPT_VERSION = "PLANNER_PROMPT_V1"

PLANNER_PROMPT_V1 = (
    "You are the Planner agent of AI Tutor Video (" + PLANNER_PROMPT_VERSION + "), a system that "
    "turns a topic into a storyboard for a short Manim educational video.\n"
    'Respond with a single JSON object (no markdown) matching this schema:\n'
    "{\n"
    '  "title": str,\n'
    '  "language": "zh-CN",\n'
    '  "target_seconds": int,\n'
    '  "audience": "beginner" | "intermediate",\n'
    '  "learning_objectives": [str, ...],\n'
    '  "scenes": [\n'
    "    {\n"
    '      "scene_id": "scene_001",\n'
    '      "order": 1,\n'
    '      "concept": str,\n'
    '      "narration": str,\n'
    '      "visual_instructions": str,\n'
    '      "estimated_seconds": number,\n'
    '      "required_objects": [str, ...]\n'
    "    }\n"
    "  ]\n"
    "}\n"
    "Hard rules:\n"
    '- language is always "zh-CN"; concept/narration/visual_instructions written in Chinese.\n'
    '- 1 to 8 scenes; scene_id must match scene_\\d{3} and be unique; '
    "order starts at 1 and is consecutive.\n"
    "- 0 < estimated_seconds <= 30 for every scene.\n"
    "- The sum of estimated_seconds must be within [0.6, 1.5] x target_seconds.\n"
    "- visual_instructions must describe concrete Manim visuals (shapes, text, animations) "
    "renderable with Manim Community 0.19 primitives (no LaTeX-heavy layouts).\n"
)

_SCENE_ID_RE = re.compile(r"^scene_\d{3}$")
MAX_ATTEMPTS = 3  # 1 initial + 2 retries with feedback


def validate_lesson_plan(plan, duration_seconds: int) -> list[str]:
    """Contract §5 validation. Returns a list of error strings (empty = valid)."""
    errors: list[str] = []
    if not isinstance(plan, dict):
        return ["plan must be a JSON object"]
    if not isinstance(plan.get("title"), str) or not plan["title"].strip():
        errors.append("title must be a non-empty string")
    if not isinstance(plan.get("language"), str) or not plan["language"].strip():
        errors.append("language must be a non-empty string")
    ts = plan.get("target_seconds")
    if not isinstance(ts, (int, float)) or isinstance(ts, bool) or ts <= 0:
        errors.append("target_seconds must be a positive number")
    if plan.get("audience") not in ("beginner", "intermediate"):
        errors.append("audience must be 'beginner' or 'intermediate'")
    lo = plan.get("learning_objectives")
    if not isinstance(lo, list) or not all(isinstance(x, str) for x in lo):
        errors.append("learning_objectives must be a list of strings")

    scenes = plan.get("scenes")
    if not isinstance(scenes, list) or not (1 <= len(scenes) <= 8):
        errors.append("scenes must be a list of 1..8 scene objects")
        return errors

    seen_ids: set[str] = set()
    total = 0.0
    for idx, sc in enumerate(scenes, start=1):
        if not isinstance(sc, dict):
            errors.append(f"scene #{idx} must be an object")
            continue
        sid = sc.get("scene_id")
        if not isinstance(sid, str) or not _SCENE_ID_RE.match(sid):
            errors.append(f"scene #{idx}: scene_id must match scene_\\d{{3}}, got {sid!r}")
        elif sid in seen_ids:
            errors.append(f"duplicate scene_id {sid!r}")
        else:
            seen_ids.add(sid)
        if sc.get("order") != idx:
            errors.append(f"scene {sid or idx}: order must be {idx} (consecutive), got {sc.get('order')!r}")
        for field in ("concept", "narration", "visual_instructions"):
            if not isinstance(sc.get(field), str) or not sc[field].strip():
                errors.append(f"scene {sid or idx}: {field} must be a non-empty string")
        est = sc.get("estimated_seconds")
        if not isinstance(est, (int, float)) or isinstance(est, bool) or est <= 0:
            errors.append(f"scene {sid or idx}: estimated_seconds must be > 0")
            continue
        if est > 30:
            errors.append(f"scene {sid or idx}: estimated_seconds must be <= 30, got {est}")
        total += float(est) if est > 0 else 0.0
        ro = sc.get("required_objects")
        if not isinstance(ro, list) or not all(isinstance(x, str) for x in ro):
            errors.append(f"scene {sid or idx}: required_objects must be a list of strings")

    low = duration_seconds * 0.6
    high = duration_seconds * 1.5
    if not (low - 0.01 <= total <= high + 0.01):
        errors.append(
            f"total estimated_seconds {total:g} must be within "
            f"[{low:g}, {high:g}] (duration_seconds={duration_seconds})"
        )
    return errors


def _extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", cleaned)
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found in model output")
    return json.loads(cleaned[start : end + 1])


def _record_call(session: Session, job_id: str, result: ChatResult | None,
                 duration_ms: int, ok: bool, error: str | None) -> None:
    session.add(ModelCall(
        job_id=job_id, agent="planner",
        purpose=f"lesson_plan:{PLANNER_PROMPT_VERSION}",
        model=result.model if result else settings.LLM_MODEL,
        prompt_tokens=result.prompt_tokens if result else None,
        completion_tokens=result.completion_tokens if result else None,
        duration_ms=duration_ms or (result.duration_ms if result else 0),
        ok=ok, error=(error or None)[:2000] if error else None,
    ))
    session.commit()


def generate_lesson_plan(session: Session, job: Job) -> dict:
    """Call the LLM with retries; return a validated LessonPlan dict.

    Raises PlanError(MODEL_UPSTREAM) on provider failure,
    PlanError(FAILED_PLAN) after exhausting validation retries.
    """
    llm = get_llm_client()
    base_user = (
        f"topic: {job.topic}\n"
        f"audience: {job.audience}\n"
        f"language: {job.language}\n"
        f"duration_seconds: {job.duration_seconds}\n"
        "Return only the JSON lesson plan."
    )
    last_errors: list[str] = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        user = base_user
        if last_errors:
            user += "\n\nYour previous output failed validation. Fix ALL of these issues and return the full corrected JSON:\n- " + "\n- ".join(last_errors)
        started = time.monotonic()
        try:
            result = llm.chat(system=PLANNER_PROMPT_V1, user=user, json_mode=True, temperature=0.4)
        except LLMError as exc:
            _record_call(session, job.id, None, int((time.monotonic() - started) * 1000), False, exc.message)
            raise PlanError(ErrorCode.MODEL_UPSTREAM, exc.message) from exc

        try:
            plan = _extract_json(result.text)
        except (ValueError, json.JSONDecodeError) as exc:
            _record_call(session, job.id, result, int((time.monotonic() - started) * 1000), False, f"invalid JSON: {exc}")
            last_errors = [f"output is not a valid JSON object: {exc}"]
            continue

        errors = validate_lesson_plan(plan, job.duration_seconds)
        if not errors:
            plan.setdefault("prompt_version", PLANNER_PROMPT_VERSION)
            _record_call(session, job.id, result, int((time.monotonic() - started) * 1000), True, None)
            return plan

        last_errors = errors
        _record_call(session, job.id, result, int((time.monotonic() - started) * 1000), False,
                     "validation failed: " + "; ".join(errors)[:1800])

    raise PlanError(
        ErrorCode.FAILED_PLAN,
        f"planner output failed validation after {MAX_ATTEMPTS} attempts: "
        + "; ".join(last_errors)[:1500],
    )
