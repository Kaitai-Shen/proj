"""Orchestrator: drives the contract §1 state machine for one job.

QUEUED → PLANNING → CODING → RENDERING → COMPOSING → VALIDATING → COMPLETED
(any business stage → FAILED; QUEUED/PLANNING → CANCELLED; substatus
REPAIRING_CODE during targeted repairs).

Progress estimation: PLANNING 10, CODING 25, RENDERING 25–75 (by scene),
COMPOSING 85, VALIDATING 95, COMPLETED 100.

CODING and RENDERING run as one pipelined stage: scene code generation is
sequential (the coder needs the previous scene's source for visual
continuity), but each finished scene's render is dispatched immediately to a
bounded thread pool (MAX_CONCURRENT_RENDERS), overlapping renders with the
next LLM call. The external state machine is preserved: status stays CODING
until the last scene is coded, then flips to RENDERING while renders drain.

Thread boundary: render worker threads only touch scene files and record
ModelCall rows through their own session; every Job/Scene/Artifact write
stays on the job thread. Render outcomes (and REPAIRING_CODE on/off events)
travel through a queue.

One task_events row per stage transition; the cancel flag is polled at every
stage boundary (the cancel endpoint only accepts QUEUED/PLANNING, so a flag
set during that window is honored at the next boundary).
"""
from __future__ import annotations

import json
import queue
import threading
import time
import traceback
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, wait as wait_futures

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
            _stage_build(session, job, plan, started, factory)
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


def _stage_build(session: Session, job: Job, plan: dict, started: float,
                 factory: sessionmaker) -> None:
    """CODING+RENDERING as one pipelined stage (see module docstring)."""
    _transition(session, job, "CODING")
    job.progress_percent = 25
    _commit_job(session, job)

    scenes = session.query(Scene).filter(Scene.job_id == job.id).order_by(Scene.order).all()
    total = max(len(scenes), 1)
    results: queue.Queue = queue.Queue()
    abort = threading.Event()
    pool = ThreadPoolExecutor(max_workers=max(1, settings.MAX_CONCURRENT_RENDERS),
                              thread_name_prefix="aitv-render")
    futures = []
    state = {"done": 0, "repairing": 0, "failure": None, "total": total}
    prev_code = None
    try:
        # Coding phase: sequential LLM calls (prev-code continuity chain); each
        # finished scene's render is dispatched immediately, so it overlaps with
        # the next scene's LLM call.
        for i, scene in enumerate(scenes, start=1):
            _boundary(session, job, started, abort, futures)
            _drain_nowait(session, job, results, state)
            _raise_if_failed(state, abort, pool)
            job.current_scene = i
            _commit_job(session, job)

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

            futures.append(pool.submit(_render_scene_task, job.id, scene, sdir,
                                       source_path, results, abort, factory))
            _drain_nowait(session, job, results, state)
            _raise_if_failed(state, abort, pool)

        # Rendering phase: drain the pool until every scene reported an outcome.
        _transition(session, job, "RENDERING")
        while state["done"] < len(futures):
            _boundary(session, job, started, abort, futures)
            try:
                msg = results.get(timeout=0.5)
            except queue.Empty:
                continue
            _handle_result(session, job, msg, state)
            _raise_if_failed(state, abort, pool)

        job.substatus = None
        _commit_job(session, job)
    except (_Cancelled, _Timeout):
        abort.set()
        wait_futures(futures)
        pool.shutdown(wait=True)
        raise
    except BaseException:
        # Fail-fast (RenderError/CoderError) or unexpected crash: report the
        # failure immediately; in-flight renders finish on their own and their
        # results are dropped.
        abort.set()
        pool.shutdown(wait=False)
        raise
    else:
        abort.set()
        pool.shutdown(wait=True)


def _boundary(session: Session, job: Job, started: float, abort: threading.Event,
              futures: list) -> None:
    """Cancel/timeout check at an internal pipeline boundary. Both wait for
    in-flight renders so nothing leaks into the next job (matches the previous
    serial behavior where a boundary always fell between renders)."""
    if _cancel_flag(session, job.id):
        abort.set()
        wait_futures(futures)
        _cancel(session, job)
        raise _Cancelled()
    if _timed_out(started):
        abort.set()
        wait_futures(futures)
        raise _Timeout()


def _drain_nowait(session: Session, job: Job, results: queue.Queue, state: dict) -> None:
    while True:
        try:
            msg = results.get_nowait()
        except queue.Empty:
            return
        _handle_result(session, job, msg, state)


def _handle_result(session: Session, job: Job, msg: tuple, state: dict) -> None:
    total = state["total"]
    if msg[0] == "repairing":
        state["repairing"] = max(0, state["repairing"] + msg[2])
        job.substatus = "REPAIRING_CODE" if state["repairing"] > 0 else None
        _commit_job(session, job)
        return
    # ("done", scene_id, payload) — persist one scene's render outcome
    _, scene_id, payload = msg
    scene = session.query(Scene).filter(
        Scene.job_id == job.id, Scene.scene_id == scene_id).one()
    if payload["failure_kind"] == "coder":
        scene.render_status = "failed"
        state["failure"] = ("coder", payload["code"], payload["error"])
    elif payload["ok"]:
        scene.render_status = "ok"
        scene.code_version = payload["version"]
        scene.source_path = str(payload["source"].resolve())
        scene.video_path = str(payload["video"].resolve())
        sdir = payload["source"].parent
        storage.register_artifact(session, job.id, "scene_video", payload["video"],
                                  scene_id=scene_id, version=payload["version"])
        storage.register_artifact(session, job.id, "scene_code", payload["source"],
                                  scene_id=scene_id, version=payload["version"])
        storage.register_artifact(session, job.id, "render_log", sdir / "render.log",
                                  scene_id=scene_id)
        job.current_scene = scene.order
    else:
        scene.render_status = "failed"
        state["failure"] = ("render", None,
                            f"scene {scene_id} failed after "
                            f"{payload['attempts']} render attempt(s): {payload['error']}")
    state["done"] += 1
    job.progress_percent = 25 + int(50 * state["done"] / total)
    _commit_job(session, job)


def _raise_if_failed(state: dict, abort: threading.Event, pool: ThreadPoolExecutor) -> None:
    if state["failure"] is None:
        return
    abort.set()
    pool.shutdown(wait=False)
    kind, code, message = state["failure"]
    if kind == "coder":
        raise CoderError(ErrorCode(code), message)
    if kind == "render":
        raise RenderError(message)
    raise RuntimeError(message)


def _render_scene_task(job_id: str, scene: Scene, sdir: Path, source_path: Path,
                       results: queue.Queue, abort: threading.Event,
                       factory: sessionmaker) -> None:
    """Render one scene with its targeted-repair loop (worker thread).

    Reads ORM attributes already loaded on the job thread (safe: the session
    uses expire_on_commit=False) and writes only scene files plus ModelCall
    rows through a thread-local session. The final outcome goes through
    `results` for the job thread to persist.
    """
    version = scene.code_version
    fixes_used = 0
    repairing = False
    failure_kind = None       # None | "coder" | "render" | "internal"
    failure_code = None
    failure_message = None
    video = None
    try:
        result = manim_runner.render(sdir, source_path)
        while not result.ok and failure_kind is None:
            if fixes_used >= settings.MAX_RENDER_RETRIES or abort.is_set():
                failure_kind, failure_message = "render", result.error_summary
                break
            if not repairing:
                repairing = True
                results.put(("repairing", scene.scene_id, 1))
            try:
                with factory() as fix_session:
                    # targeted repair: error summary + last 100 log lines + source + spec
                    repaired = fixer_svc.repair_scene_code(
                        fix_session, job_id, scene,
                        source_code=source_path.read_text(encoding="utf-8"),
                        error_summary=result.error_summary,
                        log_tail=fixer_svc.log_tail_of(result.log, 100),
                    )
            except CoderError as exc:
                failure_kind, failure_code, failure_message = "coder", exc.code.value, exc.message
                break
            version = storage.next_source_version(sdir)
            source_path = storage.write_text(sdir / f"source_v{version}.py", repaired)
            fixes_used += 1
            result = manim_runner.render(sdir, source_path)
        if result.ok:
            video = result.mp4_path
    except Exception as exc:  # noqa: BLE001 — always report an outcome, never hang the drain
        failure_kind, failure_message = "internal", f"render task crashed: {exc}"
    finally:
        if repairing:
            results.put(("repairing", scene.scene_id, -1))
        results.put(("done", scene.scene_id, {
            "ok": video is not None,
            "video": video,
            "version": version,
            "source": source_path,
            "attempts": 1 + fixes_used,
            "failure_kind": failure_kind,
            "code": failure_code,
            "error": failure_message,
        }))


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
