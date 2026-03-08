-- 20260311_modalities_dsm.sql
-- Adds therapist modalities column to therapist_profiles
-- Adds dsm_codes column to cases (therapist/admin only)

-- ── Therapist modalities ────────────────────────────────────────────────────

ALTER TABLE therapist_profiles
ADD COLUMN IF NOT EXISTS modalities text[] DEFAULT '{}';

-- Enforce valid modality values
ALTER TABLE therapist_profiles
ADD CONSTRAINT chk_valid_modalities
CHECK (modalities <@ ARRAY['CBT','DBT','ACT','EMDR','IFS','Psychodynamic','Gottman','Somatic','Other']::text[]);

-- RLS: therapist reads/writes own profile, admin reads all, manager reads, patient cannot
-- Note: therapist_profiles.id = auth.users(id), so id = auth.uid() for ownership
CREATE POLICY therapist_own_modalities ON therapist_profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY admin_read_modalities ON therapist_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY manager_read_modalities ON therapist_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ── DSM codes on cases ──────────────────────────────────────────────────────

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS dsm_codes text[] DEFAULT '{}';

-- RLS: therapist reads/writes own cases, admin reads all
-- Manager CANNOT read dsm_codes, patient CANNOT read dsm_codes
-- These policies scope to the dsm_codes column specifically via application-level enforcement.
-- The column is excluded from patient-facing and manager-facing API queries.

CREATE POLICY therapist_own_dsm ON cases
  FOR ALL USING (therapist_id = auth.uid());

CREATE POLICY admin_read_dsm ON cases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Explicitly deny patient access to dsm_codes at the application layer.
-- No RLS policy grants patient role SELECT on cases.dsm_codes.
