#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID before running this script.}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-telova-api}"
SCHEDULER_LOCATION="${SCHEDULER_LOCATION:-${REGION}}"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT:?Set SCHEDULER_SERVICE_ACCOUNT before running this script.}"
CRON_TOKEN="${CRON_TOKEN:?Set CRON_TOKEN before running this script.}"
USER_ID="${USER_ID:-demo-user}"
TIME_ZONE="${TIME_ZONE:-Asia/Kolkata}"
CONFLICT_SCHEDULE="${CONFLICT_SCHEDULE:-*/20 * * * *}"
WEEKLY_SCHEDULE="${WEEKLY_SCHEDULE:-0 8 * * MON}"

gcloud config set project "${PROJECT_ID}" >/dev/null

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Could not resolve Cloud Run URL for ${SERVICE_NAME} in ${REGION}." >&2
  exit 1
fi

upsert_job() {
  local job_name="$1"
  local schedule="$2"
  local path="$3"
  local body="$4"

  if gcloud scheduler jobs describe "${job_name}" --location "${SCHEDULER_LOCATION}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${job_name}" \
      --location "${SCHEDULER_LOCATION}" \
      --schedule "${schedule}" \
      --time-zone "${TIME_ZONE}" \
      --uri "${SERVICE_URL}${path}" \
      --http-method POST \
      --headers "Content-Type=application/json,X-Telova-Cron-Token=${CRON_TOKEN}" \
      --message-body "${body}" \
      --oidc-service-account-email "${SCHEDULER_SERVICE_ACCOUNT}" >/dev/null
  else
    gcloud scheduler jobs create http "${job_name}" \
      --location "${SCHEDULER_LOCATION}" \
      --schedule "${schedule}" \
      --time-zone "${TIME_ZONE}" \
      --uri "${SERVICE_URL}${path}" \
      --http-method POST \
      --headers "Content-Type=application/json,X-Telova-Cron-Token=${CRON_TOKEN}" \
      --message-body "${body}" \
      --oidc-service-account-email "${SCHEDULER_SERVICE_ACCOUNT}" >/dev/null
  fi
}

upsert_job \
  "telova-conflict-check" \
  "${CONFLICT_SCHEDULE}" \
  "/api/v1/webhooks/cron/conflict-check" \
  "{\"user_id\":\"${USER_ID}\",\"auto_resolve\":true}"

upsert_job \
  "telova-weekly-review" \
  "${WEEKLY_SCHEDULE}" \
  "/api/v1/webhooks/cron/weekly-review" \
  "{\"user_id\":\"${USER_ID}\",\"auto_resolve\":false}"

echo "Cloud Scheduler jobs are configured for ${SERVICE_URL}."
