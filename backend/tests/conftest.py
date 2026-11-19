"""Offline test fixtures: temp DB/artifacts, stub renderer, mocked LLM.

All tests run without network: the LLM client is monkeypatched at class
level, and RENDERER_MODE=stub synthesizes videos with ffmpeg only.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# --- environment must be configured BEFORE app modules are imported ---------
_TMP = Path(tempfile.mkdtemp(prefix="aitv-tests-"))
os.environ["ENV_FILE"] = str(_TMP / "nonexistent.env")  # never read developer .env
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["ARTIFACT_ROOT"] = str(_TMP / "artifacts")
os.environ["RENDERER_MODE"] = "stub"
os.environ["WORKER_ENABLED"] = "false"
os.environ["LLM_API_KEY"] = ""  # offline: real client would refuse to call anyway

import json as _json
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.providers.openai_compatible import ChatResult, LLMClient  # noqa: E402
from app.services.coder import CODER_PROMPT_V3  # noqa: E402
from app.services.fixer import FIXER_PROMPT_V1  # noqa: E402
from app.services.planner import CONCEPT_PROMPT_V1, PLANNER_PROMPT_V3  # noqa: E402

DEFAULT_CONCEPT_NOTES = (
    "【一句话本质】这是测试用的概念讲解：边界上的累积等于内部微小贡献的总和。"
    "【公式逐项拆解】左端沿边界累积，右端对区域求和，两端度量同一总量。"
    "【为什么成立】内部相邻微元的贡献互相抵消，只剩边界。"
    "【贯穿示例】取单位圆直接计算得 2π，用公式计算也得 2π。"
)

VALID_CODE = (
    "from manim import *\n"
    "\n"
    "class GeneratedScene(Scene):\n"
    "    def construct(self):\n"
    "        self.play(Write(Text(\"AI Tutor Video\")))\n"
    "        self.wait(1)\n"
)


def make_plan(duration: int = 15, n: int = 2) -> dict:
    """A lesson plan that passes contract §5 validation for `duration`."""
    per_scene = duration / n
    scenes = [
        {
            "scene_id": f"scene_{i:03d}",
            "order": i,
            "concept": f"概念 {i}",
            "narration": f"这是第 {i} 个场景的解说。",
            "visual_instructions": f"展示第 {i} 个概念的动画。",
            "estimated_seconds": per_scene,
            "required_objects": ["array"],
        }
        for i in range(1, n + 1)
    ]
    return {
        "title": "二分查找入门",
        "language": "zh-CN",
        "target_seconds": duration,
        "audience": "beginner",
        "learning_objectives": ["理解查找区间如何缩小"],
        "scenes": scenes,
    }


class FakeChat:
    """Dispatches on the system prompt identity; programmable per attempt."""

    def __init__(self, planner_outputs=None, coder_outputs=None, fixer_outputs=None,
                 concept_outputs=None):
        self.planner_outputs = list(planner_outputs or [])
        self.coder_outputs = list(coder_outputs or [])
        self.fixer_outputs = list(fixer_outputs or [])
        self.concept_outputs = list(concept_outputs or [])
        self.calls: list[tuple[str, str]] = []

    def __call__(self, *args, system=None, user=None, json_mode=True, temperature=0.4):
        # Works both as a direct callable and monkeypatched onto LLMClient.chat
        # (in the latter case args[0] is the LLMClient instance and is ignored).
        self.calls.append(("concept" if system == CONCEPT_PROMPT_V1
                           else "planner" if system == PLANNER_PROMPT_V3
                           else "fixer" if system == FIXER_PROMPT_V1
                           else "coder" if system == CODER_PROMPT_V3 else "?", user))
        if system == CONCEPT_PROMPT_V1:
            out = self.concept_outputs.pop(0) if self.concept_outputs else DEFAULT_CONCEPT_NOTES
        elif system == PLANNER_PROMPT_V3:
            out = self.planner_outputs.pop(0) if self.planner_outputs else make_plan()
        elif system == CODER_PROMPT_V3:
            out = self.coder_outputs.pop(0) if self.coder_outputs else VALID_CODE
        elif system == FIXER_PROMPT_V1:
            out = self.fixer_outputs.pop(0) if self.fixer_outputs else VALID_CODE
        else:
            out = ""
        if isinstance(out, (dict, list)):
            out = _json.dumps(out, ensure_ascii=False)
        return ChatResult(text=out, model="fake-model", prompt_tokens=10,
                          completion_tokens=10, duration_ms=5)


@pytest.fixture()
def mock_llm(monkeypatch):
    """Install a fake LLM; returns the FakeChat for call inspection."""
    def _install(fake: FakeChat | None = None) -> FakeChat:
        fake = fake or FakeChat()
        monkeypatch.setattr(LLMClient, "chat", fake)
        return fake
    return _install


@pytest.fixture(scope="session")
def client():
    from app.main import create_app
    app = create_app()
    with TestClient(app) as c:  # lifespan: worker disabled via env
        yield c


def create_job(client, topic="介绍二分查找算法的基本思想与实现", audience="beginner",
               duration_seconds=15, **overrides) -> dict:
    payload = {"topic": topic, "audience": audience,
               "language": "zh-CN", "duration_seconds": duration_seconds}
    payload.update(overrides)
    resp = client.post("/api/v1/jobs", json=payload)
    assert resp.status_code == 202, resp.text
    return resp.json()


def run_job_sync(job_id: str) -> None:
    """Drive the orchestrator synchronously (worker disabled in tests)."""
    from app.services.orchestrator import run_job
    run_job(job_id)


def poll_job(client, job_id: str, want: str, timeout: float = 180.0) -> dict:
    import time as _t
    deadline = _t.monotonic() + timeout
    while _t.monotonic() < deadline:
        data = client.get(f"/api/v1/jobs/{job_id}").json()
        if data["status"] == want:
            return data
        _t.sleep(0.5)
    raise AssertionError(f"job {job_id} did not reach {want} within {timeout}s: {data}")


@pytest.fixture()
def job_pair(client, mock_llm):
    """A completed job (stub pipeline) + helper accessors."""
    mock_llm()
    def _make(**kw) -> dict:
        created = create_job(client, **kw)
        run_job_sync(created["job_id"])
        data = client.get(f"/api/v1/jobs/{created['job_id']}").json()
        assert data["status"] == "COMPLETED", data.get("error")
        return data
    return _make
