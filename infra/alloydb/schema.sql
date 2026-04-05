CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    domain TEXT NOT NULL DEFAULT 'generic_execution',
    status TEXT NOT NULL DEFAULT 'active',
    deadline TIMESTAMPTZ,
    dag_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    deviation DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    phase TEXT NOT NULL DEFAULT 'execution',
    status TEXT NOT NULL DEFAULT 'pending',
    depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_minutes INTEGER NOT NULL DEFAULT 60,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    calendar_event_id TEXT,
    external_task_id TEXT,
    embedding vector(64),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
    task_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'system',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    external_event_id TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'manual',
    external_note_id TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS context_packages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_goal_id TEXT,
    to_goal_id TEXT,
    note_id TEXT,
    summary TEXT NOT NULL,
    open_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replan_events (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    deviation_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    old_dag JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_dag JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_goal_id ON calendar_events(goal_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_embedding_hnsw
ON tasks USING hnsw (embedding vector_cosine_ops);
