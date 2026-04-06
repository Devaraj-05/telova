#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID before running this script.}"
SECRET_NAME="${1:?Usage: ./infra/gcp/upsert-secret.sh <secret-name> <file-path>}"
SECRET_FILE="${2:?Usage: ./infra/gcp/upsert-secret.sh <secret-name> <file-path>}"

if [[ ! -f "${SECRET_FILE}" ]]; then
  echo "Secret file not found: ${SECRET_FILE}" >&2
  exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

if gcloud secrets describe "${SECRET_NAME}" >/dev/null 2>&1; then
  gcloud secrets versions add "${SECRET_NAME}" --data-file "${SECRET_FILE}" >/dev/null
else
  gcloud secrets create "${SECRET_NAME}" --replication-policy "automatic" >/dev/null
  gcloud secrets versions add "${SECRET_NAME}" --data-file "${SECRET_FILE}" >/dev/null
fi

echo "Secret upserted: ${SECRET_NAME}"
