"""add user auth and google workspace connections

Revision ID: 20260407_000003
Revises: 20260406_000002
Create Date: 2026-04-07 13:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260407_000003"
down_revision = "20260406_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("google_subject", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("google_subject", name="uq_users_google_subject"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "google_workspace_connections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_email", sa.String(length=255), nullable=False),
        sa.Column("provider_subject", sa.String(length=255), nullable=False),
        sa.Column("granted_scopes", sa.JSON(), nullable=False),
        sa.Column("credentials_json", sa.JSON(), nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_google_workspace_connections_user_id"),
    )
    op.create_index(
        "ix_google_workspace_connections_user_id",
        "google_workspace_connections",
        ["user_id"],
    )
    op.create_index(
        "ix_google_workspace_connections_provider_subject",
        "google_workspace_connections",
        ["provider_subject"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_google_workspace_connections_provider_subject",
        table_name="google_workspace_connections",
    )
    op.drop_index(
        "ix_google_workspace_connections_user_id",
        table_name="google_workspace_connections",
    )
    op.drop_table("google_workspace_connections")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
