"""Planner agent: topic -> concept explanation -> validated LessonPlan JSON.

Two stages (content first):
1. CONCEPT_PROMPT_V1: the model explains the concept to itself in depth
   (meaning of every symbol / both sides of a formula, why it holds,
   a concrete example, misconceptions) BEFORE any storyboarding.
2. PLANNER_PROMPT_V3: storyboard planning grounded in that explanation;
   output strictly validated per contract §5. JSON/parse/validation failures
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

CONCEPT_PROMPT_VERSION = "CONCEPT_PROMPT_V1"

CONCEPT_PROMPT_V1 = (
    "You are the Concept Explainer of AI Tutor Video (" + CONCEPT_PROMPT_VERSION + "). "
    "Before any video storyboarding happens, YOU must first fully understand and explain "
    "the requested concept, like an excellent teacher preparing a lesson. "
    "Write in Chinese, as plain text (no JSON, no markdown fences), with these sections:\n"
    "【一句话本质】用一句通俗的话说清这个概念到底在说什么（允许用生活化类比）。\n"
    "【公式/定义逐项拆解】如果涉及公式或定理：逐项解释每个符号、每个算子代表什么；"
    "重点解释等式两端各自度量的是什么（几何/物理意义），以及为什么它们相等——"
    "给出直观机制（例如：边界上的累积 = 内部每一点微小贡献的总和），而不是只复述公式。"
    "如果没有公式，则拆解定义的每个关键条件为什么必要。\n"
    "【为什么成立】给出目标受众能理解的推导思路或直观论证骨架（2-5 步），"
    "指出关键的一步在哪里。\n"
    "【贯穿示例】设计一个具体例子（明确的数字/函数/对象），先按定义直接算一遍，"
    "再用该概念/公式算一遍，两边结果必须一致且给出具体数值。这个例子将贯穿整个视频。\n"
    "【易错点与适用条件】1-3 条常见误解或使用前提。\n"
    "Be mathematically correct and precise; depth of understanding matters more than "
    "brevity, but keep the whole explanation under 800 Chinese characters so it can be "
    "taught within a short video."
)

PLANNER_PROMPT_VERSION = "PLANNER_PROMPT_V3"

PLANNER_PROMPT_V3 = (
    "You are the Planner agent of AI Tutor Video (" + PLANNER_PROMPT_VERSION + "), a system that "
    "turns a topic into a storyboard for a short Manim educational video. "
    "The video must feel like ONE continuous lesson taught by a great teacher, "
    "not a series of disconnected slides.\n"
    'Respond with a single JSON object (no markdown) matching this schema:\n'
    "{\n"
    '  "title": str,\n'
    '  "language": "zh-CN",\n'
    '  "target_seconds": int,\n'
    '  "audience": "beginner" | "intermediate",\n'
    '  "learning_objectives": [str, ...],\n'
    '  "shared_canvas": str,\n'
    '  "concept_notes": str,\n'
    '  "scenes": [\n'
    "    {\n"
    '      "scene_id": "scene_001",\n'
    '      "order": 1,\n'
    '      "concept": str,\n'
    '      "narration": str,\n'
    '      "visual_instructions": str,\n'
    '      "continuity": str,\n'
    '      "estimated_seconds": number,\n'
    '      "required_objects": [str, ...]\n'
    "    }\n"
    "  ]\n"
    "}\n"
    "Teaching quality rules (CONTENT IS EVERYTHING — the video must make the viewer "
    "UNDERSTAND, not just SEE):\n"
    "- The user message contains a concept explanation written by the Concept Explainer. "
    "Treat it as the source of truth for WHAT to teach. Your storyboard must teach its "
    "【公式/定义逐项拆解】 and 【为什么成立】 substance, not merely display formulas.\n"
    "- concept_notes: condense that explanation (meaning of each side of the formula, "
    "key symbols, why it holds, the worked example) into 200-400 Chinese characters; "
    "the coder will read it to design meaning-revealing animations.\n"
    "- For a formula/theorem topic, the storyboard MUST include: (a) a scene explaining "
    "what the LEFT side measures, with visuals that show that meaning (e.g. accumulating "
    "contributions along a boundary); (b) a scene explaining what the RIGHT side measures "
    "(e.g. summing micro-contributions over the interior); (c) a scene giving the intuition "
    "for WHY the two sides are equal — show the mechanism visually, not just an equals sign. "
    "Narration must speak these meanings in plain words; never just read the formula aloud.\n"
    "- Design a narrative arc: hook with a concrete question -> build intuition with a "
    "SPECIFIC worked example -> formal statement/derivation -> verify the example against "
    "the result -> takeaway. Adapt the arc to the topic, but never skip the concrete example.\n"
    "- At least one fully concrete example (specific numbers, functions, or objects) must be "
    "introduced early and carried across scenes to the end. Purely symbolic slides with no "
    "example are not acceptable.\n"
    "- Explain WHY, not just WHAT. Each scene's narration must connect to the previous scene "
    "and motivate the next one; avoid isolated fact statements.\n"
    "- Plan 4 to 8 scenes for a 45-90 second video; each scene 8-20 seconds with 3-6 "
    "animation beats. Prefer more, finer scenes over a few coarse ones.\n"
    "- shared_canvas: ONE precise visual spec that ALL scenes share, so the video looks "
    "continuous: coordinate system ranges and on-screen position, layout zones (e.g. title "
    "band at top, main canvas left ~60%, formula panel right ~40%), a palette of 3-4 named "
    "Manim colors with fixed roles, and font sizes. Write it as concrete instructions a "
    "coder can follow without guesswork.\n"
    "- continuity (per scene): which visual objects/state carry over from the previous scene "
    "and how they evolve. Scene 1 establishes the canvas; every later scene must continue "
    "on the existing canvas, never rebuild it from scratch.\n"
    "- The lesson title is shown ONLY in scene 1. Later scenes may use a small section "
    "label; they must never re-display the full title.\n"
    "- visual_instructions: a detailed shot list, one line per beat, each beat naming the "
    "object, the animation (Create/Write/Transform/ReplacementTransform/Indicate/"
    "Circumscribe/MoveAlongPath/animate...), its layout zone/position, and approximate "
    "seconds. 3-6 beats per scene.\n"
    "- narration: 2-4 sentences of natural spoken Chinese per scene, deep enough to actually "
    "teach the concept (motivate definitions, explain what each on-screen object/formula term "
    "MEANS, explain steps); it will be used for TTS.\n"
    "Hard rules:\n"
    '- language is always "zh-CN"; title/concept/narration/visual_instructions/continuity/'
    "shared_canvas written in Chinese.\n"
    '- scene_id must match scene_\\d{3} and be unique; '
    "order starts at 1 and is consecutive.\n"
    "- 0 < estimated_seconds <= 30 for every scene.\n"
    "- The sum of estimated_seconds must be within [0.6, 1.5] x target_seconds.\n"
    "- visual_instructions must describe concrete Manim visuals "
    "renderable with Manim Community 0.19 primitives.\n"
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
                 duration_ms: int, ok: bool, error: str | None,
                 purpose: str | None = None) -> None:
    session.add(ModelCall(
        job_id=job_id, agent="planner",
        purpose=purpose or f"lesson_plan:{PLANNER_PROMPT_VERSION}",
        model=result.model if result else settings.LLM_MODEL,
        prompt_tokens=result.prompt_tokens if result else None,
        completion_tokens=result.completion_tokens if result else None,
        duration_ms=duration_ms or (result.duration_ms if result else 0),
        ok=ok, error=(error or None)[:2000] if error else None,
    ))
    session.commit()


def generate_concept_notes(session: Session, job: Job) -> str:
    """Stage 1: the model explains the concept in depth before storyboarding.

    Raises PlanError(MODEL_UPSTREAM) on provider failure,
    PlanError(FAILED_PLAN) if no substantive explanation after 2 attempts.
    """
    llm = get_llm_client()
    user = (
        f"topic: {job.topic}\n"
        f"audience: {job.audience}\n"
        f"language: {job.language}\n"
        f"视频时长约 {job.duration_seconds} 秒。\n"
        "请先把这个概念本身解释清楚（按系统提示的分节输出中文纯文本）。"
    )
    last_error = ""
    for _attempt in range(2):
        if last_error:
            user += f"\n\n上次输出的问题：{last_error}。请重新输出完整、具体的概念讲解。"
        started = time.monotonic()
        try:
            result = llm.chat(system=CONCEPT_PROMPT_V1, user=user, json_mode=False, temperature=0.5)
        except LLMError as exc:
            _record_call(session, job.id, None, int((time.monotonic() - started) * 1000), False, exc.message,
                         purpose=f"concept_notes:{CONCEPT_PROMPT_VERSION}")
            raise PlanError(ErrorCode.MODEL_UPSTREAM, exc.message) from exc
        notes = result.text.strip()
        if len(notes) >= 80:
            _record_call(session, job.id, result, int((time.monotonic() - started) * 1000), True, None,
                         purpose=f"concept_notes:{CONCEPT_PROMPT_VERSION}")
            return notes
        last_error = "讲解为空或过于简短（少于 80 字），没有逐项拆解公式/定义的含义"
        _record_call(session, job.id, result, int((time.monotonic() - started) * 1000), False, last_error,
                     purpose=f"concept_notes:{CONCEPT_PROMPT_VERSION}")
    raise PlanError(ErrorCode.FAILED_PLAN, "concept explanation stage produced no substantive notes")


def generate_lesson_plan(session: Session, job: Job) -> dict:
    """Stage 1 concept explanation + stage 2 storyboard with retries.

    Raises PlanError(MODEL_UPSTREAM) on provider failure,
    PlanError(FAILED_PLAN) after exhausting validation retries.
    """
    concept_notes = generate_concept_notes(session, job)
    llm = get_llm_client()
    base_user = (
        f"topic: {job.topic}\n"
        f"audience: {job.audience}\n"
        f"language: {job.language}\n"
        f"duration_seconds: {job.duration_seconds}\n\n"
        f"# 概念讲解（Concept Explainer 已写好的深度讲解，分镜必须把这些内容教明白）\n{concept_notes}\n\n"
        "Return only the JSON lesson plan."
    )
    last_errors: list[str] = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        user = base_user
        if last_errors:
            user += "\n\nYour previous output failed validation. Fix ALL of these issues and return the full corrected JSON:\n- " + "\n- ".join(last_errors)
        started = time.monotonic()
        try:
            result = llm.chat(system=PLANNER_PROMPT_V3, user=user, json_mode=True, temperature=0.4)
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
            plan.setdefault("concept_notes", concept_notes)
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
