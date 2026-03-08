-- =============================================================================
-- GAP-10: Fix conflicting RLS policies on cases table
-- =============================================================================
-- Current state (conflicting policies):
--   1. cases_select_v2   (from 20260306_patient_portal_security.sql)
--   2. cases_insert      (from 20260305_harden_rls_policies.sql)
--   3. cases_update      (from 20260305_harden_rls_policies.sql)
--   4. cases_delete      (from 20260305_harden_rls_policies.sql)
--   5. therapist_own_dsm (from 20260311_modalities_dsm.sql) — FOR ALL, overlaps with all above
--   6. admin_read_dsm    (from 20260311_modalities_dsm.sql) — FOR SELECT, overlaps with select
--
-- therapist_own_dsm uses FOR ALL which grants SELECT/INSERT/UPDATE/DELETE,
-- conflicting with the more restrictive per-command policies.
-- admin_read_dsm duplicates admin access already in cases_select_v2.
--
-- Fix: drop all existing policies, re-create clean non-conflicting set.
-- =============================================================================

-- Also clean up redundant therapist_profiles policies from 20260311
-- (our GAP-09 migration already created clean canonical policies)
DROP POLICY IF EXISTS therapist_own_modalities ON therapist_profiles;
DROP POLICY IF EXISTS admin_read_modalities ON therapist_profiles;
DROP POLICY IF EXISTS manager_read_modalities ON therapist_profiles;

-- Drop all existing cases policies
DROP POLICY IF EXISTS cases_select ON cases;
DROP POLICY IF EXISTS cases_select_v2 ON cases;
DROP POLICY IF EXISTS cases_insert ON cases;
DROP POLICY IF EXISTS cases_update ON cases;
DROP POLICY IF EXISTS cases_delete ON cases;
DROP POLICY IF EXISTS therapist_own_dsm ON cases;
DROP POLICY IF EXISTS admin_read_dsm ON cases;

-- ─── SELECT ─────────────────────────────────────────────────────────────────
-- Therapist: own cases (therapist_id = auth.uid())
-- Patient: own case (patient_id = auth.uid() OR case_code = JWT case_code)
-- Manager: all cases within practice
-- Admin: all cases
CREATE POLICY cases_select ON cases
  FOR SELECT TO authenticated
  USING (
    auth.role() = 'admin'
    OR therapist_id = auth.uid()
    OR patient_id = auth.uid()
    OR case_code = auth.case_code()
    OR (auth.role() = 'manager' AND practice_id = auth.practice_id())
  );

-- ─── INSERT ─────────────────────────────────────────────────────────────────
-- Therapist: can create cases assigned to themselves
-- Manager: within their practice
-- Admin: any
CREATE POLICY cases_insert ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.role() = 'admin'
    OR therapist_id = auth.uid()
    OR (auth.role() = 'manager' AND practice_id = auth.practice_id())
  );

-- ─── UPDATE ─────────────────────────────────────────────────────────────────
-- Therapist: own cases only
-- Manager: within practice
-- Admin: any
CREATE POLICY cases_update ON cases
  FOR UPDATE TO authenticated
  USING (
    auth.role() = 'admin'
    OR therapist_id = auth.uid()
    OR (auth.role() = 'manager' AND practice_id = auth.practice_id())
  );

-- ─── DELETE ─────────────────────────────────────────────────────────────────
-- Therapist: own cases
-- Manager: within practice
-- Admin: any
CREATE POLICY cases_delete ON cases
  FOR DELETE TO authenticated
  USING (
    auth.role() = 'admin'
    OR therapist_id = auth.uid()
    OR (auth.role() = 'manager' AND practice_id = auth.practice_id())
  );
