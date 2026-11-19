"""Coder agent: per-scene Manim code generation.

- Fixed class name ``GeneratedScene`` (Scene subclass, construct()).
- Fixed-version prompt (CODER_PROMPT_V3): Manim Community 0.19 API + stdlib
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

CODER_PROMPT_VERSION = "CODER_PROMPT_V3"

CODER_PROMPT_V3 = f"""\
You are the Coder agent of AI Tutor Video ({CODER_PROMPT_VERSION}).
Write ONE complete, runnable Manim Community 0.19 scene for the given storyboard scene.
The scene is part of ONE continuous lesson video; the user message contains the full
storyboard, a shared canvas spec, and the previous scene's source code.

Hard requirements (safety):
- Exactly one public scene class named ``GeneratedScene`` (subclass of manim Scene) \
with a ``construct(self)`` method. No other scene classes.
- Only these imports are allowed: ``manim`` (or ``from manim import *``), the Python \
standard-library ``math`` module, and nothing else.
- Strictly forbidden: any network access, ``os``/``sys``/``subprocess``/``socket``/\
``requests``/``urllib``/file IO, environment variables, ``eval``/``exec``, \
``__import__``, random file paths, or reading external data.
- The code must run offline with Manim Community 0.19 and produce no user interaction.
- Output ONLY Python source code inside a single ```python fenced block. No prose.

Visual quality contract:
- Follow the shared canvas spec EXACTLY: same layout zones, same coordinate system \
parameters, same palette and font sizes as the other scenes, so objects align across cuts.
- If previous-scene code is provided: quickly rebuild its ENDING visual state (no or very \
brief animation), then continue evolving it. Reuse its construction parameters verbatim \
where objects persist. Never start from an empty canvas when continuing.
- Show the lesson title ONLY if this is scene 1. Later scenes use at most a small section \
label; never re-display the full title.
- At least 3 distinct animation beats. Prefer evolving objects (Transform, \
ReplacementTransform, TransformMatchingTex, Indicate, Circumscribe, MoveAlongPath, \
.animate) over fade-in-then-static. Every beat must serve the narration.
- CONTENT FIRST: when a formula appears, animate the MEANING of its terms, not just \
the symbols — e.g. show boundary contributions accumulating for a line integral, \
micro-rotations summing over a region for a double integral, one side transforming \
into the other to show WHY they are equal. The user message contains concept notes \
explaining what each side measures; your visuals must make that meaning visible.
- Total self.wait() time must be <= 20% of the scene duration. Fill time with meaningful \
motion, never static padding.
- Use MathTex for formulas (LaTeX is available in the renderer). For Chinese text use \
Text(..., font="Noto Sans CJK SC"). At 1080p: Text font_size >= 24, MathTex font_size >= 36.
- Keep every object inside the frame and inside its layout zone; no overlapping text, \
no objects drifting off-screen.
- Match the requested scene duration with animation content.
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


def build_scene_user_prompt(
    scene: Scene, lesson_plan: dict, prev_code: str | None = None
) -> str:
    """Rich per-scene prompt: full storyboard context + shared canvas + previous code.

    The coder must see the whole lesson to keep visual and narrative continuity;
    the previous scene's source lets it rebuild the ending state exactly.
    """
    scenes = lesson_plan.get("scenes") or []
    spec = next((s for s in scenes if s.get("scene_id") == scene.scene_id), {})
    total = len(scenes)

    overview = "\n".join(
        f"  {s.get('order')}. {s.get('concept', '')} — {s.get('narration', '')}"
        for s in scenes
    )
    prev_section = (
        "（本场景是全片第一个场景，由你建立共享画布。）"
        if not prev_code
        else (
            "以下是前一场景的完整源码。快速重建它结束时的视觉状态（不做或只做极短动画），"
            "复用其中的构造参数使对象位置逐像素对齐，然后继续演化：\n"
            f"```python\n{prev_code}\n```"
        )
    )
    continuity = spec.get("continuity") or "（分镜未提供，按全片分镜推断应继承的视觉状态）"
    concept_notes = lesson_plan.get("concept_notes") or ""
    notes_section = (
        f"# 概念讲解要点（动画必须把这些含义可视化，而不是只把公式写在屏幕上）\n{concept_notes}\n\n"
        if concept_notes else ""
    )

    return (
        f"# 课程总览\n"
        f"标题：{lesson_plan.get('title', '')}\n"
        f"受众：{lesson_plan.get('audience', '')}；目标总时长：{lesson_plan.get('target_seconds', '')} 秒\n"
        f"教学目标：{'；'.join(lesson_plan.get('learning_objectives') or [])}\n\n"
        f"{notes_section}"
        f"# 全片分镜（上下文；你只实现本场景，不要越界实现其他场景的内容）\n{overview}\n\n"
        f"# 共享画布契约（所有场景必须严格遵守，保证跨场景视觉连续）\n"
        f"{lesson_plan.get('shared_canvas') or '（分镜未提供；请采用：标题带在顶部，主画布左侧约 60%，公式面板右侧约 40%；全片固定一套配色与字号）'}\n\n"
        f"# 前一场景视觉状态\n{prev_section}\n\n"
        f"# 本场景任务（scene {scene.scene_id}，第 {scene.order}/{total} 个）\n"
        f"概念：{scene.concept}\n"
        f"讲解词（配音依据，动画节拍必须与讲解内容对应）：{scene.narration}\n"
        f"画面指令（逐节拍实现）：{scene.visual_instructions}\n"
        f"跨场景继承：{continuity}\n"
        f"可用对象：{', '.join(scene.required_objects) or '(none)'}\n"
        f"本场景目标时长：{scene.estimated_seconds:g} 秒（用动画内容填满，self.wait 总计不超过 20%）\n\n"
        f"# 输出要求\n"
        f"只输出一个 ```python 代码块，包含完整的 GeneratedScene 类。"
        f"至少 3 个动画节拍；优先让已有对象演化（Transform/Indicate/animate 等），"
        f"而不是反复淡入新对象；公式用 MathTex，中文用 Text(font=\"Noto Sans CJK SC\")。"
    )


def generate_scene_code(
    session: Session, job_id: str, scene: Scene, lesson_plan: dict,
    prev_code: str | None = None,
) -> str:
    """Return guarded Manim source for one scene; raises CoderError on failure."""
    llm = get_llm_client()
    user = build_scene_user_prompt(scene, lesson_plan, prev_code)
    last_errors: list[str] = []

    for _attempt in range(1, MAX_ATTEMPTS + 1):
        if last_errors:
            user = build_scene_user_prompt(scene, lesson_plan, prev_code) + (
                "\n\nYour previous output violated these rules. Fix ALL of them and "
                "return the complete corrected code:\n- " + "\n- ".join(last_errors)
            )
        started = time.monotonic()
        try:
            result = llm.chat(system=CODER_PROMPT_V3, user=user, json_mode=False, temperature=0.5)
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
