-- =============================================================================
-- QA STALENESS TRACKING
-- =============================================================================
-- Adds columns to track when checks were last verified and whether they are
-- stale (i.e. the underlying page has changed since the check was performed).
--
-- Rollback:
--   ALTER TABLE qa_checks DROP COLUMN IF EXISTS page_path;
--   ALTER TABLE qa_checks DROP COLUMN IF EXISTS last_verified_at;
--   ALTER TABLE qa_checks DROP COLUMN IF EXISTS last_verified_by;
--   ALTER TABLE qa_checks DROP COLUMN IF EXISTS stale;
-- =============================================================================

ALTER TABLE public.qa_checks
ADD COLUMN IF NOT EXISTS page_path text,
ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS last_verified_by text,
ADD COLUMN IF NOT EXISTS stale boolean DEFAULT false;
