#!/usr/bin/env bash
set -euo pipefail

# Supabase Preview Database Setup
# Creates a preview branch and seeds it with synthetic data.
# Required env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Error: SUPABASE_PROJECT_REF is required"
  exit 1
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is required"
  exit 1
fi

GIT_BRANCH="${GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')}"
BRANCH_NAME="preview-${GIT_BRANCH}"
API_URL="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}"

echo "Setting up preview database: ${BRANCH_NAME}"
echo "---"

# Attempt to create a Supabase branch
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_URL}/branches" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"branch_name\": \"${BRANCH_NAME}\"}" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "Branch '${BRANCH_NAME}' created successfully"
elif [ "$HTTP_CODE" = "409" ]; then
  echo "Branch '${BRANCH_NAME}' already exists — reusing"
else
  echo "Could not create branch automatically (HTTP ${HTTP_CODE})"
  echo "Response: ${BODY}"
  echo ""
  echo "Manual setup required:"
  echo "  1. Go to Supabase Dashboard > Project > Branches"
  echo "  2. Create a branch named: ${BRANCH_NAME}"
  echo "  3. Run migrations: supabase db push --db-url <PREVIEW_DB_URL>"
  echo ""
  echo "If branching is not available on your plan:"
  echo "  1. Create a new Supabase project for preview"
  echo "  2. Update SUPABASE_PROJECT_REF and re-run"
fi

# Push migrations
echo ""
echo "Pushing database migrations..."
if command -v supabase &>/dev/null; then
  supabase db push --project-ref "${SUPABASE_PROJECT_REF}" 2>&1 || {
    echo "Migration push failed — ensure supabase CLI is configured"
  }
else
  echo "Supabase CLI not found. Install: npm i -g supabase"
fi

# Seed preview data
SEED_FILE="$(cd "$(dirname "$0")/.." && pwd)/supabase/seed-preview.sql"
if [ -f "$SEED_FILE" ]; then
  echo ""
  echo "Seeding preview data..."
  if command -v psql &>/dev/null && [ -n "${PREVIEW_DB_URL:-}" ]; then
    psql "${PREVIEW_DB_URL}" -f "$SEED_FILE"
    echo "Preview data seeded successfully"
  else
    echo "To seed data manually: psql \$PREVIEW_DB_URL -f supabase/seed-preview.sql"
  fi
else
  echo "Seed file not found: ${SEED_FILE}"
fi

echo ""
echo "Done."
