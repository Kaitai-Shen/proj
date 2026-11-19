"""Single local worker thread: polls SQLite for QUEUED jobs and runs the
orchestrator. Started by app lifespan (WORKER_ENABLED=true); can also be
started/stopped manually for tests.
"""
from __future__ import annotations

import logging
import threading
import time

from sqlalchemy import select

from app.core.config import settings
from app.models.db import Job, init_engine, open_session
from app.services.orchestrator import run_job

logger = logging.getLogger("aitv.worker")

_stop_event: threading.Event | None = None
_thread: threading.Thread | None = None


def _next_queued_job_id(session) -> str | None:
    return session.execute(
        select(Job.id)
        .where(Job.status == "QUEUED")
        .order_by(Job.created_at.asc(), Job.id.asc())
        .limit(1)
    ).scalar()


def _loop(poll_interval: float) -> None:
    logger.info("worker loop started (poll=%ss, renderer=%s)", poll_interval, settings.RENDERER_MODE)
    while _stop_event and not _stop_event.is_set():
        job_id: str | None = None
        try:
            with open_session() as session:
                job_id = _next_queued_job_id(session)
        except Exception as exc:  # noqa: BLE001 — keep the loop alive
            logger.exception("worker poll failed: %s", exc)
        if job_id:
            try:
                run_job(job_id)
            except Exception as exc:  # noqa: BLE001 — orchestrator should not leak
                logger.exception("job %s crashed the worker: %s", job_id, exc)
                with open_session() as session:
                    job = session.get(Job, job_id)
                    if job is not None and job.status not in ("FAILED", "CANCELLED", "COMPLETED"):
                        job.status = "FAILED"
                        job.error_code = "INTERNAL"
                        job.error_message = f"worker crash: {exc}"
                        session.commit()
            continue  # claim the next queued job immediately
        _stop_event.wait(poll_interval)
    logger.info("worker loop stopped")


def start_worker(poll_interval: float | None = None) -> threading.Thread:
    """Start the polling thread (idempotent). Ensures DB/engine is initialized."""
    global _stop_event, _thread
    if _thread is not None and _thread.is_alive():
        return _thread
    init_engine(settings.DATABASE_URL)
    _stop_event = threading.Event()
    interval = settings.WORKER_POLL_INTERVAL if poll_interval is None else poll_interval
    _thread = threading.Thread(target=_loop, args=(interval,), name="aitv-local-worker", daemon=True)
    _thread.start()
    return _thread


def stop_worker(timeout: float = 5.0) -> None:
    global _stop_event, _thread
    if _stop_event is not None:
        _stop_event.set()
    if _thread is not None:
        _thread.join(timeout=timeout)
    _thread = None
    _stop_event = None
