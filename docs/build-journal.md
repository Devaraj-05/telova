# Telova Build Journal

## Source of truth

- Claude share: `https://claude.ai/share/4cc48be5-314a-41b7-8c7f-a39c4bc9a37e`
- Product direction: command-center style, multi-agent goal orchestration with scheduling, adaptive re-planning, notes memory, MCP compatibility, and a Google Cloud deployment path.

## Delivery assumptions

1. The repo must run in VS Code with no required GCP credentials.
2. The same codebase must promote cleanly to Cloud Run.
3. Production integrations should sit behind stable gateways so the local demo mode still works.
4. The UI should look like a hackathon-ready command center, not a placeholder dashboard.

## Module checklist

- [x] Project scaffold and runtime configuration
- [x] Database models, repository layer, and Alembic migration scaffold
- [x] Goal decomposer, conflict sentinel, context bridge, and progress adaptor agents
- [x] Deterministic planning runtime
- [x] Google ADK / Gemini planning runtime hook with safe fallback
- [x] Orchestrator service and FastAPI endpoints
- [x] MCP-compatible integration surfaces
- [x] Database-backed local adapters
- [x] Google Calendar, Google Tasks, and optional Google Keep adapters
- [x] Secret Manager resolution support
- [x] API auth, cron auth, rate limiting, structured logging, and optional Sentry
- [x] Command-center UI across all required screens
- [x] End-to-end API tests
- [x] Cloud Run, AlloyDB, and Cloud Scheduler deployment assets

## Implementation phases

### Phase 1: Core platform

- Built the async FastAPI service, SQLAlchemy models, repository layer, orchestration service, and dashboard API.
- Kept SQLite as the default local database to avoid blocking VS Code development.

### Phase 2: Planning and adaptation

- Implemented dependency-aware goal decomposition and schedule materialization.
- Added conflict scanning, context switching, and weekly review re-planning flows.
- Preserved deterministic local behavior so the product still works without external model access.

### Phase 3: Production and Google stack

- Added configurable Google-backed gateways for Calendar, Tasks, and Keep-style note sync.
- Added `SecretResolver` for plain env vars, mounted files, or Secret Manager secrets.
- Added optional Google ADK runtime support with fallback to deterministic planning.
- Added request middleware for API key auth, cron token auth, rate limiting, request ids, and structured access logs.
- Added readiness reporting so the system status view reflects true deployment posture.

### Phase 4: UI rebuild

- Replaced the earlier lightweight screen with a desktop-first command center.
- Implemented the required flows: welcome, dashboard, goal creation, AI plan view, calendar, kanban board, replan, notes, and system status.
- Added loading, search, adaptive modal, note editing, and schedule interaction flows so the demo feels live.

## Verification performed

- `python -m compileall telova_api tests`
- `node --check telova_api/static/app.js`
- `python -m pytest tests`
- FastAPI smoke checks for `/health`, `/`, `/api/v1/system/status`, `/api/v1/tasks`, and `/api/v1/notes`

## External setup still required

The codebase now contains the production modules. What still depends on your GCP project and credentials is:

1. Provisioning AlloyDB, service accounts, and Secret Manager secrets.
2. Supplying Google Workspace credentials for Calendar / Tasks / Keep sync.
3. Installing optional extras in Cloud Shell with `pip install ".[gcp,adk,prod]"`.
4. Deploying to Cloud Run and creating Cloud Scheduler jobs with the provided scripts.

## Working reference

- Local dev: `uvicorn telova_api.main:app --reload`
- Cloud handoff: `docs/gcp-deployment.md`
- Deployment assets: `infra/gcp`
