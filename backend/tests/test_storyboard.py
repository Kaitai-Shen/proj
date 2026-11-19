"""Storyboard endpoint + planner failure paths (mock LLM, offline)."""
from __future__ import annotations

from tests.conftest import FakeChat, create_job, make_plan, run_job_sync


def test_storyboard_success(client, mock_llm):
    plan = make_plan(duration=30, n=3)
    mock_llm(FakeChat(planner_outputs=[plan]))
    created = create_job(client, duration_seconds=30)
    run_job_sync(created["job_id"])

    resp = client.get(f"/api/v1/jobs/{created['job_id']}/storyboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == plan["title"]
    assert [s["scene_id"] for s in body["scenes"]] == ["scene_001", "scene_002", "scene_003"]
    assert resp.headers.get("x-request-id", "").startswith("req_")


def test_storyboard_not_ready_404(client, mock_llm):
    mock_llm()
    created = create_job(client)  # still QUEUED: plan not generated yet
    resp = client.get(f"/api/v1/jobs/{created['job_id']}/storyboard")
    assert resp.status_code == 404
    body = resp.json()
    assert body["code"] == "NOT_READY"


def test_storyboard_unknown_job_404(client):
    resp = client.get("/api/v1/jobs/job_missing/storyboard")
    assert resp.status_code == 404


INVALID_PLANS = [
    {"scenes": []},                                        # no scenes
    {"title": "x", "language": "zh-CN", "target_seconds": 15, "audience": "beginner",
     "learning_objectives": [], "scenes": [{"scene_id": "scene_bad", "order": 1,
     "concept": "c", "narration": "n", "visual_instructions": "v",
     "estimated_seconds": 15, "required_objects": []}]},   # bad scene_id format
    {"title": "x", "language": "zh-CN", "target_seconds": 15, "audience": "beginner",
     "learning_objectives": [], "scenes": [{"scene_id": "scene_001", "order": 1,
     "concept": "c", "narration": "n", "visual_instructions": "v",
     "estimated_seconds": 45, "required_objects": []}]},   # single scene > 30s
    {"title": "x", "language": "zh-CN", "target_seconds": 15, "audience": "beginner",
     "learning_objectives": [], "scenes": [{"scene_id": "scene_001", "order": 2,
     "concept": "c", "narration": "n", "visual_instructions": "v",
     "estimated_seconds": 15, "required_objects": []}]},   # order not consecutive
]


def test_storyboard_validation_failure_path(client, mock_llm):
    for bad in INVALID_PLANS:
        mock_llm(FakeChat(planner_outputs=[bad] * 3))  # every retry fails too
        created = create_job(client, duration_seconds=15)
        run_job_sync(created["job_id"])
        data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
        assert data["status"] == "FAILED", (bad, data)
        assert data["error"]["code"] == "FAILED_PLAN", data["error"]
        assert data["error"]["message"]
        assert data["artifacts"] == []
        resp = client.get(f"/api/v1/jobs/{created['job_id']}/storyboard")
        assert resp.status_code == 404
        assert resp.json()["code"] == "NOT_READY"


def test_planner_retries_then_succeeds(client, mock_llm):
    """First two attempts invalid, third valid -> job still completes."""
    good = make_plan(duration=15, n=2)
    bad = {"scenes": []}
    mock_llm(FakeChat(planner_outputs=[bad, bad, good]))
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])
    data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert data["status"] == "COMPLETED", data.get("error")
    assert data["scene_count"] == 2


def test_planner_non_json_output_fails(client, mock_llm):
    mock_llm(FakeChat(planner_outputs=["this is not json at all"] * 3))
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])
    data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert data["status"] == "FAILED"
    assert data["error"]["code"] == "FAILED_PLAN"


def test_missing_api_key_fails_model_upstream(client):
    """No mock installed, LLM_API_KEY empty: real client refuses -> MODEL_UPSTREAM."""
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])
    data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert data["status"] == "FAILED"
    assert data["error"] is not None
    assert data["error"]["code"] == "MODEL_UPSTREAM", data["error"]
    assert "LLM_API_KEY" in data["error"]["message"]
    resp = client.get(f"/api/v1/jobs/{created['job_id']}/storyboard")
    assert resp.status_code == 404
