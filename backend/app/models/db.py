"""SQLAlchemy models: jobs / scenes / artifacts / task_events / model_calls.

Schema follows gateway contract v1.0 §3 and the artifact layout of §6.
SQLite backend (single local worker).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso_z(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # job_xxx
    request_id: Mapped[str] = mapped_column(String(64), default="")
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True)  # reserved
    topic: Mapped[str] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(16))          # beginner | intermediate
    language: Mapped[str] = mapped_column(String(16), default="zh-CN")
    duration_seconds: Mapped[int] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(16), index=True, default="QUEUED")
    substatus: Mapped[str | None] = mapped_column(String(32), nullable=True)  # REPAIRING_CODE
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    current_scene: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scene_count: Mapped[int] = mapped_column(Integer, default=0)

    error_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    scenes: Mapped[list["Scene"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="Scene.order"
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    events: Mapped[list["TaskEvent"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )

    @property
    def error(self) -> dict | None:
        if self.error_code:
            return {"code": self.error_code, "message": self.error_message or ""}
        return None


class Scene(Base):
    __tablename__ = "scenes"
    __table_args__ = (UniqueConstraint("job_id", "scene_id", name="uq_scene_per_job"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), ForeignKey("jobs.id"), index=True)
    scene_id: Mapped[str] = mapped_column(String(16))            # scene_001
    order: Mapped[int] = mapped_column(Integer)
    concept: Mapped[str] = mapped_column(Text, default="")
    narration: Mapped[str] = mapped_column(Text, default="")
    visual_instructions: Mapped[str] = mapped_column(Text, default="")
    estimated_seconds: Mapped[float] = mapped_column(Float, default=0)
    required_objects_json: Mapped[str] = mapped_column(Text, default="[]")

    code_version: Mapped[int] = mapped_column(Integer, default=0)
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)  # latest version
    render_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|ok|failed
    video_path: Mapped[str | None] = mapped_column(Text, nullable=True)  # latest ok mp4

    job: Mapped[Job] = relationship(back_populates="scenes")

    @property
    def required_objects(self) -> list:
        try:
            return json.loads(self.required_objects_json or "[]")
        except (TypeError, ValueError):
            return []


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # art_xxx
    job_id: Mapped[str] = mapped_column(String(64), ForeignKey("jobs.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    scene_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    path: Mapped[str] = mapped_column(Text)                     # absolute on-disk path
    version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    job: Mapped[Job] = relationship(back_populates="artifacts")


class TaskEvent(Base):
    __tablename__ = "task_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), ForeignKey("jobs.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(32))         # STAGE | TERMINAL | CANCEL
    from_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    to_status: Mapped[str] = mapped_column(String(16))
    detail_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    job: Mapped[Job] = relationship(back_populates="events")

    @property
    def detail(self) -> dict | None:
        try:
            return json.loads(self.detail_json) if self.detail_json else None
        except (TypeError, ValueError):
            return None


class ModelCall(Base):
    __tablename__ = "model_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), ForeignKey("jobs.id"), index=True)
    agent: Mapped[str] = mapped_column(String(16))              # planner | coder | fixer
    purpose: Mapped[str] = mapped_column(String(64), default="")
    model: Mapped[str] = mapped_column(String(64), default="")
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---------------------------------------------------------------- engine setup
engine = None
SessionLocal: sessionmaker | None = None


def init_engine(database_url: str) -> None:
    """Create engine + tables. Called by app factory and by offline scripts."""
    global engine, SessionLocal
    if engine is not None:
        return
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, connect_args=connect_args, future=True)

    if database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    Base.metadata.create_all(engine)


def session_factory() -> sessionmaker:
    """Live sessionmaker accessor — always resolve at call time.

    ``SessionLocal`` is created lazily by init_engine (app lifespan), so
    consumers must never capture the module attribute at import time.
    """
    if SessionLocal is None:
        from app.core.config import settings
        init_engine(settings.DATABASE_URL)
    return SessionLocal


def open_session():
    """Create a new Session usable as a context manager (`with open_session()`)."""
    return session_factory()()
