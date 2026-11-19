"""Orchestrator: drives the contract §1 state machine for one job.

QUEUED → PLANNING → CODING → RENDERING → COMPOSING → VALIDATING → COMPLETED
(any business stage → FAILED; QUEUED/PLANNING → CANCELLED; substatus
REPAIRING_CODE during targeted repairs).

Progress estimation: PLANNING 10, CODING 25, RENDERING 25–75 (by scene),
COMPOSING 85, VALIDATING 95, COMPLETED 100.

One task_events row per stage transition; the cancel flag is polled at every
stage boundary (the cancel endpoint only accepts QUEUED/PLANNING, so a flag
set during that window is honored at the next boundary).
"""
from __future__ import annotations

import json
import time
import traceback
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.errors import CoderError, ComposeError, ErrorCode, PlanError, RenderError
from app.models import db as db_mod
from app.models.db import Job, Scene, TaskEvent, utcnow
from app.services import coder as coder_svc
from app.services import composer as composer_svc
from app.services import fixer as fixer_svc
from app.services import planner as planner_svc
from app.tools import manim_runner, storage
from app.tools.ffmpeg_runner import validate_video

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}


# ------------------------------------------------------------------ primitives
def _commit_job(session: Session, job: Job) -> None:
    job.updated_at = utcnow()
    session.add(job)
    session.commit()


def _transition(session: Session, job: Job, to_status: str,
                event_type: str = "STAGE", detail: dict | None = None) -> None:
    session.add(TaskEvent(
        job_id=job.id,
        event_type=event_type,
        from_status=job.status,
        to_status=to_status,
        detail_json=json.dumps(detail, ensure_ascii=False) if detail else None,
    ))
    job.status = to_status
    _commit_job(session, job)


def _fail(session: Session, job: Job, code: str, message: str) -> None:
    job.error_code = code
    job.error_message = message[:2000]
    job.substatus = None
    _transition(session, job, "FAILED", event_type="TERMINAL",
                detail={"code": code, "message": message[:500]})


def _cancel(session: Session, job: Job) -> None:
    job.substatus = None
    _transition(session, job, "CANCELLED", event_type="CANCEL",
                detail={"cancel_requested": True})


def _cancel_flag(session: Session, job_id: str) -> bool:
    """Fresh DB read so a flag written by the API is always observed."""
    return bool(session.execute(
        select(Job.cancel_requested).where(Job.id == job_id)
    ).scalar())


def run_job(job_id: str, session_factory: sessionmaker | None = None) -> None:
    """Execute a queued job to a terminal state. Safe to call on a job that is
    not QUEUED (it will only honor a pending cancel flag, then return)."""
    factory = session_factory or db_mod.session_factory()
    session = factory()
    started = time.monotonic()
    try:
        job = session.get(Job, job_id)
        if job is None or job.status in TERMINAL_STATUSES:
            return
        if _cancel_flag(session, job.id):
            _cancel(session, job)
            return
        if job.status != "QUEUED":
            # P0 has no mid-flight resume; state persisted at the last boundary.
            return

        try:
            plan = _stage_planning(session, job, started)
            if _aborted(session, job, started):
                return
            _stage_coding(session, job, plan, started)
            if _aborted(session, job, started):
                return
            _stage_rendering(session, job, started)
            if _aborted(session, job, started):
                return
            _stage_composing(session, job, started)
            if _aborted(session, job, started):
                return
            _stage_validating(session, job, started)
        except PlanError as exc:
            _fail(session, job, exc.code.value, exc.message)
        except CoderError as exc:
            _fail(session, job, exc.code.value, exc.message)
        except RenderError as exc:
            _fail(session, job, ErrorCode.FAILED_RENDER.value, exc.message)
        except ComposeError as exc:
            _fail(session, job, ErrorCode.FAILED_COMPOSE.value, exc.message)
        except (_Cancelled):
            pass  # terminal state (CANCELLED) already recorded
        except (_Timeout):
            _fail(session, job, ErrorCode.INTERNAL.value,
                  f"job exceeded MAX_JOB_SECONDS={settings.MAX_JOB_SECONDS}")
        except Exception as exc:  # noqa: BLE001 — always reach a terminal state
            _fail(session, job, ErrorCode.INTERNAL.value,
                  f"unexpected orchestrator error: {exc}: {traceback.format_exc(limit=3)}")
    finally:
        session.close()


def _timed_out(started: float) -> bool:
    return (time.monotonic() - started) > settings.MAX_JOB_SECONDS


def _aborted(session: Session, job: Job, started: float) -> bool:
    """Check cancel flag + wall-clock budget at a stage boundary."""
    if _cancel_flag(session, job.id):
        _cancel(session, job)
        return True
    if _timed_out(started):
        _fail(session, job, ErrorCode.INTERNAL.value,
              f"job exceeded MAX_JOB_SECONDS={settings.MAX_JOB_SECONDS}")
        return True
    return False


# ---------------------------------------------------------------------- stages
def _stage_planning(session: Session, job: Job, started: float) -> dict:
    _transition(session, job, "PLANNING")
    job.progress_percent = 10
    _commit_job(session, job)

    plan = planner_svc.generate_lesson_plan(session, job)

    jdir = storage.job_dir(job.id)
    plan_path = storage.write_json(jdir / "lesson_plan.json", plan)
    storage.register_artifact(session, job.id, "lesson_plan", plan_path)

    job.scene_count = len(plan["scenes"])
    job.current_scene = None
    for spec in plan["scenes"]:
        session.add(Scene(
            job_id=job.id,
            scene_id=spec["scene_id"],
            order=spec["order"],
            concept=spec.get("concept", ""),
            narration=spec.get("narration", ""),
            visual_instructions=spec.get("visual_instructions", ""),
            estimated_seconds=float(spec.get("estimated_seconds") or 0),
            required_objects_json=json.dumps(spec.get("required_objects") or [], ensure_ascii=False),
        ))
    _commit_job(session, job)
    return plan


def _stage_coding(session: Session, job: Job, plan: dict, started: float) -> None:
    _transition(session, job, "CODING")
    job.progress_percent = 25
    _commit_job(session, job)

    scenes = session.query(Scene).filter(Scene.job_id == job.id).order_by(Scene.order).all()
    prev_code = None
    for i, scene in enumerate(scenes, start=1):
        if _cancel_flag(session, job.id):
            _cancel(session, job)
            raise _Cancelled()
        if _timed_out(started):
            raise _Timeout()
        job.current_scene = i
        code = coder_svc.generate_scene_code(session, job.id, scene, plan, prev_code=prev_code)
        prev_code = code
        sdir = storage.scene_dir(job.id, scene.scene_id)
        version = storage.next_source_version(sdir)
        source_path = storage.write_text(sdir / f"source_v{version}.py", code)
        scene.code_version = version
        scene.source_path = str(source_path.resolve())
        storage.write_json(sdir / "scene_meta.json", {
            "scene_id": scene.scene_id,
            "estimated_seconds": scene.estimated_seconds,
            "version": version,
        })
        _commit_job(session, job)


def _stage_rendering(session: Session, job: Job, started: float) -> None:
    _transition(session, job, "RENDERING")
    scenes = session.query(Scene).filter(Scene.job_id == job.id).order_by(Scene.order).all()
    total = len(scenes)

    for i, scene in enumerate(scenes, start=1):
        if _cancel_flag(session, job.id):
            _cancel(session, job)
            raise _Cancelled()
        if _timed_out(started):
            raise _Timeout()
        job.current_scene = i
        _commit_job(session, job)

        sdir = storage.scene_dir(job.id, scene.scene_id)
        source_path = Path(scene.source_path) if scene.source_path else None
        if source_path is None or not source_path.exists():
            raise RenderError(f"scene {scene.scene_id}: source file missing")

        fixes_used = 0
        result = manim_runner.render(sdir, source_path)
        while not result.ok and fixes_used < settings.MAX_RENDER_RETRIES:
            # targeted repair: error summary + last 100 log lines + source + spec
            job.substatus = "REPAIRING_CODE"
            _commit_job(session, job)
            repaired = fixer_svc.repair_scene_code(
                session, job.id, scene,
                source_code=source_path.read_text(encoding="utf-8"),
                error_summary=result.error_summary,
                log_tail=fixer_svc.log_tail_of(result.log, 100),
            )
            version = storage.next_source_version(sdir)
            source_path = storage.write_text(sdir / f"source_v{version}.py", repaired)
            scene.code_version = version
            scene.source_path = str(source_path.resolve())
            _commit_job(session, job)
            fixes_used += 1
            result = manim_runner.render(sdir, source_path)

        if not result.ok:
            raise RenderError(
                f"scene {scene.scene_id} failed after "
                f"{1 + fixes_used} render attempt(s): {result.error_summary}"
            )

        job.substatus = None
        scene.render_status = "ok"
        scene.video_path = str(result.mp4_path.resolve())
        storage.register_artifact(session, job.id, "scene_video", result.mp4_path,
                                  scene_id=scene.scene_id, version=scene.code_version)
        storage.register_artifact(session, job.id, "scene_code", source_path,
                                  scene_id=scene.scene_id, version=scene.code_version)
        storage.register_artifact(session, job.id, "render_log", sdir / "render.log",
                                  scene_id=scene.scene_id)
        job.progress_percent = 25 + int(50 * i / max(total, 1))
        _commit_job(session, job)


def _stage_composing(session: Session, job: Job, started: float) -> None:
    _transition(session, job, "COMPOSING")
    job.progress_percent = 85
    job.current_scene = None
    _commit_job(session, job)

    scenes = session.query(Scene).filter(Scene.job_id == job.id).order_by(Scene.order).all()
    videos = [Path(s.video_path) for s in scenes if s.video_path]
    missing = [s.scene_id for s in scenes if not s.video_path]
    if missing:
        raise ComposeError(f"missing rendered videos for scenes: {', '.join(missing)}")

    jdir = storage.job_dir(job.id)
    info = composer_svc.compose(videos, jdir / "final.mp4", jdir / "compose",
                                timeout=settings.RENDER_TIMEOUT_SECONDS)
    storage.register_artifact(session, job.id, "final_video", jdir / "final.mp4")


def _stage_validating(session: Session, job: Job, started: float) -> None:
    _transition(session, job, "VALIDATING")
    job.progress_percent = 95
    _commit_job(session, job)

    final = storage.job_dir(job.id) / "final.mp4"
    ok, reason, info = validate_video(final, expect_size=composer_svc.TARGET_SIZE)
    if not ok:
        raise ComposeError(f"final video validation failed: {reason}")

    storage.write_manifest(session, job.id)
    job.progress_percent = 100
    job.current_scene = None
    _transition(session, job, "COMPLETED", event_type="STAGE",
                detail={"duration_seconds": info.get("duration_seconds")})


class _Cancelled(Exception):
    """Internal: unwind after cancellation was recorded."""


class _Timeout(Exception):
    """Internal: unwind after timeout failure was recorded."""
