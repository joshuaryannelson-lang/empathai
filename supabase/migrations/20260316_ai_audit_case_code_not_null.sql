-- GAP-48: Make ai_audit_logs.case_code NOT NULL
-- A log entry with no case_code is untraceable.
-- Backfill existing null rows with triggered_by (user id) as fallback identifier.

-- Step 1: Backfill existing null rows
UPDATE ai_audit_logs
SET case_code = COALESCE(triggered_by, 'unknown')
WHERE case_code IS NULL;

-- Step 2: Add NOT NULL constraint with default for safety
ALTER TABLE ai_audit_logs
  ALTER COLUMN case_code SET NOT NULL,
  ALTER COLUMN case_code SET DEFAULT 'unknown';
