"""Composer: normalize every scene MP4, then FFmpeg-concat into final.mp4.

Per contract: 1920x1080, 30 fps, H.264, yuv420p, no audio (P0). Failure
raises ComposeError -> job FAILED_COMPOSE. final.mp4 is re-validated with
ffprobe (video stream present, duration > 0, exact 1920x1080).
"""
from __future__ import annotations

import time
from pathlib import Path

from app.tools.ffmpeg_runner import FFmpegError, run_ffmpeg, validate_video

TARGET_SIZE = (1920, 1080)
TARGET_FPS = 30


def normalize_scene_video(src: Path, dst: Path, timeout: int = 300) -> None:
    """Transcode one scene video to the uniform target format."""
    vf = (
        f"scale={TARGET_SIZE[0]}:{TARGET_SIZE[1]}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_SIZE[0]}:{TARGET_SIZE[1]}:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"fps={TARGET_FPS},format=yuv420p"
    )
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast",
        "-an",
        str(dst),
    ]
    rc, out = run_ffmpeg(cmd, timeout=timeout)
    if rc != 0 or not dst.exists() or dst.stat().st_size == 0:
        tail = "\n".join(out.splitlines()[-15:])
        raise FFmpegError(f"normalize failed for {src.name} (rc={rc}):\n{tail}")


def compose(scene_videos: list[Path], out_path: Path, work_dir: Path,
            timeout: int = 600) -> dict:
    """Concat normalized scene videos into out_path; returns probe info."""
    if not scene_videos:
        raise FFmpegError("no scene videos to compose")
    work_dir.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()

    normalized: list[Path] = []
    concat_list = work_dir / "concat_list.txt"
    try:
        for i, video in enumerate(scene_videos, start=1):
            norm = work_dir / f"norm_v{i:02d}.mp4"
            normalize_scene_video(video, norm)
            normalized.append(norm)

        # concat demuxer requires single-quoted paths, escaped inner quotes
        lines = []
        for p in normalized:
            safe = str(p.resolve()).replace("\\", "/").replace("'", "'\\''")
            lines.append(f"file '{safe}'")
        concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")

        rc, out = run_ffmpeg(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
             "-c", "copy", str(out_path)],
            timeout=timeout,
        )
        if rc != 0 or not out_path.exists() or out_path.stat().st_size == 0:
            tail = "\n".join(out.splitlines()[-15:])
            raise FFmpegError(f"concat failed (rc={rc}):\n{tail}")

        ok, reason, info = validate_video(out_path, expect_size=TARGET_SIZE)
        if not ok:
            raise FFmpegError(f"final.mp4 validation failed: {reason}")
        info["compose_seconds"] = round(time.monotonic() - started, 2)
        return info
    finally:
        for p in normalized:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
        try:
            concat_list.unlink(missing_ok=True)
        except OSError:
            pass
