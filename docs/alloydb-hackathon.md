# Telova AlloyDB Hackathon Setup

## One-line use case

Querying personal productivity data across goals, tasks, schedules, notes, and agent activity.

## What Telova now stores in AlloyDB

- `goals`
- `tasks`
- `calendar_events`
- `notes`
- `context_packages`
- `replan_events`
- `agent_runs`
- `mcp_sync_logs`

## Why this satisfies the hackathon ask

- The dataset is Telova productivity data, not the default codelab dataset.
- The schema is custom and includes new hackathon-specific tables for agent telemetry and MCP sync history.
- AlloyDB AI natural language is enabled through `infra/alloydb/telova_ai_nl_setup.sql`.
- The Data Analyst API converts natural language questions into SQL, executes them, and returns results.

## SQL assets

- Base schema: `infra/alloydb/schema.sql`
- AlloyDB AI natural language bootstrap: `infra/alloydb/telova_ai_nl_setup.sql`

## Curated NL-SQL views

- `telova_goal_execution_secure`
- `telova_schedule_pressure_secure`
- `telova_agent_activity_secure`

These views are filtered by `current_setting('telova.user_id', true)` so the application can scope results to the active user before calling AlloyDB AI natural language.

## Example natural-language questions

- `Which active goals have overdue tasks?`
- `What is due today?`
- `Which tasks are blocked?`
- `Which goal has the highest deviation from plan?`
- `What did the agents do recently?`

## API endpoints in Telova

- `POST /api/v1/analytics/query`
- `GET /api/v1/agent-runs`
- `GET /api/v1/sync-logs`

## Required environment settings

```yaml
ALLOYDB_AI_NL_ENABLED: "true"
ALLOYDB_AI_NL_CONFIG_ID: "telova_nl"
ALLOYDB_INSTANCE_NAME: "projects/PROJECT/locations/us-central1/clusters/CLUSTER/instances/INSTANCE"
ALLOYDB_DATABASE: "telova"
ALLOYDB_USER: "postgres"
ALLOYDB_PASSWORD_SECRET: "telova-alloydb-password"
```

## App behavior

- If AlloyDB AI natural language is available, Telova uses it to generate SQL against the curated secure views.
- If it is not available, Telova falls back to deterministic SQL templates so the local app and tests still work.
- Telova's application-side Gemini runtime is configured around `gemini-2.5-flash`, but AlloyDB AI natural language currently documents `gemini-2.0-flash:generateContent` as its managed model endpoint. That model choice is controlled by the AlloyDB AI feature, not by Telova's `ADK_MODEL` setting.
