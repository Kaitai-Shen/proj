"""Application configuration (pydantic-settings style, backed by python-dotenv).

Reads backend/.env when present (or the file pointed to by ENV_FILE), falling
back to sane defaults for local development. Values may always be overridden
by real environment variables.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # .../backend
PROJECT_ROOT = BACKEND_DIR.parent

_VALID_RENDERER_MODES = {"stub", "local", "docker"}


def load_env() -> None:
    env_file = os.getenv("ENV_FILE", str(BACKEND_DIR / ".env"))
    if Path(env_file).exists():
        load_dotenv(env_file, override=False)


class Settings:
    """Environment-backed settings object."""

    def __init__(self) -> None:
        load_env()
        self.HOST: str = os.getenv("HOST", "127.0.0.1")
        self.PORT: int = int(os.getenv("PORT", "8000"))
        self.DATABASE_URL: str = os.getenv(
            "DATABASE_URL",
            f"sqlite:///{(BACKEND_DIR / 'data' / 'app.db').as_posix()}",
        )
        self.ARTIFACT_ROOT: Path = Path(
            os.getenv("ARTIFACT_ROOT", (BACKEND_DIR / "data" / "artifacts").as_posix())
        )
        self.LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
        self.LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
        self.LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-chat")
        self.RENDERER_MODE: str = os.getenv("RENDERER_MODE", "stub").strip().lower()
        self.RENDER_TIMEOUT_SECONDS: int = int(os.getenv("RENDER_TIMEOUT_SECONDS", "300"))
        self.MAX_RENDER_RETRIES: int = int(os.getenv("MAX_RENDER_RETRIES", "2"))
        self.MAX_CONCURRENT_RENDERS: int = int(os.getenv("MAX_CONCURRENT_RENDERS", "3"))
        self.MAX_VIDEO_DURATION: int = int(os.getenv("MAX_VIDEO_DURATION", "90"))
        self.MAX_JOB_SECONDS: int = int(os.getenv("MAX_JOB_SECONDS", "3600"))
        self.WORKER_ENABLED: bool = os.getenv("WORKER_ENABLED", "true").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        self.WORKER_POLL_INTERVAL: float = float(os.getenv("WORKER_POLL_INTERVAL", "2"))

        if self.RENDERER_MODE not in _VALID_RENDERER_MODES:
            raise ValueError(
                f"RENDERER_MODE must be one of {sorted(_VALID_RENDERER_MODES)}, "
                f"got {self.RENDERER_MODE!r}"
            )
        if self.MAX_CONCURRENT_RENDERS < 1:
            raise ValueError("MAX_CONCURRENT_RENDERS must be >= 1")

    @property
    def data_dir(self) -> Path:
        return BACKEND_DIR / "data"


settings = Settings()
