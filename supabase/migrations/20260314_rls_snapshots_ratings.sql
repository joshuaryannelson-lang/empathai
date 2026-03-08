-- =============================================================================
-- GAP-04: Add RLS policies to case_ai_snapshots and therapist_ratings
-- Both tables have RLS enabled but zero policies (service-role-only access).
-- =============================================================================

-- ─── case_ai_snapshots ──────────────────────────────────────────────────────

-- Therapist: SELECT/INSERT for cases they own
CREATE POLICY snapshots_therapist_select ON case_ai_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_ai_snapshots.case_id
        AND c.therapist_id = auth.uid()
    )
  );

CREATE POLICY snapshots_therapist_insert ON case_ai_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_ai_snapshots.case_id
        AND c.therapist_id = auth.uid()
    )
  );

-- Admin: full access
CREATE POLICY snapshots_admin ON case_ai_snapshots
  FOR ALL TO authenticated
  USING (auth.role() = 'admin')
  WITH CHECK (auth.role() = 'admin');

-- Patient: NO access (AI snapshots are clinical, not patient-facing)
-- No policy = no access for patient role


-- ─── therapist_ratings ──────────────────────────────────────────────────────

-- Therapist: SELECT own ratings only
CREATE POLICY ratings_therapist_select ON therapist_ratings
  FOR SELECT TO authenticated
  USING (therapist_id = auth.uid());

-- Manager: SELECT ratings for therapists in their practice
CREATE POLICY ratings_manager_select ON therapist_ratings
  FOR SELECT TO authenticated
  USING (
    auth.role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = therapist_ratings.case_id
        AND c.practice_id = auth.practice_id()
    )
  );

-- Admin: full access
CREATE POLICY ratings_admin ON therapist_ratings
  FOR ALL TO authenticated
  USING (auth.role() = 'admin')
  WITH CHECK (auth.role() = 'admin');

-- No INSERT/UPDATE from client — ratings written server-side only (service role)
