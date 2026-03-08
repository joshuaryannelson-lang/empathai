-- =============================================================================
-- GAP-09: Create missing tables referenced by RLS policies
-- therapist_profiles and user_roles are used in 20260311_modalities_dsm.sql
-- but were never created, causing those policies to fail.
-- =============================================================================

-- ─── therapist_profiles ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS therapist_profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id    uuid REFERENCES practice(id),
  preferred_name text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE therapist_profiles ENABLE ROW LEVEL SECURITY;

-- Therapist can read/update own row
CREATE POLICY therapist_profiles_own ON therapist_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Manager can read therapist profiles within their practice
CREATE POLICY therapist_profiles_manager_select ON therapist_profiles
  FOR SELECT TO authenticated
  USING (
    auth.role() = 'manager'
    AND practice_id = auth.practice_id()
  );

-- Admin can read/write all
CREATE POLICY therapist_profiles_admin ON therapist_profiles
  FOR ALL TO authenticated
  USING (auth.role() = 'admin')
  WITH CHECK (auth.role() = 'admin');


-- ─── user_roles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'manager', 'therapist', 'patient')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- User can read own row
CREATE POLICY user_roles_own_select ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin can read/write all
CREATE POLICY user_roles_admin ON user_roles
  FOR ALL TO authenticated
  USING (auth.role() = 'admin')
  WITH CHECK (auth.role() = 'admin');
