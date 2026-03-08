-- =============================================================================
-- GAP-06: Remove plaintext PHI (email, phone, DOB) from extended_profile JSONB
-- =============================================================================
-- Email lives in auth.users — no reason to duplicate it.
-- Phone and DOB are not required for clinical workflow in the current system.
-- This migration:
--   1. Strips email/phone/date_of_birth keys from every patients row
--   2. Adds a CHECK constraint to prevent future inserts containing these keys

-- Strip PHI keys from existing rows
UPDATE patients
SET extended_profile = extended_profile - 'email' - 'phone' - 'date_of_birth'
WHERE extended_profile IS NOT NULL
  AND (
    extended_profile ? 'email'
    OR extended_profile ? 'phone'
    OR extended_profile ? 'date_of_birth'
  );

-- CHECK constraint: reject any JSONB that contains email, phone, or dob keys.
-- The ?| operator returns TRUE if ANY of the keys exist; we require FALSE.
ALTER TABLE patients
  ADD CONSTRAINT no_phi_in_extended_profile
  CHECK (
    extended_profile IS NULL
    OR NOT (extended_profile ?| ARRAY['email', 'phone', 'date_of_birth'])
  );


-- =============================================================================
-- GAP-17: Add patient UPDATE policy via case_code (for portal profile writes)
-- =============================================================================
-- Allows a patient JWT (with case_code claim) to update their own patient row,
-- scoped through the cases table join.

-- Drop existing update policy to recreate with case_code support
DROP POLICY IF EXISTS patients_admin_update ON patients;

CREATE POLICY patients_update_v2 ON patients
  FOR UPDATE TO authenticated
  USING (
    auth.role() = 'admin'
    OR id = auth.uid()
    OR (auth.role() = 'manager' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.patient_id = patients.id AND c.practice_id = auth.practice_id()
    ))
    OR (auth.role() = 'patient' AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.patient_id = patients.id
        AND c.case_code = auth.case_code()
    ))
  );

-- Also add patient SELECT via case_code (needed for the profile read)
DROP POLICY IF EXISTS patients_select ON patients;

CREATE POLICY patients_select_v2 ON patients
  FOR SELECT TO authenticated
  USING (
    auth.role() = 'admin'
    OR id = auth.uid()
    OR (auth.role() = 'therapist' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.patient_id = patients.id AND c.therapist_id = auth.uid()
    ))
    OR (auth.role() = 'manager' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.patient_id = patients.id AND c.practice_id = auth.practice_id()
    ))
    OR (auth.role() = 'patient' AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.patient_id = patients.id
        AND c.case_code = auth.case_code()
    ))
  );
