"""FFmpeg / ffprobe helpers shared by renderer and composer."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


class FFmpegError(Exception):
    pass


def run_ffmpeg(args: list[str], timeout: int = 600) -> tuple[int, str]:
    """Run ffmpeg/ffprobe with the given args; return (returncode, combined output)."""
    cmd = args if args and args[0] in ("ffmpeg", "ffprobe") else ["ffmpeg", *args]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise FFmpegError(f"{cmd[0]} executable not found on PATH") from exc
    except subprocess.TimeoutExpired as exc:
        raise FFmpegError(f"{cmd[0]} timed out after {timeout}s") from exc
    out = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, out


def ffprobe_json(path: Path) -> dict | None:
    """Return ffprobe JSON for a media file, or None when unparseable/missing."""
    if not path.exists() or path.stat().st_size == 0:
        return None
    rc, out = run_ffmpeg(
        [
            "ffprobe",
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        timeout=60,
    )
    if rc != 0:
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def validate_video(
    path: Path,
    expect_size: tuple[int, int] | None = None,
) -> tuple[bool, str, dict]:
    """Check video stream exists, duration > 0; optionally exact resolution.

    Returns (ok, reason, info) where info = {duration_seconds, width, height}.
    """
    data = ffprobe_json(path)
    if not data:
        return False, "ffprobe could not parse the file", {}
    streams = data.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        return False, "no video stream found", {}
    try:
        duration = float((data.get("format") or {}).get("duration") or video.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    if duration <= 0:
        return False, "duration is not positive", {}
    try:
        width = int(video.get("width") or 0)
        height = int(video.get("height") or 0)
    except (TypeError, ValueError):
        width = height = 0
    if width <= 0 or height <= 0:
        return False, "missing resolution", {}
    if expect_size and (width, height) != expect_size:
        return False, f"unexpected resolution {width}x{height}, expected {expect_size[0]}x{expect_size[1]}", {}
    info = {"duration_seconds": duration, "width": width, "height": height}
    return True, "", info
