# Telova

Telova is a multi-agent command center that converts a high-level goal into a working execution system across tasks, schedules, notes, re-planning, and tool integrations. The repo now uses a modern Next.js + TypeScript + Tailwind workspace frontend alongside the FastAPI backend, and it is built for local development in VS Code plus a production handoff to Google Cloud Run with AlloyDB, Secret Manager, Cloud Scheduler, and Google Workspace integrations.

## What ships in this repo

- FastAPI backend with async SQLAlchemy persistence and Alembic migrations.
- Next.js App Router frontend with a dark 3-column Agent Workspace, rich chat cards, right-side insight rail, and placeholder routes for dashboard, timeline, notes, replans, agents, and settings.
- Agent runtime support for deterministic local planning and optional Google ADK / Gemini-backed planning.
- AlloyDB-ready data analyst capability that turns natural-language productivity questions into SQL and stores agent/sync telemetry for the hackathon track.
- Integration gateways for database mode and Google-backed Calendar, Tasks, and optional Keep sync.
- Production middleware for API auth, rate limiting, structured logging, readiness reporting, and optional Sentry.
- End-to-end API tests plus Cloud Run / Cloud Scheduler deployment assets in `infra/gcp`.

By default, Telova's application-side Gemini runtime uses `gemini-2.5-flash`. One important exception is AlloyDB AI natural language itself: Google's current documentation still describes that feature's `nl_config` endpoint as `gemini-2.0-flash:generateContent`, so treat that as a managed platform constraint rather than a Telova app setting. If you want a strict `2.5+` data path, disable `ALLOYDB_AI_NL_ENABLED` and use Telova's app-side Gemini SQL analyst against AlloyDB.

## Local setup in VS Code

Run the backend and frontend as two local processes.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn telova_api.main:app --reload
```

In a second terminal:

```bash
copy .env.local.example .env.local
npm install
npm run dev
```

Open:

- `http://127.0.0.1:3000/workspace`
- `http://127.0.0.1:8000/docs`

The frontend talks to FastAPI through `NEXT_PUBLIC_API_BASE_URL`, which defaults to `http://127.0.0.1:8000`. FastAPI also allows local Next.js CORS origins by default through `CORS_ALLOW_ORIGINS`.

## Production frontend serving

The repo is now Next.js-only for frontend. The legacy static UI has been removed.

For production, build the frontend first:

```bash
npm run build
```

That exports the Next.js app into `./out`. FastAPI serves that built frontend directly in production when the `out` directory exists.

If `out` is missing and you open `http://127.0.0.1:8000/`, FastAPI returns a helpful `503` response telling you to run `npm run build`.

## Optional production extras

Install the Google Cloud, ADK, and production extras when you want the full cloud path:

```bash
pip install ".[gcp,adk,prod]"
```

## Test and validation

```bash
python -m compileall telova_api tests
python -m pytest tests
npm run typecheck
npm run build
```

## Google Cloud Shell to Cloud Run

Use the runbook in [docs/gcp-deployment.md](docs/gcp-deployment.md). The short version is:

1. Clone the repo in Cloud Shell and activate a virtual environment.
2. Install `requirements.txt`, then `pip install ".[gcp,adk,prod]"`.
3. Provision AlloyDB and create the needed Secret Manager secrets.
4. Copy [infra/gcp/cloudrun.env.example.yaml](infra/gcp/cloudrun.env.example.yaml) to your own env file and fill in the project values.
5. Run `alembic upgrade head`.
6. Smoke test the app locally in Cloud Shell with `uvicorn telova_api.main:app --host 0.0.0.0 --port 8080`.
7. Deploy with [infra/gcp/deploy-cloudrun.sh](infra/gcp/deploy-cloudrun.sh).
8. Create recurring jobs with [infra/gcp/create-scheduler-jobs.sh](infra/gcp/create-scheduler-jobs.sh).

## Docs

- [Architecture and HLD / LLD](docs/hld-lld.md)
- [Build journal](docs/build-journal.md)
- [GCP deployment guide](docs/gcp-deployment.md)
- [AlloyDB hackathon setup](docs/alloydb-hackathon.md)
