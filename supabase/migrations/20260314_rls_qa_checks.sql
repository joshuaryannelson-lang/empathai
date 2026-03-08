-- =============================================================================
-- GAP-07: Lock down qa_checks — currently fully open (using (true))
-- This table contains internal QA state and should not be visible to end users.
-- =============================================================================

-- Drop existing fully-open policies
DROP POLICY IF EXISTS qa_checks_select ON qa_checks;
DROP POLICY IF EXISTS qa_checks_insert ON qa_checks;
DROP POLICY IF EXISTS qa_checks_update ON qa_checks;
DROP POLICY IF EXISTS qa_checks_delete ON qa_checks;

-- Admin: full access
CREATE POLICY qa_checks_admin ON qa_checks
  FOR ALL TO authenticated
  USING (auth.role() = 'admin')
  WITH CHECK (auth.role() = 'admin');

-- All other roles: no access (no policy = denied)
-- Anon: no access (RLS enabled, no anon policy)
