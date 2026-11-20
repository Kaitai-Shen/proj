"""Pipelined CODING/RENDERING stage: parallel renders, repair loop, fail-fast.

Renders are dispatched to a bounded pool while the next scene is still being
coded. These tests fake/patch manim_runner.render to prove concurrency and
repair semantics without needing manim/docker.
"""
from __future__ import annotations

import threading

import pytest

from app.core.config import settings
from app.models.db import Job, ModelCall, Scene, TaskEvent, open_session
from app.providers.openai_compatible import LLMError
from app.services.coder import CODER_PROMPT_V3
from app.services.fixer import FIXER_PROMPT_V1
from app.tools import manim_runner
from app.tools.manim_runner import RenderResult
from tests.conftest import FakeChat, VALID_CODE, create_job, make_plan, run_job_sync


def _job_data(client, job_id: str) -> dict:
    return client.get(f"/api/v1/jobs/{job_id}").json()


def _events(client, job_id: str) -> list[str]:
    with open_session() as session:
        rows = (
            session.query(TaskEvent)
            .filter(TaskEvent.job_id == job_id)
            .order_by(TaskEvent.id.asc())
            .all()
        )
    return [e.to_status for e in rows]


@pytest.fixture()
def single_render_slot(monkeypatch):
    monkeypatch.setattr(settings, "MAX_CONCURRENT_RENDERS", 1)


def test_renders_run_concurrently(client, mock_llm, monkeypatch):
    """Both scenes' renders must be in flight together (barrier proves it)."""
    real_render = manim_runner.render
    barrier = threading.Barrier(2, timeout=15)

    def synchronized_render(scene_dir, source_path):
        barrier.wait()
        return real_render(scene_dir, source_path)

    monkeypatch.setattr(manim_runner, "render", synchronized_render)
    mock_llm(FakeChat())
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])

    data = _job_data(client, created["job_id"])
    assert data["status"] == "COMPLETED", data.get("error")


def test_four_scenes_complete_with_single_render_slot(client, mock_llm, single_render_slot):
    """A pool smaller than the scene count still drains every scene."""
    mock_llm(FakeChat(planner_outputs=[make_plan(duration=60, n=4)]))
    created = create_job(client, duration_seconds=60)
    run_job_sync(created["job_id"])

    data = _job_data(client, created["job_id"])
    assert data["status"] == "COMPLETED", data.get("error")
    assert data["scene_count"] == 4
    assert data["progress_percent"] == 100
    assert data["substatus"] is None
    kinds = [a["kind"] for a in data["artifacts"]]
    assert kinds.count("scene_video") == 4
    assert kinds.count("scene_code") == 4
    assert kinds.count("render_log") == 4
    assert _events(client, created["job_id"]) == [
        "PLANNING", "CODING", "RENDERING", "COMPOSING", "VALIDATING", "COMPLETED",
    ]


def test_repair_loop_recovers_scene(client, mock_llm, monkeypatch):
    """First render attempt fails -> fixer repairs -> re-render succeeds."""
    real_render = manim_runner.render
    calls = {"n": 0}

    def flaky_then_ok(scene_dir, source_path):
        calls["n"] += 1
        if calls["n"] == 1:
            return RenderResult(None, "# boom\nboom", 1, 0.01, ok=False, error="boom")
        return real_render(scene_dir, source_path)

    monkeypatch.setattr(manim_runner, "render", flaky_then_ok)
    fake = mock_llm(FakeChat(fixer_outputs=[VALID_CODE]))
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])

    data = _job_data(client, created["job_id"])
    assert data["status"] == "COMPLETED", data.get("error")
    assert [c[0] for c in fake.calls].count("fixer") == 1
    with open_session() as session:
        rows = session.query(ModelCall).filter(
            ModelCall.job_id == created["job_id"], ModelCall.agent == "fixer").all()
        scene = session.query(Scene).filter(
            Scene.job_id == created["job_id"], Scene.scene_id == "scene_001").one()
        code_version = scene.code_version
    assert len(rows) == 1 and rows[0].ok
    assert code_version == 2  # repaired source is versioned, never overwritten


def test_render_exhaustion_fails_fast(client, mock_llm, monkeypatch):
    """All attempts fail -> FAILED_RENDER naming the attempt count."""

    def always_fail(scene_dir, source_path):
        return RenderResult(None, "# boom\nboom", 1, 0.01, ok=False, error="boom")

    monkeypatch.setattr(manim_runner, "render", always_fail)
    mock_llm(FakeChat())  # fixer returns valid code; renders keep failing
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])

    data = _job_data(client, created["job_id"])
    assert data["status"] == "FAILED"
    assert data["error"]["code"] == "FAILED_RENDER"
    assert "3 render attempt(s)" in data["error"]["message"]


class UpstreamBrokenFixer(FakeChat):
    """Planner/coder behave normally; the fixer LLM call fails upstream."""

    def __call__(self, *args, system=None, user=None, json_mode=True, temperature=0.4):
        if system == FIXER_PROMPT_V1:
            raise LLMError("simulated upstream error")
        return super().__call__(*args, system=system, user=user,
                               json_mode=json_mode, temperature=temperature)


def test_fixer_upstream_error_preserved(client, mock_llm, monkeypatch):
    """A fixer LLM failure fails the job with MODEL_UPSTREAM (code kept)."""

    def always_fail(scene_dir, source_path):
        return RenderResult(None, "# boom\nboom", 1, 0.01, ok=False, error="boom")

    monkeypatch.setattr(manim_runner, "render", always_fail)
    mock_llm(UpstreamBrokenFixer())
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])

    data = _job_data(client, created["job_id"])
    assert data["status"] == "FAILED"
    assert data["error"]["code"] == "MODEL_UPSTREAM"


def test_cancel_flag_mid_pipeline_cancels(client, mock_llm):
    """Cancel requested while coding -> honored at the next internal boundary."""

    class CancelAfterFirstCoderCall(FakeChat):
        def __init__(self):
            super().__init__()
            self._armed = False

        def __call__(self, *args, system=None, user=None, json_mode=True, temperature=0.4):
            result = super().__call__(*args, system=system, user=user,
                                     json_mode=json_mode, temperature=temperature)
            if system == CODER_PROMPT_V3 and not self._armed:
                self._armed = True
                with open_session() as session:
                    job = session.query(Job).filter(Job.status == "CODING").one()
                    job.cancel_requested = True
                    session.commit()
            return result

    mock_llm(CancelAfterFirstCoderCall())
    created = create_job(client, duration_seconds=15)
    run_job_sync(created["job_id"])

    data = _job_data(client, created["job_id"])
    assert data["status"] == "CANCELLED"
    assert data["error"] is None
    flow = _events(client, created["job_id"])
    assert flow[-1] == "CANCELLED"
    assert flow[-2] == "CODING"
