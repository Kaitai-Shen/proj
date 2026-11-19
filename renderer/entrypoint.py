"""Manim renderer container entrypoint.

Protocol (invoked by the backend's docker renderer mode):
    docker run <policies> \
      -v <abs_source_dir>:/task/src:ro \
      -v <abs_out_dir>:/task/out \
      ai-tutor-video-renderer:latest \
      /task/src/source_v1.py GeneratedScene

stdout on exit is a single-line JSON:
    {"ok": true, "video": "/task/out/render_v1.mp4", "seconds": 12.3,
     "resolution": "1920x1080", "fps": 30}
    {"ok": false, "error": "<last 2000 chars of log>"}
Exit code 0 only when ok=true AND the output mp4 passed ffprobe validation.
"""

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time

SOURCE_MAX_BYTES = 512 * 1024
MEDIA_DIR = pathlib.Path("/work/media")
OUT_DIR = pathlib.Path("/task/out")
SRC = pathlib.Path("/task/src")
RESOLUTION = "1920,1080"
FPS = "30"


def fail(message: str) -> None:
    print(json.dumps({"ok": False, "error": message[-2000:]}))
    sys.exit(1)


def main() -> None:
    if len(sys.argv) < 2:
        fail("usage: entrypoint.py <source.py> [ClassName]")
    source = pathlib.Path(sys.argv[1])
    class_name = sys.argv[2] if len(sys.argv) > 2 else "GeneratedScene"
    version = source.stem  # e.g. source_v1

    if not source.is_file():
        fail(f"source not found: {source}")
    if not source.resolve().is_relative_to(SRC.resolve()):
        fail("source must live under /task/src")
    if source.stat().st_size > SOURCE_MAX_BYTES:
        fail("source exceeds 512KB")

    code = source.read_text(encoding="utf-8", errors="replace")
    if re.search(r"\b(import\s+(os|sys|subprocess|socket|requests|urllib|shutil)|from\s+(os|sys|subprocess|socket|requests|urllib))\b", code):
        fail("forbidden import detected (static precheck)")

    shutil.rmtree(MEDIA_DIR, ignore_errors=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        "manim", "render",
        "--resolution", RESOLUTION,
        "--fps", FPS,
        "--media_dir", str(MEDIA_DIR),
        "-v", "WARNING",
        str(source),
        class_name,
    ]
    started = time.time()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=int(os.environ.get("RENDER_TIMEOUT_SECONDS", "300")),
            cwd="/work",
        )
    except subprocess.TimeoutExpired:
        fail(f"render timeout after {os.environ.get('RENDER_TIMEOUT_SECONDS', '300')}s")
    log = (proc.stdout or "") + "\n" + (proc.stderr or "")
    (OUT_DIR / f"{version}.log").write_text(log[-100000:], encoding="utf-8")
    if proc.returncode != 0:
        fail(log)

    candidates = sorted(MEDIA_DIR.rglob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        fail("manim produced no mp4")
    out_video = OUT_DIR / f"{version}.mp4"
    shutil.move(str(candidates[0]), out_video)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,avg_frame_rate:format=duration",
         "-of", "json", str(out_video)],
        capture_output=True, text=True,
    )
    if probe.returncode != 0:
        fail("ffprobe could not parse output video")
    meta = json.loads(probe.stdout)
    duration = float(meta.get("format", {}).get("duration") or 0)
    if duration <= 0:
        fail("output video has zero duration")

    elapsed = round(time.time() - started, 2)
    print(json.dumps({
        "ok": True,
        "video": str(out_video),
        "seconds": elapsed,
        "resolution": RESOLUTION.replace(",", "x"),
        "fps": int(FPS),
        "duration": duration,
        "log": str(OUT_DIR / f"{version}.log"),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
