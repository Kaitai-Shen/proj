"""Manual smoke test: run ONE short job end-to-end with the real DeepSeek API.

Usage (uvicorn server not required):

    cd backend
    set LLM_API_KEY=sk-...      (or put it in backend/.env)
    .venv/Scripts/python scripts/smoke.py

Renderer defaults to RENDERER_MODE (stub). Skips when no key is configured.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.models.db import TaskEvent, init_engine, open_session  # noqa: E402
from app.tools import storage  # noqa: E402

TOPIC = "用动画解释什么是二分查找，演示在一个有序数组中查找目标值的过程"
AUDIENCE = "beginner"
DURATION = 30


def main() -> int:
    print(f"LLM_BASE_URL = {settings.LLM_BASE_URL}")
    print(f"LLM_MODEL    = {settings.LLM_MODEL}")
    print(f"RENDERER_MODE= {settings.RENDERER_MODE}")
    if not settings.LLM_API_KEY:
        print("SKIP: LLM_API_KEY 未配置（export LLM_API_KEY=sk-... 或写入 backend/.env）")
        return 0

    init_engine(settings.DATABASE_URL)
    storage.ensure_dirs()

    job_id = f"job_smoke_{int(time.time())}"
    print(f"\n[1/3] creating job {job_id} ...")
    with open_session() as session:
        from app.models.db import Job
        job = Job(
            id=job_id, request_id="req_smoke", topic=TOPIC, audience=AUDIENCE,
            language="zh-CN", duration_seconds=DURATION, status="QUEUED",
        )
        session.add(job)
        session.commit()

    print("[2/3] running pipeline (planner -> coder -> render -> compose -> validate) ...")
    started = time.monotonic()
    from app.services.orchestrator import run_job
    run_job(job_id)

    with open_session() as session:
        from app.models.db import Artifact, Job
        job = session.get(Job, job_id)
        events = (
            session.query(TaskEvent)
            .filter(TaskEvent.job_id == job_id)
            .order_by(TaskEvent.id.asc())
            .all()
        )
        arts = session.query(Artifact).filter(Artifact.job_id == job_id).all()

    print("\n[3/3] state transitions:")
    for e in events:
        detail = f"  detail={e.detail}" if e.detail else ""
        print(f"  {e.from_status or '-':>10} -> {e.to_status:<10} ({e.event_type}){detail}")

    print(f"\nelapsed: {time.monotonic() - started:.1f}s")
    print(f"final status: {job.status}  progress={job.progress_percent}%")
    if job.error:
        print(f"error: {job.error['code']}: {job.error['message']}")
    for a in arts:
        print(f"  artifact {a.kind:<12} scene={a.scene_id} v={a.version} size={a.size_bytes} {a.path}")

    final = Path(settings.ARTIFACT_ROOT) / "jobs" / job_id / "final.mp4"
    if job.status == "COMPLETED":
        print(f"\nOK: final.mp4 ready -> {final} ({final.stat().st_size} bytes)")
        return 0
    print("\nFAIL: job did not complete")
    return 1


if __name__ == "__main__":
    sys.exit(main())
