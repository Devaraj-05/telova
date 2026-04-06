from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from telova_api.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class GoalStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class TaskStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"
    BLOCKED = "blocked"


class EventSource(StrEnum):
    SYSTEM = "system"
    EXTERNAL = "external"


class NoteType(StrEnum):
    CONTEXT_PACKAGE = "context_package"
    STATUS_REPORT = "status_report"
    MANUAL = "manual"


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    domain: Mapped[str] = mapped_column(String(100), default="generic_execution")
    status: Mapped[str] = mapped_column(String(20), default=GoalStatus.ACTIVE.value)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dag_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    deviation: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
    )
    calendar_events: Mapped[list["CalendarEvent"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
    )
    notes: Mapped[list["Note"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    goal_id: Mapped[str] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    phase: Mapped[str] = mapped_column(String(100), default="execution")
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.PENDING.value)
    depends_on: Mapped[list[str]] = mapped_column(JSON, default=list)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=60)
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calendar_event_id: Mapped[str | None] = mapped_column(String(36), default=None)
    external_task_id: Mapped[str | None] = mapped_column(String(128), default=None)
    embedding: Mapped[list[float]] = mapped_column(JSON, default=list)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    goal: Mapped["Goal"] = relationship(back_populates="tasks")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    goal_id: Mapped[str | None] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        index=True,
        default=None,
    )
    task_id: Mapped[str | None] = mapped_column(String(36), index=True, default=None)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(20), default=EventSource.SYSTEM.value)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    external_event_id: Mapped[str | None] = mapped_column(String(128), default=None)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    goal: Mapped["Goal | None"] = relationship(back_populates="calendar_events")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    goal_id: Mapped[str | None] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        index=True,
        default=None,
    )
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    note_type: Mapped[str] = mapped_column(String(40), default=NoteType.MANUAL.value)
    external_note_id: Mapped[str | None] = mapped_column(String(128), default=None)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    goal: Mapped["Goal | None"] = relationship(back_populates="notes")


class ContextPackage(Base):
    __tablename__ = "context_packages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    from_goal_id: Mapped[str | None] = mapped_column(String(36), index=True, default=None)
    to_goal_id: Mapped[str | None] = mapped_column(String(36), index=True, default=None)
    note_id: Mapped[str | None] = mapped_column(String(36), default=None)
    summary: Mapped[str] = mapped_column(Text)
    open_items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )


class ReplanEvent(Base):
    __tablename__ = "replan_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    goal_id: Mapped[str] = mapped_column(String(36), index=True)
    deviation_pct: Mapped[float] = mapped_column(Float, default=0.0)
    old_dag: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    new_dag: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    summary: Mapped[str] = mapped_column(Text)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )


