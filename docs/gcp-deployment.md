# GCP deployment guide

This guide is the practical Cloud Shell to Cloud Run handoff for Telova's production path.

## 1. Recommended production shape

- Runtime: Cloud Run
- Database: AlloyDB for PostgreSQL
- Secrets: Secret Manager
- Scheduling: Cloud Scheduler
- Model runtime: optional Google ADK / Gemini
- Tool integrations: Google Calendar, Google Tasks, optional Google Keep

## 2. Cloud Shell bootstrap

```bash
git clone <your-repo-url>
cd Telova

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
pip install ".[gcp,adk,prod]"
```

Set your project:

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
gcloud config set project "${PROJECT_ID}"
```

Enable the core services:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  alloydb.googleapis.com \
  aiplatform.googleapis.com
```

## 3. Provision AlloyDB

Create or reuse an AlloyDB cluster and instance, then capture:

- `ALLOYDB_INSTANCE_NAME`
- `ALLOYDB_DATABASE`
- `ALLOYDB_USER`
- either `ALLOYDB_PASSWORD_SECRET` or IAM auth
- optional AlloyDB AI NL config id, for example `telova_nl`

Telova supports both:

- direct PostgreSQL URL through `DATABASE_URL`
- AlloyDB connector mode through the dedicated `ALLOYDB_*` settings

For the Cloud Run path in this repo, AlloyDB connector mode is the intended default.

Important:

- If you want to run Telova from Cloud Shell against AlloyDB before deploying, the AlloyDB instance must be reachable from Cloud Shell. Public IP is the simplest path for that smoke test.
- For Cloud Run, private connectivity is also possible, but that requires the correct VPC setup in your GCP project.
- The Cloud Run runtime service account should have at least:
  - `roles/secretmanager.secretAccessor`
  - `roles/alloydb.client`
  - `roles/aiplatform.user`
  - `roles/serviceusage.serviceUsageConsumer`
- If you enable `ALLOYDB_ENABLE_IAM_AUTH=true`, also grant the runtime service account `roles/alloydb.databaseUser`.

## 3a. Enable AlloyDB AI natural language for Telova

Apply the Telova schema and AI NL bootstrap assets after the database exists:

```bash
psql "${DATABASE_URL}" -f infra/alloydb/schema.sql
psql "${DATABASE_URL}" -f infra/alloydb/telova_ai_nl_setup.sql
```

The second file creates curated secure views plus the `telova_nl` configuration, templates, and fragments used by the Data Analyst agent.

## 4. Create Secret Manager secrets

Create local files that hold the secret payloads, then upsert them with the helper:

```bash
export PROJECT_ID="your-project-id"

./infra/gcp/upsert-secret.sh telova-api-key ./secrets/api-key.txt
./infra/gcp/upsert-secret.sh telova-cron-token ./secrets/cron-token.txt
./infra/gcp/upsert-secret.sh telova-alloydb-password ./secrets/alloydb-password.txt
./infra/gcp/upsert-secret.sh telova-workspace-service-account ./secrets/workspace-sa.json
```

Typical secrets:

- `telova-api-key`
- `telova-cron-token`
- `telova-alloydb-password`
- `telova-workspace-service-account`

If you use authorized-user OAuth instead of a service account, store that JSON payload in Secret Manager and point `GOOGLE_WORKSPACE_AUTHORIZED_USER_SECRET` at it instead.

## 5. Prepare the Cloud Run env file

Copy the example:

```bash
cp infra/gcp/cloudrun.env.example.yaml infra/gcp/cloudrun.env.yaml
```

Edit `infra/gcp/cloudrun.env.yaml` and set:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `INTEGRATION_BACKEND=google`
- `AGENT_RUNTIME=google_adk` only if you want ADK enabled
- `ALLOYDB_INSTANCE_NAME`
- `ALLOYDB_DATABASE`
- `ALLOYDB_USER`
- `ALLOYDB_PASSWORD_SECRET` or `ALLOYDB_ENABLE_IAM_AUTH=true`
- `ALLOYDB_AI_NL_ENABLED=true` when the AI NL setup SQL has been applied
- `ALLOYDB_AI_NL_CONFIG_ID=telova_nl`
- `GOOGLE_WORKSPACE_AUTH_MODE`
- `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_SECRET` or the authorized-user secret field
- `API_KEY_SECRET`
- `CRON_SHARED_TOKEN_SECRET`
- `ADK_MODEL=gemini-2.5-flash` if you enable the Google ADK runtime

Notes:

- Leave `GOOGLE_KEEP_ENABLED=false` unless you explicitly have Keep access in your Workspace environment.
- You can deploy first with `CLOUD_RUN_SERVICE_URL` blank, then update it after the first deployment.
- If you want Gemini on Vertex AI for ADK planning, also keep `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION` in the environment.
- Telova's own Vertex AI runtime can use `gemini-2.5-flash`, but AlloyDB AI natural language is currently documented by Google as using `gemini-2.0-flash:generateContent` for `g_create_configuration()`. If you need strict `2.5+` model usage for app-side generation, use Telova's Google ADK / Gemini runtime and treat AlloyDB AI NL as an optional database-native feature.

## 6. Run migrations and smoke test in Cloud Shell

Apply the schema:

```bash
alembic upgrade head
```

Run the app in Cloud Shell before deploying:

```bash
export APP_ENV=production
uvicorn telova_api.main:app --host 0.0.0.0 --port 8080
```

Check:

- `/health`
- `/docs`
- `/api/v1/system/status`
- `/api/v1/dashboard?user_id=demo-user`

If `API_AUTH_MODE=api_key`, include `X-Telova-API-Key` in your requests.

## 7. Deploy to Cloud Run

Use the helper script:

```bash
chmod +x infra/gcp/deploy-cloudrun.sh
PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" ENV_FILE="infra/gcp/cloudrun.env.yaml" ./infra/gcp/deploy-cloudrun.sh
```

The script:

1. enables the required APIs
2. deploys from source with `gcloud run deploy --source .`
3. prints the final service URL

If you want a custom runtime service account:

```bash
PROJECT_ID="${PROJECT_ID}" \
REGION="${REGION}" \
CLOUD_RUN_SERVICE_ACCOUNT="telova-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
ENV_FILE="infra/gcp/cloudrun.env.yaml" \
./infra/gcp/deploy-cloudrun.sh
```

After the first deploy, update `CLOUD_RUN_SERVICE_URL` in `infra/gcp/cloudrun.env.yaml` with the printed URL and redeploy so the readiness panel shows the final service location.

If `USE_SECRET_MANAGER=true`, make sure the Cloud Run runtime service account can read the referenced secrets before the first request hits the app.

## 8. Configure Cloud Scheduler

Grant the Scheduler invoker service account permission to call Cloud Run if your service is not public:

```bash
gcloud run services add-iam-policy-binding telova-api \
  --region "${REGION}" \
  --member "serviceAccount:scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role "roles/run.invoker"
```

Then create or update the jobs:

```bash
chmod +x infra/gcp/create-scheduler-jobs.sh

PROJECT_ID="${PROJECT_ID}" \
REGION="${REGION}" \
SERVICE_NAME="telova-api" \
SCHEDULER_LOCATION="${REGION}" \
SCHEDULER_SERVICE_ACCOUNT="scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
CRON_TOKEN="$(cat ./secrets/cron-token.txt)" \
./infra/gcp/create-scheduler-jobs.sh
```

This creates:

- `telova-conflict-check`
- `telova-weekly-review`

## 9. Verify the live deployment

Recommended checks after deploy:

1. Open the Cloud Run URL and load the UI.
2. Call `/health`.
3. Call `/api/v1/system/status` and confirm the readiness cards move from pending to ready.
4. Create a goal and confirm tasks and calendar blocks are generated.
5. Run a manual conflict scan and weekly review from the UI.
6. Confirm logs appear in Cloud Logging.

## 10. Production notes

- Google Calendar and Google Tasks integration are implemented and selected through `INTEGRATION_BACKEND=google`.
- Google Keep sync is optional and intentionally guarded because availability can vary by Workspace environment.
- The ADK runtime is optional; if the dependency or config is missing, Telova falls back to deterministic planning instead of breaking the request.
- Rate limiting, API key auth, cron auth, JSON logs, and Alembic are already in the codebase. What remains is only your project-specific provisioning.

## 11. Useful files

- `infra/gcp/cloudrun.env.example.yaml`
- `infra/gcp/deploy-cloudrun.sh`
- `infra/gcp/create-scheduler-jobs.sh`
- `infra/gcp/upsert-secret.sh`
- `infra/alloydb/schema.sql`
- `infra/alloydb/telova_ai_nl_setup.sql`
