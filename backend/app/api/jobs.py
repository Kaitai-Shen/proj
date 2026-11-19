"""Job endpoints per gateway contract v1.0 §2/§3/§4."""
from __future__ import annotations

import secrets
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import ApiError, ErrorCode
from app.core.request_context import current_request_id
from app.models.db import Artifact, Job, iso_z, open_session
from app.tools import storage

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

CANCELABLE_STATUSES = {"QUEUED", "PLANNING"}


class JobCreate(BaseModel):
    topic: str
    audience: str
    language: str = "zh-CN"
    duration_seconds: int


def _new_job_id() -> str:
    return f"job_{int(time.time()) % 1000000:06d}{secrets.token_hex(3).upper()}"


def _validate_create(payload: JobCreate) -> None:
    errors: dict[str, str] = {}
    topic = payload.topic if isinstance(payload.topic, str) else ""
    if not (5 <= len(topic.strip()) <= 500):
        errors["topic"] = "topic must be 5-500 characters"
    if payload.audience not in ("beginner", "intermediate"):
        errors["audience"] = "audience must be 'beginner' or 'intermediate'"
    if payload.language != "zh-CN":
        errors["language"] = "language is fixed to 'zh-CN' in P0"
    if not (15 <= payload.duration_seconds <= 90):
        errors["duration_seconds"] = "duration_seconds must be 15-90"
    if errors:
        raise ApiError(422, ErrorCode.INVALID_INPUT, "invalid job creation input", details=errors)


def _artifact_view(art: Artifact) -> dict:
    view = {
        "artifact_id": art.id,
        "kind": art.kind,
        "mime_type": art.mime_type,
        "size_bytes": art.size_bytes,
    }
    if art.scene_id:
        view["scene_id"] = art.scene_id
    if art.version is not None:
        view["version"] = art.version
    return view


def _job_summary(job: Job) -> dict:
    return {
        "job_id": job.id,
        "topic": job.topic,
        "status": job.status,
        "substatus": job.substatus,
        "progress_percent": job.progress_percent,
        "scene_count": job.scene_count,
        "created_at": iso_z(job.created_at),
        "updated_at": iso_z(job.updated_at),
    }


@router.post("", status_code=202)
def create_job(payload: JobCreate, request: Request) -> dict:
    _validate_create(payload)

    job_id = _new_job_id()
    job = Job(
        id=job_id,
        request_id=current_request_id(),
        topic=payload.topic.strip(),
        audience=payload.audience,
        language=payload.language,
        duration_seconds=payload.duration_seconds,
        status="QUEUED",
        progress_percent=0,
    )
    with open_session() as session:
        session.add(job)
        session.flush()
        # contract §6 layout: persist the creation request
        storage.ensure_dirs()
        storage.write_json(storage.job_dir(job_id) / "request.json", {
            "topic": job.topic,
            "audience": job.audience,
            "language": job.language,
            "duration_seconds": job.duration_seconds,
        })
        session.commit()

    return {
        "request_id": current_request_id(),
        "job_id": job_id,
        "status": job.status,
        "status_url": f"/api/v1/jobs/{job_id}",
    }


@router.get("")
def list_jobs(request: Request, limit: int = 20, offset: int = 0) -> dict:
    if not (1 <= limit <= 100) or offset < 0:
        raise ApiError(422, ErrorCode.INVALID_INPUT,
                       "limit must be 1-100 and offset >= 0",
                       details={"limit": limit, "offset": offset})
    with open_session() as session:
        q = session.query(Job).order_by(Job.created_at.desc(), Job.id.desc())
        total = q.count()
        rows = q.limit(limit).offset(offset).all()
    return {
        "request_id": current_request_id(),
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_job_summary(j) for j in rows],
    }


def _get_job_or_404(session, job_id: str) -> Job:
    job = session.get(Job, job_id)
    if job is None:
        raise ApiError(404, ErrorCode.NOT_FOUND, f"job {job_id} not found")
    return job


@router.get("/{job_id}")
def get_job(job_id: str, request: Request) -> dict:
    with open_session() as session:
        job = _get_job_or_404(session, job_id)
        arts = (
            session.query(Artifact)
            .filter(Artifact.job_id == job_id)
            .order_by(Artifact.created_at.asc(), Artifact.id.asc())
            .all()
        )
        return {
            "request_id": current_request_id(),
            "job_id": job.id,
            "topic": job.topic,
            "status": job.status,
            "substatus": job.substatus,
            "progress_percent": job.progress_percent,
            "current_scene": job.current_scene,
            "scene_count": job.scene_count,
            "error": job.error,
            "created_at": iso_z(job.created_at),
            "updated_at": iso_z(job.updated_at),
            "artifacts": [_artifact_view(a) for a in arts],
        }


@router.get("/{job_id}/storyboard")
def get_storyboard(job_id: str, request: Request) -> dict:
    with open_session() as session:
        _get_job_or_404(session, job_id)
    plan_path = storage.job_dir(job_id) / "lesson_plan.json"
    if not plan_path.exists():
        raise ApiError(404, ErrorCode.NOT_READY,
                       "storyboard is not generated yet")
    import json
    return json.loads(plan_path.read_text(encoding="utf-8"))


@router.post("/{job_id}/cancel", status_code=202)
def cancel_job(job_id: str, request: Request) -> dict:
    with open_session() as session:
        job = _get_job_or_404(session, job_id)
        if job.status not in CANCELABLE_STATUSES:
            raise ApiError(409, ErrorCode.INVALID_INPUT,
                           f"job cannot be cancelled in status {job.status}",
                           details={"status": job.status,
                                    "cancelable_statuses": sorted(CANCELABLE_STATUSES)})
        if job.status == "QUEUED":
            # worker has not claimed it: cancel synchronously (QUEUED -> CANCELLED)
            job.status = "CANCELLED"
            job.substatus = None
            from app.models.db import TaskEvent
            session.add(TaskEvent(
                job_id=job.id, event_type="CANCEL",
                from_status="QUEUED", to_status="CANCELLED",
                detail_json='{"via": "api"}',
            ))
            session.commit()
            status = job.status
        else:
            # PLANNING: worker honors the flag at the next stage boundary
            job.cancel_requested = True
            session.commit()
            status = job.status
        return {
            "request_id": current_request_id(),
            "job_id": job.id,
            "status": status,
            "cancel_requested": job.cancel_requested,
        }
