# GCP Deployment Guide

## 1. Local validation in VS Code

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn telova_api.main:app --reload
```

Smoke test:

1. Open `http://127.0.0.1:8000`
2. Create a goal
3. Add an external event
4. Run conflict scan
5. Run weekly review

## 2. Move the repo to Cloud Shell

```bash
git clone <your-repo-url>
cd Telova
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you want the app to connect to AlloyDB from Cloud Run, install the optional GCP extras too:

```bash
pip install ".[gcp]"
```

## 3. Choose a database mode

### Fastest demo path

- Keep SQLite only for short-lived testing in Cloud Shell.
- This is fine for a local smoke pass but not the right long-term Cloud Run database.

### Recommended Cloud Run path

- Provision AlloyDB or PostgreSQL on GCP.
- Set the app to use either:
  - `DATABASE_URL=postgresql+asyncpg://...` if you already expose a standard PostgreSQL endpoint.
  - Or the AlloyDB connector env vars listed below.

## 4. Configure environment variables

At minimum:

```bash
export APP_ENV=production
export APP_TIMEZONE=Asia/Kolkata
export DEFAULT_USER_ID=demo-user
```

If using a standard PostgreSQL URL:

```bash
export DATABASE_URL='postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME'
```

If using the AlloyDB Python connector instead:

```bash
export ALLOYDB_INSTANCE_NAME='projects/PROJECT_ID/locations/us-central1/clusters/CLUSTER/instances/INSTANCE'
export ALLOYDB_DATABASE='telova'
export ALLOYDB_USER='postgres'
export ALLOYDB_PASSWORD='YOUR_PASSWORD'
export ALLOYDB_REFRESH_STRATEGY='lazy'
```

## 5. Create the production schema

Use the reference schema in [infra/alloydb/schema.sql](/d:/New%20folder/Telova/infra/alloydb/schema.sql) if you want a PostgreSQL/AlloyDB-first setup with explicit DDL. The SQLAlchemy models will also create base tables automatically on app startup.

## 6. Run in Cloud Shell before deploying

```bash
uvicorn telova_api.main:app --host 0.0.0.0 --port 8080
```

Then open Cloud Shell Web Preview and confirm:

- `/health`
- `/docs`
- `/api/v1/dashboard?user_id=demo-user`

## 7. Deploy to Cloud Run

```bash
gcloud config set project PROJECT_ID
gcloud run deploy telova-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production,APP_TIMEZONE=Asia/Kolkata,DEFAULT_USER_ID=demo-user
```

If you are using PostgreSQL via `DATABASE_URL`, add it to the deploy command:

```bash
gcloud run deploy telova-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production,APP_TIMEZONE=Asia/Kolkata,DEFAULT_USER_ID=demo-user,DATABASE_URL='postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME'
```

If you are using the AlloyDB connector, add the connector variables instead:

```bash
gcloud run deploy telova-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production,APP_TIMEZONE=Asia/Kolkata,DEFAULT_USER_ID=demo-user,ALLOYDB_INSTANCE_NAME='projects/PROJECT_ID/locations/us-central1/clusters/CLUSTER/instances/INSTANCE',ALLOYDB_DATABASE=telova,ALLOYDB_USER=postgres,ALLOYDB_PASSWORD=YOUR_PASSWORD,ALLOYDB_REFRESH_STRATEGY=lazy
```

## 8. Post-deploy follow-up

1. Replace the DB-backed calendar, task, and notes adapters with Google-backed implementations if you want live Google Workspace integrations.
2. Add Cloud Scheduler jobs to call:
   - `POST /api/v1/webhooks/cron/conflict-check`
   - `POST /api/v1/webhooks/cron/weekly-review`
3. Move sensitive values to Secret Manager before a public demo.


