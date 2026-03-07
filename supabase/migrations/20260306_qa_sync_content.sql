-- =============================================================================
-- QA CONTENT SYNC
-- =============================================================================
-- Syncs qa_checks rows with updated page.tsx definitions:
--   - system-status: URL changed from /admin/dev to /status, checks updated
--   - admin-dev: check text updated for 5-tab layout
-- Marks affected rows as stale so testers re-verify.
-- =============================================================================

-- Update page_path for system-status (was /admin/dev, now /status)
UPDATE public.qa_checks
SET page_path = '/status'
WHERE page_id = 'system-status';

-- Mark all system-status and admin-dev results as stale
-- (check text changed, old pass/fail results may not match new definitions)
UPDATE public.qa_checks
SET stale = true
WHERE page_id IN ('system-status', 'admin-dev');
