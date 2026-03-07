#!/usr/bin/env bash
# Seeds demo auth accounts via Supabase Management API
# Safe to re-run (uses upsert logic via ON CONFLICT)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SEED_FILE="$PROJECT_ROOT/supabase/seed-demo.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "ERROR: Seed file not found at $SEED_FILE"
  exit 1
fi

echo "Seeding demo accounts..."

# Try supabase CLI first, fall back to psql
if command -v npx &> /dev/null && npx supabase --version &> /dev/null; then
  npx supabase db execute --file "$SEED_FILE" 2>/dev/null && echo "Seeded via supabase CLI" || {
    echo "supabase CLI failed, trying psql..."
    if [ -n "${DATABASE_URL:-}" ]; then
      psql "$DATABASE_URL" -f "$SEED_FILE"
      echo "Seeded via psql"
    else
      echo "ERROR: DATABASE_URL not set and supabase CLI failed"
      exit 1
    fi
  }
elif [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -f "$SEED_FILE"
  echo "Seeded via psql"
else
  echo "ERROR: Neither supabase CLI nor DATABASE_URL available"
  exit 1
fi

echo "Demo accounts ready"
echo ""
echo "Demo join code: TEST-0000"
echo "Use at: /portal/onboarding?code=TEST-0000"
