"""Cancel endpoint + cancel-flag honoring (contract §4: QUEUED/PLANNING only)."""
from __future__ import annotations

from app.models.db import Job, TaskEvent, open_session
from tests.conftest import create_job, run_job_sync


def test_cancel_queued_job(client, mock_llm):
    mock_llm()  # would succeed if run; must never execute
    created = create_job(client)
    resp = client.post(f"/api/v1/jobs/{created['job_id']}/cancel")
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "CANCELLED"
    assert body["job_id"] == created["job_id"]

    detail = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert detail["status"] == "CANCELLED"
    assert detail["error"] is None

    # orchestrator run on a cancelled job must be a no-op
    run_job_sync(created["job_id"])
    detail = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert detail["status"] == "CANCELLED"
    assert detail["artifacts"] == []

    with open_session() as session:
        events = session.query(TaskEvent).filter(
            TaskEvent.job_id == created["job_id"]).all()
    assert [(e.from_status, e.to_status) for e in events] == [("QUEUED", "CANCELLED")]


def test_cancel_planning_flag_honored_at_boundary(client, mock_llm):
    mock_llm()  # never called: cancel is honored before planning starts
    created = create_job(client)
    # simulate in-flight PLANNING (worker claimed the job)
    with open_session() as session:
        job = session.get(Job, created["job_id"])
        job.status = "PLANNING"
        session.commit()

    resp = client.post(f"/api/v1/jobs/{created['job_id']}/cancel")
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "PLANNING"       # async cancel requested
    assert body["cancel_requested"] is True

    run_job_sync(created["job_id"])           # boundary sees flag -> CANCELLED
    detail = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert detail["status"] == "CANCELLED"


def test_cancel_completed_409(client, job_pair):
    data = job_pair()
    resp = client.post(f"/api/v1/jobs/{data['job_id']}/cancel")
    assert resp.status_code == 409
    body = resp.json()
    assert body["code"] == "INVALID_INPUT"
    assert body["details"]["status"] == "COMPLETED"


def test_cancel_failed_409(client, mock_llm):
    # force a FAILED job (invalid plan every attempt)
    mock_llm(_broken_plan_fake())
    created = create_job(client)
    run_job_sync(created["job_id"])
    detail = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert detail["status"] == "FAILED"
    resp = client.post(f"/api/v1/jobs/{created['job_id']}/cancel")
    assert resp.status_code == 409


def test_cancel_unknown_404(client):
    resp = client.post("/api/v1/jobs/job_nope/cancel")
    assert resp.status_code == 404


def _broken_plan_fake():
    from tests.conftest import FakeChat
    return FakeChat(planner_outputs=[{"scenes": []}] * 3)
