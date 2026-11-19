"""Artifact listing + download + HTTP Range + ownership checks (contract §4)."""
from __future__ import annotations

from tests.conftest import create_job, run_job_sync


def _completed(client, mock_llm):
    mock_llm()
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])
    data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
    assert data["status"] == "COMPLETED", data.get("error")
    return data


def test_artifact_kinds_listed(client, mock_llm):
    data = _completed(client, mock_llm)
    by_kind = {}
    for art in data["artifacts"]:
        by_kind.setdefault(art["kind"], []).append(art)
    assert len(by_kind["lesson_plan"]) == 1
    assert len(by_kind["scene_video"]) == 2
    assert len(by_kind["final_video"]) == 1
    assert len(by_kind["render_log"]) == 2
    video = by_kind["scene_video"][0]
    assert video["scene_id"].startswith("scene_")
    assert video["mime_type"] == "video/mp4"
    assert video["size_bytes"] > 0
    plan = by_kind["lesson_plan"][0]
    assert plan["mime_type"] == "application/json"


def test_download_lesson_plan_json(client, mock_llm):
    data = _completed(client, mock_llm)
    art = next(a for a in data["artifacts"] if a["kind"] == "lesson_plan")
    resp = client.get(f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    body = resp.json()
    assert body["title"]
    assert len(body["scenes"]) == 2
    assert resp.headers.get("x-request-id", "").startswith("req_")


def test_download_scene_code(client, mock_llm):
    data = _completed(client, mock_llm)
    art = next(a for a in data["artifacts"] if a["kind"] == "scene_code")
    resp = client.get(f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}")
    assert resp.status_code == 200
    assert "class GeneratedScene" in resp.text
    assert art["version"] == 1


def test_range_full_open_ended(client, mock_llm):
    data = _completed(client, mock_llm)
    art = next(a for a in data["artifacts"] if a["kind"] == "scene_video")
    full = client.get(f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}")
    size = art["size_bytes"]
    resp = client.get(
        f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}",
        headers={"Range": "bytes=0-"},
    )
    assert resp.status_code == 206
    assert resp.headers["content-range"] == f"bytes 0-{size - 1}/{size}"
    assert len(resp.content) == size
    assert resp.content == full.content


def test_range_single_interval(client, mock_llm):
    data = _completed(client, mock_llm)
    art = next(a for a in data["artifacts"] if a["kind"] == "scene_video")
    url = f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}"
    resp = client.get(url, headers={"Range": "bytes=0-99"})
    assert resp.status_code == 206
    assert len(resp.content) == 100
    assert resp.headers["content-range"] == f"bytes 0-99/{art['size_bytes']}"

    resp = client.get(url, headers={"Range": "bytes=100-"})
    assert resp.status_code == 206
    assert len(resp.content) == art["size_bytes"] - 100
    assert resp.headers["content-range"] == (
        f"bytes 100-{art['size_bytes'] - 1}/{art['size_bytes']}"
    )


def test_range_suffix(client, mock_llm):
    data = _completed(client, mock_llm)
    art = next(a for a in data["artifacts"] if a["kind"] == "scene_video")
    url = f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}"
    resp = client.get(url, headers={"Range": "bytes=-50"})
    assert resp.status_code == 206
    assert len(resp.content) == 50
    assert resp.headers["content-range"] == (
        f"bytes {art['size_bytes'] - 50}-{art['size_bytes'] - 1}/{art['size_bytes']}"
    )


def test_range_unsatisfiable_416(client, mock_llm):
    data = _completed(client, mock_llm)
    art = next(a for a in data["artifacts"] if a["kind"] == "scene_video")
    url = f"/api/v1/jobs/{data['job_id']}/artifacts/{art['artifact_id']}"
    resp = client.get(url, headers={"Range": f"bytes={art['size_bytes'] + 10}-"})
    assert resp.status_code == 416


def test_ownership_mismatch_404(client, mock_llm):
    data_a = _completed(client, mock_llm)
    art = data_a["artifacts"][0]
    created_b = create_job(client, topic="另一个任务用于归属校验")
    resp = client.get(
        f"/api/v1/jobs/{created_b['job_id']}/artifacts/{art['artifact_id']}")
    assert resp.status_code == 404
    assert resp.json()["code"] == "NOT_FOUND"


def test_unknown_artifact_404(client, mock_llm):
    data = _completed(client, mock_llm)
    resp = client.get(f"/api/v1/jobs/{data['job_id']}/artifacts/art_missing")
    assert resp.status_code == 404
