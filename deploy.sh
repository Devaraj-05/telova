#!/usr/bin/env bash
# ─── Telova Cloud Run Deployment ─────────────────────────────────────────────
# Deploys both backend and frontend as separate Cloud Run services.
#
# Usage:
#   export PROJECT_ID=telova-492406
#   bash deploy.sh
#
# Prerequisites:
#   - gcloud CLI authenticated with correct project
#   - APIs enabled (this script enables them automatically)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID before running this script.}"
REGION="${REGION:-us-central1}"
SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_ACCOUNT:-}"

echo "═══════════════════════════════════════════════════════════════"
echo "  Telova Cloud Run Deployment"
echo "  Project: ${PROJECT_ID}  |  Region: ${REGION}"
echo "═══════════════════════════════════════════════════════════════"

# ── Enable required APIs ─────────────────────────────────────────────────────
echo ""
echo "▸ Enabling GCP APIs..."
gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  alloydb.googleapis.com >/dev/null

# ── Step 1: Build and Deploy Backend ─────────────────────────────────────────
echo ""
echo "▸ [1/3] Building and deploying backend..."

# gcloud run deploy --source uses the root Dockerfile by default.
# Swap in the backend Dockerfile temporarily.
cp Dockerfile.backend Dockerfile

BACKEND_DEPLOY_ARGS=(
  run deploy telova-backend
  --source .
  --region "${REGION}"
  --platform managed
  --allow-unauthenticated
  --port 8080
  --memory 1Gi
  --cpu 1
  --min-instances 0
  --max-instances 3
  --timeout 300
  --set-env-vars "APP_ENV=production"
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID}"
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true"
  --set-env-vars "GOOGLE_CLOUD_LOCATION=${REGION}"
  --set-env-vars "ADK_MODEL=gemini-2.5-flash"
  --set-env-vars "AGENT_RUNTIME=deterministic"
  --set-env-vars "INTEGRATION_BACKEND=google"
  --set-env-vars "API_AUTH_MODE=disabled"
  --set-env-vars "RATE_LIMIT_ENABLED=true"
  --set-env-vars "JSON_LOGS=true"
  --set-env-vars "DATABASE_URL=sqlite+aiosqlite:///./telova.db"
)

if [[ -n "${SERVICE_ACCOUNT}" ]]; then
  BACKEND_DEPLOY_ARGS+=(--service-account "${SERVICE_ACCOUNT}")
fi

gcloud "${BACKEND_DEPLOY_ARGS[@]}"
rm -f Dockerfile

# Get the backend URL
BACKEND_URL="$(gcloud run services describe telova-backend \
  --region "${REGION}" \
  --format='value(status.url)')"
echo "  ✓ Backend deployed: ${BACKEND_URL}"

# ── Step 2: Build and Deploy Frontend ────────────────────────────────────────
echo ""
echo "▸ [2/3] Building and deploying frontend..."

cp Dockerfile.frontend Dockerfile

FRONTEND_DEPLOY_ARGS=(
  run deploy telova-frontend
  --source .
  --region "${REGION}"
  --platform managed
  --allow-unauthenticated
  --port 3000
  --memory 512Mi
  --cpu 1
  --min-instances 0
  --max-instances 3
  --timeout 60
  --set-env-vars "BACKEND_URL=${BACKEND_URL}"
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL="
  --set-env-vars "NODE_ENV=production"
)

if [[ -n "${SERVICE_ACCOUNT}" ]]; then
  FRONTEND_DEPLOY_ARGS+=(--service-account "${SERVICE_ACCOUNT}")
fi

gcloud "${FRONTEND_DEPLOY_ARGS[@]}"
rm -f Dockerfile

FRONTEND_URL="$(gcloud run services describe telova-frontend \
  --region "${REGION}" \
  --format='value(status.url)')"
echo "  ✓ Frontend deployed: ${FRONTEND_URL}"

# ── Step 3: Update Backend CORS with Frontend URL ────────────────────────────
echo ""
echo "▸ [3/3] Updating backend CORS to allow frontend origin..."
gcloud run services update telova-backend \
  --region "${REGION}" \
  --update-env-vars "CORS_ALLOW_ORIGINS=${FRONTEND_URL},http://localhost:3000" \
  --update-env-vars "FRONTEND_APP_URL=${FRONTEND_URL}"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo ""
echo "  Frontend : ${FRONTEND_URL}"
echo "  Backend  : ${BACKEND_URL}"
echo "  API Docs : ${BACKEND_URL}/docs"
echo ""
echo "  Next steps:"
echo "    1. Update Google OAuth redirect URI in Cloud Console:"
echo "       ${BACKEND_URL}/api/v1/auth/google/callback"
echo ""
echo "    2. Switch to AlloyDB (replace SQLite for production):"
echo "       gcloud run services update telova-backend --region ${REGION} \\"
echo "         --update-env-vars DATABASE_URL=postgresql+asyncpg://user:pass@host/telova"
echo ""
echo "    3. Configure Secret Manager for production secrets:"
echo "       gcloud run services update telova-backend --region ${REGION} \\"
echo "         --update-env-vars USE_SECRET_MANAGER=true"
echo "═══════════════════════════════════════════════════════════════"
