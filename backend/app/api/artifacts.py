"""Artifact download endpoint with HTTP Range support for videos.

The on-disk path is resolved ONLY from the artifact_id DB row (never from
URL segments), which rules out path traversal; a job/artifact ownership
mismatch returns 404.
"""
from __future__ import annotations

import os
import re

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, StreamingResponse

from app.core.errors import ApiError, ErrorCode
from app.core.request_context import current_request_id
from app.models.db import Artifact, open_session

router = APIRouter(prefix="/api/v1", tags=["artifacts"])

_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")
_CHUNK = 64 * 1024


def _get_artifact_or_404(session, job_id: str, artifact_id: str) -> Artifact:
    art = (
        session.query(Artifact)
        .filter(Artifact.id == artifact_id, Artifact.job_id == job_id)
        .one_or_none()
    )
    if art is None:  # unknown id OR ownership mismatch -> 404 (contract §4)
        raise ApiError(404, ErrorCode.NOT_FOUND,
                       f"artifact {artifact_id} not found for job {job_id}")
    if not art.path or not os.path.exists(art.path):
        raise ApiError(404, ErrorCode.NOT_FOUND, "artifact file is missing on disk")
    return art


def _stream_file(path: str, start: int, end: int):  # inclusive byte range
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/jobs/{job_id}/artifacts/{artifact_id}")
def get_artifact(job_id: str, artifact_id: str, request: Request):
    with open_session() as session:
        art = _get_artifact_or_404(session, job_id, artifact_id)

    size = os.path.getsize(art.path)
    range_header = request.headers.get("range")

    if range_header:
        m = _RANGE_RE.match(range_header.strip())
        if not m:
            # malformed Range: per RFC 7233 ignore it and return the full body
            return _full_response(art, size)
        start_s, end_s = m.group(1), m.group(2)
        if start_s == "" and end_s == "":
            return _full_response(art, size)
        if start_s == "":  # suffix range: bytes=-N (last N bytes)
            n = int(end_s)
            if n == 0:
                raise ApiError(416, ErrorCode.INVALID_INPUT, "unsatisfiable range",
                               details={"range": range_header, "size": size})
            start = max(0, size - n)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s != "" else size - 1
            if start >= size:
                raise ApiError(416, ErrorCode.INVALID_INPUT, "unsatisfiable range",
                               details={"range": range_header, "size": size})
            end = min(end, size - 1)
        length = end - start + 1
        return StreamingResponse(
            _stream_file(art.path, start, end),
            status_code=206,
            media_type=art.mime_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{size}",
                "Content-Length": str(length),
                "Accept-Ranges": "bytes",
                "X-Request-Id": current_request_id(),
                "Content-Disposition": f'inline; filename="{art.id}"',
            },
        )
    return _full_response(art, size)


def _full_response(art: Artifact, size: int) -> FileResponse:
    return FileResponse(
        art.path,
        media_type=art.mime_type,
        headers={
            "Accept-Ranges": "bytes",
            "X-Request-Id": current_request_id(),
            "Content-Disposition": f'inline; filename="{art.id}"',
        },
    )
