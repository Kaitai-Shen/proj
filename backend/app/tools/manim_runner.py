"""Manim render executor with three modes (RENDERER_MODE):

- stub:   no manim needed; synthesizes a test video via ffmpeg testsrc2 so the
          whole pipeline can run end-to-end without manim installed.
- local:  subprocess ``python -m manim -ql source.py GeneratedScene`` in an
          isolated temp working directory, with timeout + output validation.
- docker: ``docker run`` with --network none, non-root user, mem/cpu limits,
          read-only source mount and writable output volume. Parameters are
          prewired; requires a manim-0.19 image (see renderer/ README).

Unified interface::

    render(scene_dir, source_path) -> RenderResult

Every mode re-validates the product with ffprobe after success: a zero exit
code with an invalid product counts as failure.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from app.core.config import settings
from app.tools.ffmpeg_runner import FFmpegError, run_ffmpeg, validate_video


@dataclass
class RenderResult:
    mp4_path: Path | None
    log: str
    returncode: int
    seconds: float
    ok: bool = False
    error: str | None = None
    info: dict = field(default_factory=dict)

    @property
    def error_summary(self) -> str:
        if self.error:
            return self.error
        if self.returncode != 0:
            return f"renderer exited with code {self.returncode}"
        return "render produced an invalid video"
_VERSION_RE = re.compile(r"^source_v(\d+)\.py$")


def _source_version(source_path: Path) -> int:
    m = _VERSION_RE.match(source_path.name)
    return int(m.group(1)) if m else 1


def _scene_meta(scene_dir: Path) -> dict:
    meta_path = scene_dir / "scene_meta.json"
    if meta_path.exists():
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def render(scene_dir: Path, source_path: Path) -> RenderResult:
    """Dispatch to the configured renderer mode and validate the product."""
    scene_dir = Path(scene_dir)
    source_path = Path(source_path)
    version = _source_version(source_path)
    meta = _scene_meta(scene_dir)
    started = time.monotonic()

    if settings.RENDERER_MODE == "stub":
        result = _render_stub(scene_dir, source_path, version, meta, started)
    elif settings.RENDERER_MODE == "local":
        result = _render_local(scene_dir, source_path, version, started)
    elif settings.RENDERER_MODE == "docker":
        result = _render_docker(scene_dir, source_path, version, started)
    else:  # defensive; settings already validates
        result = RenderResult(
            None, f"unknown RENDERER_MODE {settings.RENDERER_MODE}", 1,
            time.monotonic() - started, ok=False,
            error=f"unknown RENDERER_MODE {settings.RENDERER_MODE}",
        )

    _write_render_log(scene_dir, version, result)
    if result.ok and result.mp4_path is not None:
        ok, reason, info = validate_video(result.mp4_path)
        if not ok:
            result.ok = False
            result.error = f"product validation failed: {reason}"
            result.returncode = result.returncode or 1
        else:
            result.info = info
    return result


# ------------------------------------------------------------------ stub mode
def _render_stub(
    scene_dir: Path, source_path: Path, version: int, meta: dict, started: float
) -> RenderResult:
    """No manim required: ffmpeg testsrc2 test video of estimated duration."""
    try:
        est = float(meta.get("estimated_seconds") or 5.0)
    except (TypeError, ValueError):
        est = 5.0
    est = max(1.0, min(est, float(settings.MAX_VIDEO_DURATION)))
    out = scene_dir / f"render_v{version}.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i",
        f"testsrc2=duration={est:g}:size=1920x1080:rate=30",
        "-c:v", "libx264", "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        str(out),
    ]
    try:
        rc, output = run_ffmpeg(cmd, timeout=max(60, est * 10 + 60))
    except FFmpegError as exc:
        return RenderResult(None, f"STUB render failed: {exc}", 1, time.monotonic() - started,
                            ok=False, error=str(exc))
    log = _stub_log_header() + f"\n$ {' '.join(cmd)}\n\n{output}"
    ok = rc == 0 and out.exists() and out.stat().st_size > 0
    return RenderResult(
        out if ok else None, log, rc, time.monotonic() - started,
        ok=ok, error=None if ok else f"ffmpeg stub render failed (rc={rc})",
    )


def _stub_log_header() -> str:
    return (
        "# STUB render — manim is not installed/required in this mode.\n"
        f"# A synthetic 1920x1080@30 testsrc2 clip was generated instead.\n"
        f"# renderer_mode=stub timeout={settings.RENDER_TIMEOUT_SECONDS}s\n"
    )


# ----------------------------------------------------------------- local mode
def _render_local(
    scene_dir: Path, source_path: Path, version: int, started: float
) -> RenderResult:
    """python -m manim in an isolated temp dir; product copied to scene_dir."""
    workdir = Path(tempfile.mkdtemp(prefix=f"aitv-render-v{version}-"))
    out = scene_dir / f"render_v{version}.mp4"
    media_dir = scene_dir / "media"
    try:
        shutil.copyfile(source_path, workdir / "source.py")
        cmd = [
            "python", "-m", "manim", "-ql",
            "source.py", "GeneratedScene",
            "--media_dir", str(media_dir),
        ]
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(workdir),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=settings.RENDER_TIMEOUT_SECONDS,
            )
            rc, output = proc.returncode, (proc.stdout or "") + (proc.stderr or "")
            timed_out = False
        except subprocess.TimeoutExpired as exc:
            rc, output, timed_out = 1, (exc.stdout or "") + (exc.stderr or ""), True
            if isinstance(output, bytes):
                output = output.decode("utf-8", "replace")

        candidates = sorted(media_dir.glob("videos/**/GeneratedScene.mp4"), key=lambda p: p.stat().st_mtime)
        product = candidates[-1] if candidates else None
        if timed_out:
            return RenderResult(None, _local_log(cmd, output, workdir), rc,
                                time.monotonic() - started, ok=False,
                                error=f"render timed out after {settings.RENDER_TIMEOUT_SECONDS}s")
        if rc == 0 and product is None:
            error = "manim exited 0 but no GeneratedScene.mp4 was produced"
        elif rc != 0:
            error = f"manim exited with code {rc}"
        else:
            error = None
        ok = rc == 0 and product is not None and product.stat().st_size > 0
        if ok:
            shutil.copyfile(product, out)
        return RenderResult(
            out if ok else None, _local_log(cmd, output, workdir), rc,
            time.monotonic() - started, ok=ok, error=error,
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _local_log(cmd: list[str], output: str, workdir: Path) -> str:
    return (
        "# LOCAL render (python -m manim)\n"
        f"$ {' '.join(cmd)}\n# workdir={workdir}\n\n{output}"
    )


# ---------------------------------------------------------------- docker mode
_MANIM_IMAGE = "ai-tutor-video-renderer:latest"  # built from renderer/ (see its README)


def _render_docker(
    scene_dir: Path, source_path: Path, version: int, started: float
) -> RenderResult:
    """Hardened container per renderer/README.md protocol: the image's
    entrypoint renders the scene and prints a JSON verdict on stdout.

    The container runs as uid 1000, so the host-side output dir must be
    writable by it (best-effort chmod; the backend typically owns the tree)."""
    out = scene_dir / f"render_v{version}.mp4"
    output_dir = scene_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(output_dir, 0o777)
    except OSError:
        pass  # Windows hosts: chmod is advisory only
    src_dir = source_path.parent

    def _img_tmpfs(path: str, size: str) -> list[str]:
        return ["--tmpfs", f"{path}:size={size},uid=1000,gid=1000,mode=1777"]

    cmd = [
        "docker", "run", "--rm",
        "--name", f"aitv-render-{uuid.uuid4().hex[:10]}",
        "--network", "none",
        "--user", "1000:1000",
        "--memory", "2g", "--memory-swap", "2g",
        "--cpus", "2",
        "--pids-limit", "128",
        "--read-only",
        *_img_tmpfs("/tmp", "256m"),
        *_img_tmpfs("/work/media", "1g"),
        *_img_tmpfs("/home/renderer", "128m"),
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        "-v", f"{src_dir.resolve()}:/task/src:ro",
        "-v", f"{output_dir.resolve()}:/task/out",
        _MANIM_IMAGE,
        f"/task/src/{source_path.name}", "GeneratedScene",
    ]
    docker_bin = shutil.which("docker")
    if docker_bin is None:
        log = (
            "# DOCKER render\n"
            "ERROR: docker executable not found on PATH.\n"
            "RENDERER_MODE=docker requires a running Docker Engine and the\n"
            f"image {_MANIM_IMAGE} (build it from renderer/ — see its README).\n"
            f"Command that would run:\n$ {' '.join(cmd)}"
        )
        return RenderResult(None, log, 127, time.monotonic() - started, ok=False,
                            error="docker executable not found on PATH")
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=settings.RENDER_TIMEOUT_SECONDS,
        )
        rc, output = proc.returncode, proc.stdout or ""
        stderr = proc.stderr or ""
    except subprocess.TimeoutExpired as exc:
        out_txt = ((exc.stdout or "") + (exc.stderr or ""))
        if isinstance(out_txt, bytes):
            out_txt = out_txt.decode("utf-8", "replace")
        return RenderResult(None, _docker_log(cmd, out_txt), 1, time.monotonic() - started,
                            ok=False, error=f"docker render timed out after {settings.RENDER_TIMEOUT_SECONDS}s")
    except FileNotFoundError as exc:
        return RenderResult(None, _docker_log(cmd, str(exc)), 127, time.monotonic() - started,
                            ok=False, error="docker executable not found on PATH")

    log = _docker_log(cmd, output + "\n" + stderr)
    verdict = None
    for line in reversed((output or "").strip().splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                verdict = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
    if verdict is None:
        return RenderResult(None, log, rc or 1, time.monotonic() - started, ok=False,
                            error="docker renderer printed no JSON verdict")
    if not verdict.get("ok"):
        return RenderResult(None, log, 1, time.monotonic() - started, ok=False,
                            error=f"docker renderer failed: {str(verdict.get('error'))[:500]}")

    produced = Path(str(verdict.get("video") or "")).name
    product = output_dir / produced if produced else None
    if product is None or not product.is_file() or product.stat().st_size == 0:
        return RenderResult(None, log, 1, time.monotonic() - started, ok=False,
                            error=f"docker renderer reported {produced!r} but the file is missing")
    shutil.copyfile(product, out)
    return RenderResult(
        out, log, 0, time.monotonic() - started,
        ok=True, info={"container_seconds": verdict.get("seconds"), "resolution": verdict.get("resolution")},
    )


def _docker_log(cmd: list[str], output: str) -> str:
    return f"# DOCKER render\n$ {' '.join(cmd)}\n\n{output}"


def _write_render_log(scene_dir: Path, version: int, result: RenderResult) -> None:
    # render.log holds the latest attempt; render_v{n}.log keeps full history.
    (scene_dir / "render.log").write_text(result.log, encoding="utf-8")
    (scene_dir / f"render_v{version}.log").write_text(result.log, encoding="utf-8")
