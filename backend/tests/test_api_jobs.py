"""Job creation validation, detail shape, and history pagination (contract §2/§3/§4)."""
from __future__ import annotations

from tests.conftest import create_job


def test_create_job_success(client):
    data = create_job(client, topic="介绍快速排序的分治思想", duration_seconds=30)
    assert data["status"] == "QUEUED"
    assert data["job_id"].startswith("job_")
    assert data["status_url"] == f"/api/v1/jobs/{data['job_id']}"
    assert data["request_id"].startswith("req_")


def test_create_job_response_headers(client):
    resp = client.post("/api/v1/jobs", json={
        "topic": "介绍栈与队列的区别", "audience": "intermediate",
        "language": "zh-CN", "duration_seconds": 20,
    })
    assert resp.status_code == 202
    assert resp.headers.get("x-request-id", "").startswith("req_")


INVALID_CASES = [
    {"topic": "太短了", "audience": "beginner", "duration_seconds": 30},       # topic 3 chars < 5
    {"topic": "字" * 501, "audience": "beginner", "duration_seconds": 30},     # > 500
    {"topic": "介绍堆排序的过程", "audience": "expert", "duration_seconds": 30},  # bad audience
    {"topic": "介绍堆排序的过程", "audience": "beginner", "duration_seconds": 14},  # < 15
    {"topic": "介绍堆排序的过程", "audience": "beginner", "duration_seconds": 91},  # > 90
    {"topic": "介绍堆排序的过程", "audience": "beginner", "duration_seconds": 30,
     "language": "en-US"},                                                     # P0 fixed zh-CN
    {"audience": "beginner", "duration_seconds": 30},                          # missing topic
    {"topic": "介绍堆排序的过程", "duration_seconds": 30},                      # missing audience
    {"topic": "介绍堆排序的过程", "audience": "beginner", "duration_seconds": "abc"},  # wrong type
]


def test_create_job_invalid_inputs_422(client):
    for payload in INVALID_CASES:
        resp = client.post("/api/v1/jobs", json=payload)
        assert resp.status_code == 422, (payload, resp.text)
        body = resp.json()
        assert body["code"] == "INVALID_INPUT", body
        assert body["request_id"].startswith("req_")
        assert body["message"]


def test_invalid_input_not_enqueued(client):
    before = client.get("/api/v1/jobs?limit=100").json()["total"]
    resp = client.post("/api/v1/jobs", json={
        "topic": "短", "audience": "beginner", "duration_seconds": 30})
    assert resp.status_code == 422
    after = client.get("/api/v1/jobs?limit=100").json()["total"]
    assert after == before


def test_job_detail_shape(client):
    created = create_job(client)
    data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    for key in ("request_id", "job_id", "topic", "status", "substatus",
                "progress_percent", "current_scene", "scene_count", "error",
                "created_at", "updated_at", "artifacts"):
        assert key in data, key
    assert data["status"] == "QUEUED"
    assert data["error"] is None
    assert data["artifacts"] == []
    assert data["created_at"].endswith("Z")
    assert data["request_id"].startswith("req_")


def test_job_detail_404(client):
    resp = client.get("/api/v1/jobs/job_does_not_exist")
    assert resp.status_code == 404
    assert resp.json()["code"] == "NOT_FOUND"


def test_list_pagination_order(client):
    ids = [create_job(client, topic=f"分页测试主题第 {i} 号")["job_id"] for i in range(3)]
    data = client.get("/api/v1/jobs?limit=2&offset=0").json()
    assert data["limit"] == 2 and data["offset"] == 0
    assert len(data["items"]) == 2
    assert data["total"] >= 3
    created = [item["created_at"] for item in data["items"]]
    assert created == sorted(created, reverse=True)  # newest first
    for item in data["items"]:
        assert item["job_id"] in ids
    page2 = client.get("/api/v1/jobs?limit=2&offset=2").json()
    assert len(page2["items"]) == 2


def test_list_pagination_invalid(client):
    resp = client.get("/api/v1/jobs?limit=0")
    assert resp.status_code == 422
    assert resp.json()["code"] == "INVALID_INPUT"
    resp = client.get("/api/v1/jobs?limit=101")
    assert resp.status_code == 422
