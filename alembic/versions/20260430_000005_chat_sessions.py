"""add chat_sessions table for persistent workspace and analytics chats

Revision ID: 20260430_000005
Revises: 20260408_000004
Create Date: 2026-04-30 09:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260430_000005"
down_revision = "20260408_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False, server_default="workspace"),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="New chat"),
        sa.Column("goal_prompt", sa.Text(), nullable=True),
        sa.Column("messages", sa.JSON(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"])
    op.create_index("ix_chat_sessions_kind", "chat_sessions", ["kind"])
    op.create_index(
        "ix_chat_sessions_user_kind",
        "chat_sessions",
        ["user_id", "kind"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_sessions_user_kind", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_kind", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_user_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")
