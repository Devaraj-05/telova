"""add agent run and sync log telemetry

Revision ID: 20260406_000002
Revises: 20260405_000001
Create Date: 2026-04-06 17:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260406_000002"
down_revision = "20260405_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("goal_id", sa.String(length=36), nullable=True),
        sa.Column("agent_name", sa.String(length=80), nullable=False),
        sa.Column("operation", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("runtime", sa.String(length=80), nullable=False),
        sa.Column("input_payload", sa.JSON(), nullable=False),
        sa.Column("output_payload", sa.JSON(), nullable=False),
        sa.Column("sql_text", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_runs_user_id", "agent_runs", ["user_id"])
    op.create_index("ix_agent_runs_goal_id", "agent_runs", ["goal_id"])

    op.create_table(
        "mcp_sync_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("tool_name", sa.String(length=40), nullable=False),
        sa.Column("operation", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("resource_type", sa.String(length=40), nullable=False),
        sa.Column("goal_id", sa.String(length=36), nullable=True),
        sa.Column("task_id", sa.String(length=36), nullable=True),
        sa.Column("note_id", sa.String(length=36), nullable=True),
        sa.Column("event_id", sa.String(length=36), nullable=True),
        sa.Column("local_id", sa.String(length=128), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mcp_sync_logs_user_id", "mcp_sync_logs", ["user_id"])
    op.create_index("ix_mcp_sync_logs_tool_name", "mcp_sync_logs", ["tool_name"])
    op.create_index("ix_mcp_sync_logs_goal_id", "mcp_sync_logs", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_mcp_sync_logs_goal_id", table_name="mcp_sync_logs")
    op.drop_index("ix_mcp_sync_logs_tool_name", table_name="mcp_sync_logs")
    op.drop_index("ix_mcp_sync_logs_user_id", table_name="mcp_sync_logs")
    op.drop_table("mcp_sync_logs")

    op.drop_index("ix_agent_runs_goal_id", table_name="agent_runs")
    op.drop_index("ix_agent_runs_user_id", table_name="agent_runs")
    op.drop_table("agent_runs")
