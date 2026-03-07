#!/usr/bin/env bash
# Seeds demo data into Supabase (local or production).
# Safe to re-run (uses upsert / DELETE-before-insert).
#
# Usage:
#   Local:      ./scripts/seed-demo-accounts.sh
#   Production: SUPABASE_ENV=production SUPABASE_PROJECT_REF=<ref> ./scripts/seed-demo-accounts.sh
#
# Requires: supabase CLI (npx supabase) or DATABASE_URL env var for psql fallback.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SEED_FILE="$PROJECT_ROOT/supabase/seed-demo.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "ERROR: Seed file not found at $SEED_FILE"
  exit 1
fi

# ── Safety check for production ──
ENV="${SUPABASE_ENV:-local}"
PROJECT_REF="${SUPABASE_PROJECT_REF:-}"

if [ "$ENV" = "production" ]; then
  if [ -z "$PROJECT_REF" ]; then
    echo "ERROR: SUPABASE_PROJECT_REF is required when SUPABASE_ENV=production"
    exit 1
  fi
  echo "╔══════════════════════════════════════════╗"
  echo "║  PRODUCTION SEED — $PROJECT_REF  ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""
  read -r -p "Type 'yes' to confirm production seed: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Seeding demo data (env=$ENV)..."

# ── Execute seed SQL ──
run_seed() {
  if [ "$ENV" = "production" ] && [ -n "$PROJECT_REF" ]; then
    # Production: use --project-ref flag
    npx supabase db execute --project-ref "$PROJECT_REF" --file "$SEED_FILE"
  elif command -v npx &> /dev/null && npx supabase --version &> /dev/null 2>&1; then
    npx supabase db execute --file "$SEED_FILE" 2>/dev/null
  elif [ -n "${DATABASE_URL:-}" ]; then
    psql "$DATABASE_URL" -f "$SEED_FILE"
  else
    echo "ERROR: Neither supabase CLI nor DATABASE_URL available"
    exit 1
  fi
}

run_seed
echo "Seed SQL executed."

# ── Verification: confirm TEST-0000 exists ──
echo ""
echo "Verifying join code TEST-0000..."
VERIFY_SQL="SELECT code FROM join_codes WHERE code = 'TEST-0000' AND redeemed_at IS NULL;"

if [ "$ENV" = "production" ] && [ -n "$PROJECT_REF" ]; then
  RESULT=$(npx supabase db execute --project-ref "$PROJECT_REF" --command "$VERIFY_SQL" 2>/dev/null || echo "")
elif command -v npx &> /dev/null && npx supabase --version &> /dev/null 2>&1; then
  RESULT=$(npx supabase db execute --command "$VERIFY_SQL" 2>/dev/null || echo "")
elif [ -n "${DATABASE_URL:-}" ]; then
  RESULT=$(psql "$DATABASE_URL" -t -c "$VERIFY_SQL" 2>/dev/null || echo "")
else
  RESULT=""
fi

if echo "$RESULT" | grep -q "TEST-0000"; then
  echo "PASS: TEST-0000 exists and is unredeemed"
else
  echo "FAIL: TEST-0000 not found or already redeemed"
  echo "      Re-run this script or check the join_codes table manually."
  exit 1
fi

echo ""
echo "Demo seed complete (env=$ENV)"
echo "  Join code: TEST-0000"
echo "  Portal:    /portal/onboarding?code=TEST-0000"
