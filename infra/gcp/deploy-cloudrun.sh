#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID before running this script.}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-telova-api}"
ENV_FILE="${ENV_FILE:-infra/gcp/cloudrun.env.yaml}"
CLOUD_RUN_SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_ACCOUNT:-}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}" >&2
  exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  alloydb.googleapis.com \
  aiplatform.googleapis.com >/dev/null

DEPLOY_ARGS=(
  run deploy "${SERVICE_NAME}"
  --source .
  --region "${REGION}"
  --allow-unauthenticated
  --env-vars-file "${ENV_FILE}"
)

if [[ -n "${CLOUD_RUN_SERVICE_ACCOUNT}" ]]; then
  DEPLOY_ARGS+=(--service-account "${CLOUD_RUN_SERVICE_ACCOUNT}")
fi

gcloud "${DEPLOY_ARGS[@]}" "$@"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"
echo
echo "Cloud Run service deployed."
echo "Service URL: ${SERVICE_URL}"
