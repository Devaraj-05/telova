# Telova Build Journal

## Source of truth

- Claude share: `https://claude.ai/share/4cc48be5-314a-41b7-8c7f-a39c4bc9a37e`
- Extracted concept: goal-driven, proactive multi-agent execution platform with calendar, task, notes, scheduling, conflict detection, and weekly adaptation.

## Working assumptions

1. The repo starts empty, so this implementation is greenfield.
2. Local development in VS Code must run without Google Cloud credentials.
3. Production deployment on GCP must still be a first-class path, so local adapters are built behind stable interfaces.
4. The hackathon deliverable is API-first, with an optional lightweight dashboard for demos.

## Module checklist

- [x] Project scaffold and runtime configuration
- [x] Database schema and repository layer
- [x] Goal decomposition agent
- [x] Conflict sentinel agent
- [x] Context bridge agent
- [x] Progress adaptor agent
- [x] Orchestrator service
- [x] FastAPI endpoints
- [x] MCP servers
- [x] Local dashboard
- [x] Tests
- [x] GCP deployment notes

## Implementation notes

- SQLite is the default development database because it keeps the local setup frictionless.
- Semantic search is implemented locally with deterministic hashed embeddings so the feature works before AlloyDB is provisioned.
- The production upgrade path to AlloyDB pgvector is documented in the HLD/LLD.
- The runtime now supports an optional AlloyDB connector path through environment variables, so Cloud Run can move off local SQLite without rewriting the persistence layer.

## Verification performed

- `python -m compileall telova_api tests`
- `python -c "from telova_api.main import app; print(app.title)"`
- `python -m pytest tests`
- `python -c "import asyncio; from telova_api.db import init_db, close_db; asyncio.run(init_db()); print('db-ok'); asyncio.run(close_db())"`
- FastAPI smoke flow via `TestClient`: create goal, then load dashboard successfully

## Dependency note

- The repo is pinned to the newer FastAPI line so it stays compatible with the current MCP package set and Starlette runtime.

## Next deployment step

1. Install dependencies locally and run `uvicorn telova_api.main:app --reload`.
2. Create at least one goal and one external event from the dashboard.
3. In Cloud Shell, install the optional GCP extras and follow `docs/gcp-deployment.md`.

