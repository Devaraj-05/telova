"""add AlloyDB AI natural-language secure views

Revision ID: 20260408_000004
Revises: 20260407_000003
Create Date: 2026-04-08 10:00:00

These three PostgreSQL views expose curated, row-scoped projections of Telova's
core tables for the AlloyDB AI natural-language SQL feature.  The views rely on
the session-local ``telova.user_id`` setting (set by
``ProductivityDataAnalystService._set_workspace_user``) so every AI-generated
query is automatically scoped to the current user without requiring a WHERE
clause in the prompt.

The views are deliberately read-only (no INSERT/UPDATE/DELETE paths) and
reference only non-sensitive columns.  They are skipped silently when running
against SQLite (local development).
"""

from __future__ import annotations

from alembic import op


revision = "20260408_000004"
down_revision = "20260407_000003"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# View DDL
# ---------------------------------------------------------------------------
# Each view filters on current_setting('telova.user_id', true).  The second
# argument ``true`` makes the call return NULL (rather than raise) when the
# setting is absent, which prevents errors if the view is queried directly
# outside of Telova's data-analyst flow.

_VIEW_GOAL_EXECUTION = """
CREATE OR REPLACE VIEW telova_goal_execution_secure AS
SELECT
    g.id           AS goal_id,
    g.title        AS goal_title,
    g.domain,
    g.status       AS goal_status,
    g.deadline,
    g.deviation,
    t.id           AS task_id,
    t.title        AS task_title,
    t.phase,
    t.status       AS task_status,
    t.estimated_minutes,
    t.scheduled_start,
    t.scheduled_end,
    t.completed_at,
    t.order_index
FROM goals AS g
LEFT JOIN tasks AS t
    ON t.goal_id = g.id
WHERE g.user_id = current_setting('telova.user_id', true);
"""

_VIEW_SCHEDULE_PRESSURE = """
CREATE OR REPLACE VIEW telova_schedule_pressure_secure AS
SELECT
    e.id           AS event_id,
    e.title        AS event_title,
    e.source,
    e.start_at,
    e.end_at,
    e.goal_id,
    e.task_id,
    COALESCE(g.title, 'Unlinked') AS goal_title,
    COALESCE(t.title, 'Unlinked') AS task_title,
    COALESCE(t.status, 'n/a')     AS task_status
FROM calendar_events AS e
LEFT JOIN goals AS g
    ON g.id = e.goal_id
LEFT JOIN tasks AS t
    ON t.id = e.task_id
WHERE e.user_id = current_setting('telova.user_id', true);
"""

_VIEW_AGENT_ACTIVITY = """
CREATE OR REPLACE VIEW telova_agent_activity_secure AS
SELECT
    ar.id           AS run_id,
    ar.agent_name,
    ar.operation,
    ar.status,
    ar.runtime,
    ar.started_at,
    ar.completed_at,
    ar.goal_id,
    ar.sql_text,
    COALESCE(g.title, 'Global') AS goal_title
FROM agent_runs AS ar
LEFT JOIN goals AS g
    ON g.id = ar.goal_id
WHERE ar.user_id = current_setting('telova.user_id', true);
"""

_DROP_VIEWS = [
    "DROP VIEW IF EXISTS telova_agent_activity_secure;",
    "DROP VIEW IF EXISTS telova_schedule_pressure_secure;",
    "DROP VIEW IF EXISTS telova_goal_execution_secure;",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # Views rely on PostgreSQL's current_setting(); skip for SQLite / other.
        return

    op.execute(_VIEW_GOAL_EXECUTION)
    op.execute(_VIEW_SCHEDULE_PRESSURE)
    op.execute(_VIEW_AGENT_ACTIVITY)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for stmt in _DROP_VIEWS:
        op.execute(stmt)
