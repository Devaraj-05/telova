"""initial schema

Revision ID: 20260405_000001
Revises:
Create Date: 2026-04-05 20:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260405_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("domain", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dag_json", sa.JSON(), nullable=False),
        sa.Column("deviation", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("goal_id", sa.String(length=36), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("phase", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("depends_on", sa.JSON(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("calendar_event_id", sa.String(length=36), nullable=True),
        sa.Column("external_task_id", sa.String(length=128), nullable=True),
        sa.Column("embedding", sa.JSON(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tasks_goal_id", "tasks", ["goal_id"])
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])

    op.create_table(
        "calendar_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("goal_id", sa.String(length=36), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=True),
        sa.Column("task_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("external_event_id", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_calendar_events_user_id", "calendar_events", ["user_id"])
    op.create_index("ix_calendar_events_goal_id", "calendar_events", ["goal_id"])
    op.create_index("ix_calendar_events_task_id", "calendar_events", ["task_id"])
    op.create_index("ix_calendar_events_start_at", "calendar_events", ["start_at"])
    op.create_index("ix_calendar_events_end_at", "calendar_events", ["end_at"])

    op.create_table(
        "notes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("goal_id", sa.String(length=36), sa.ForeignKey("goals.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("note_type", sa.String(length=40), nullable=False),
        sa.Column("external_note_id", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notes_user_id", "notes", ["user_id"])
    op.create_index("ix_notes_goal_id", "notes", ["goal_id"])

    op.create_table(
        "context_packages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("from_goal_id", sa.String(length=36), nullable=True),
        sa.Column("to_goal_id", sa.String(length=36), nullable=True),
        sa.Column("note_id", sa.String(length=36), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("open_items", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_context_packages_user_id", "context_packages", ["user_id"])
    op.create_index("ix_context_packages_from_goal_id", "context_packages", ["from_goal_id"])
    op.create_index("ix_context_packages_to_goal_id", "context_packages", ["to_goal_id"])

    op.create_table(
        "replan_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("goal_id", sa.String(length=36), nullable=False),
        sa.Column("deviation_pct", sa.Float(), nullable=False),
        sa.Column("old_dag", sa.JSON(), nullable=False),
        sa.Column("new_dag", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_replan_events_goal_id", "replan_events", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_replan_events_goal_id", table_name="replan_events")
    op.drop_table("replan_events")

    op.drop_index("ix_context_packages_to_goal_id", table_name="context_packages")
    op.drop_index("ix_context_packages_from_goal_id", table_name="context_packages")
    op.drop_index("ix_context_packages_user_id", table_name="context_packages")
    op.drop_table("context_packages")

    op.drop_index("ix_notes_goal_id", table_name="notes")
    op.drop_index("ix_notes_user_id", table_name="notes")
    op.drop_table("notes")

    op.drop_index("ix_calendar_events_end_at", table_name="calendar_events")
    op.drop_index("ix_calendar_events_start_at", table_name="calendar_events")
    op.drop_index("ix_calendar_events_task_id", table_name="calendar_events")
    op.drop_index("ix_calendar_events_goal_id", table_name="calendar_events")
    op.drop_index("ix_calendar_events_user_id", table_name="calendar_events")
    op.drop_table("calendar_events")

    op.drop_index("ix_tasks_user_id", table_name="tasks")
    op.drop_index("ix_tasks_goal_id", table_name="tasks")
    op.drop_table("tasks")

    op.drop_index("ix_goals_user_id", table_name="goals")
    op.drop_table("goals")
