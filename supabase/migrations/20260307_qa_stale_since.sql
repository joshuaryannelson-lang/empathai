-- Add stale_since timestamp to qa_checks for deploy-triggered staleness tracking
ALTER TABLE qa_checks ADD COLUMN IF NOT EXISTS stale_since timestamptz;
