"""Full pipeline in stub mode: QUEUED -> ... -> COMPLETED, plus worker thread."""
from __future__ import annotations

import time

from app.models.db import TaskEvent, open_session
from tests.conftest import FakeChat, create_job, poll_job, run_job_sync


def test_full_pipeline_stub(client, mock_llm):
    mock_llm(FakeChat())  # default valid plan + valid manim code
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])

    data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert data["status"] == "COMPLETED", data.get("error")
    assert data["progress_percent"] == 100
    assert data["error"] is None
    assert data["substatus"] is None
    assert data["scene_count"] == 2

    kinds = [a["kind"] for a in data["artifacts"]]
    assert kinds.count("lesson_plan") == 1
    assert kinds.count("scene_code") == 2
    assert kinds.count("scene_video") == 2
    assert kinds.count("render_log") == 2
    assert kinds.count("final_video") == 1

    # state machine order per contract §1 (NARRATING skipped in P0)
    with open_session() as session:
        events = (
            session.query(TaskEvent)
            .filter(TaskEvent.job_id == created["job_id"])
            .order_by(TaskEvent.id.asc())
            .all()
        )
    flow = [e.to_status for e in events]
    assert flow == ["PLANNING", "CODING", "RENDERING", "COMPOSING",
                    "VALIDATING", "COMPLETED"]
    starts = [e.from_status for e in events]
    assert starts == ["QUEUED", "PLANNING", "CODING", "RENDERING", "COMPOSING", "VALIDATING"]
    assert all(e.event_type == "STAGE" for e in events)


def test_final_video_downloadable(client, job_pair):
    data = job_pair(duration_seconds=15)
    final = next(a for a in data["artifacts"] if a["kind"] == "final_video")
    resp = client.get(f"/api/v1/jobs/{data['job_id']}/artifacts/{final['artifact_id']}")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("video/mp4")
    assert int(resp.headers["content-length"]) == final["size_bytes"] > 0
    assert resp.content[:4] != b"" and len(resp.content) == final["size_bytes"]
    # a real MP4 starts with the ftyp box after the size field
    assert b"ftyp" in resp.content[:64]


def test_worker_thread_pipeline(client, mock_llm):
    """End-to-end through the real polling worker thread (no manual run)."""
    from app.workers import local_worker
    mock_llm(FakeChat())
    created = create_job(client, duration_seconds=15)
    local_worker.start_worker(poll_interval=0.3)
    try:
        data = poll_job(client, created["job_id"], "COMPLETED", timeout=180)
    finally:
        local_worker.stop_worker()
    assert data["progress_percent"] == 100
    assert any(a["kind"] == "final_video" for a in data["artifacts"])
