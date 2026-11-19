"""Artifact storage helpers: filesystem layout per contract §6.

artifacts/jobs/{job_id}/
  request.json | lesson_plan.json | manifest.json
  scenes/scene_001/{source_v1.py, render_v1.mp4, render.log}
  final.mp4
"""
from __future__ import annotations

import json
import secrets
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.db import Artifact

MIME_BY_KIND = {
    "lesson_plan": "application/json",
    "scene_code": "text/x-python",
    "scene_video": "video/mp4",
    "final_video": "video/mp4",
    "render_log": "text/plain",
    "subtitles_srt": "application/x-subrip",
    "subtitles_vtt": "text/vtt",
    "narration_audio": "audio/mpeg",
}


def ensure_dirs() -> None:
    settings.ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)


def job_dir(job_id: str) -> Path:
    d = settings.ARTIFACT_ROOT / "jobs" / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def scene_dir(job_id: str, scene_id: str) -> Path:
    d = job_dir(job_id) / "scenes" / scene_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_text(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def write_json(path: Path, payload) -> Path:
    return write_text(path, json.dumps(payload, ensure_ascii=False, indent=2))


def next_source_version(sdir: Path) -> int:
    existing = list(sdir.glob("source_v*.py"))
    return max((int(p.stem.split("_v")[1]) for p in existing), default=0) + 1


def next_render_version(sdir: Path) -> int:
    existing = list(sdir.glob("render_v*.mp4"))
    return max((int(p.stem.split("_v")[1]) for p in existing), default=0) + 1


def new_artifact_id() -> str:
    return f"art_{secrets.token_hex(8)}"


def register_artifact(
    session: Session,
    job_id: str,
    kind: str,
    path: Path,
    scene_id: str | None = None,
    version: int | None = None,
) -> Artifact:
    art = Artifact(
        id=new_artifact_id(),
        job_id=job_id,
        kind=kind,
        scene_id=scene_id,
        mime_type=MIME_BY_KIND.get(kind, "application/octet-stream"),
        size_bytes=path.stat().st_size if path.exists() else 0,
        path=str(path.resolve()),
        version=version,
    )
    session.add(art)
    session.flush()
    return art


def write_manifest(session: Session, job_id: str) -> Path:
    """manifest.json snapshot of registered artifacts (contract §6 layout file)."""
    rows = (
        session.query(Artifact)
        .filter(Artifact.job_id == job_id)
        .order_by(Artifact.created_at.asc(), Artifact.id.asc())
        .all()
    )
    payload = {
        "job_id": job_id,
        "artifacts": [
            {
                "artifact_id": a.id,
                "kind": a.kind,
                "scene_id": a.scene_id,
                "version": a.version,
                "mime_type": a.mime_type,
                "size_bytes": a.size_bytes,
                "file": str(Path(a.path).name),
            }
            for a in rows
        ],
    }
    return write_json(job_dir(job_id) / "manifest.json", payload)
