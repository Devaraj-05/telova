# Telova

Telova is a proactive goal-to-execution orchestrator for the Google multi-agent hackathon brief. A user declares a high-level goal, Telova decomposes it into a dependency-aware plan, schedules the work, watches for conflicts, and re-plans when progress slips.

## What is in this repo

- A FastAPI backend with a local-first workflow that runs in VS Code using SQLite.
- Deterministic agent modules for goal decomposition, conflict detection, context bridging, and adaptive re-planning.
- MCP server entry points for calendar, tasks, and notes tools.
- Deployment notes and architecture docs for the later GCP move to Cloud Run and AlloyDB.

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn telova_api.main:app --reload
```

Open `http://127.0.0.1:8000` for the dashboard and `http://127.0.0.1:8000/docs` for the API docs.

## Optional GCP extras

To enable the AlloyDB connector path before deploying from Cloud Shell:

```bash
pip install ".[gcp]"
```

## Docs

- [Architecture and design](docs/hld-lld.md)
- [Build journal](docs/build-journal.md)
- [GCP deployment guide](docs/gcp-deployment.md)

## Cloud Run path

This repo is intentionally local-first for development. The production path is:

1. Switch `DATABASE_URL` from SQLite to PostgreSQL/AlloyDB.
2. Set the AlloyDB connector env vars if you want Cloud Run to connect through the AlloyDB Python connector.
3. Replace the local tool adapters with Google Calendar and Google Tasks backed adapters.
4. Deploy with `gcloud run deploy --source .`.

