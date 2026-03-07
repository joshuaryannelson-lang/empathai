#!/usr/bin/env bash
set -euo pipefail

# Supabase Backup Verification
# Checks that the latest backup is less than 25 hours old.
# Required env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN
# Optional env: SLACK_WEBHOOK_URL (for failure alerts)

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Error: SUPABASE_PROJECT_REF is required"
  exit 1
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is required"
  exit 1
fi

MAX_AGE_HOURS=25
API_URL="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/backups"

echo "Checking backup status for project: ${SUPABASE_PROJECT_REF}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  "${API_URL}" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

send_slack_alert() {
  local message="$1"
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -s -X POST "${SLACK_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\": \"#ops-alerts\", \"text\": \"${message}\"}" \
      > /dev/null 2>&1 || echo "Slack notification failed (non-fatal)"
  else
    echo "SLACK_WEBHOOK_URL not set — Slack notification skipped"
  fi
}

if [ "$HTTP_CODE" != "200" ]; then
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "FAIL — Could not retrieve backup info (HTTP ${HTTP_CODE})"
  send_slack_alert "Warning: EmpathAI backup check FAILED — ${TIMESTAMP} — Could not retrieve backup info"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed"
  exit 1
fi

LATEST_BACKUP=$(echo "$BODY" | jq -r '
  if type == "array" then
    sort_by(.inserted_at) | last | .inserted_at
  elif .backups then
    .backups | sort_by(.inserted_at) | last | .inserted_at
  else
    empty
  end
' 2>/dev/null || echo "")

if [ -z "$LATEST_BACKUP" ] || [ "$LATEST_BACKUP" = "null" ]; then
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "FAIL — No backups found"
  send_slack_alert "Warning: EmpathAI backup check FAILED — ${TIMESTAMP} — No backups found"
  exit 1
fi

BACKUP_EPOCH=$(date -d "$LATEST_BACKUP" +%s 2>/dev/null || date -jf "%Y-%m-%dT%H:%M:%S" "${LATEST_BACKUP%%.*}" +%s 2>/dev/null || echo "0")
NOW_EPOCH=$(date +%s)
AGE_HOURS=$(( (NOW_EPOCH - BACKUP_EPOCH) / 3600 ))

echo "Latest backup: ${LATEST_BACKUP}"
echo "Backup age: ${AGE_HOURS} hours"

if [ "$AGE_HOURS" -lt "$MAX_AGE_HOURS" ]; then
  echo "PASS — Backup is ${AGE_HOURS}h old (threshold: ${MAX_AGE_HOURS}h)"
  exit 0
else
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "FAIL — Backup is ${AGE_HOURS}h old (threshold: ${MAX_AGE_HOURS}h)"
  send_slack_alert "Warning: EmpathAI backup check FAILED — ${TIMESTAMP} — Backup is ${AGE_HOURS}h old (max ${MAX_AGE_HOURS}h)"
  exit 1
fi
