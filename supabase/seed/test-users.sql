-- =============================================================================
-- RLS Test Users — seeded into Supabase local dev via supabase db reset
-- =============================================================================
-- These users are created in auth.users with app_metadata containing role
-- and practice_id claims used by auth.role() and auth.practice_id() helpers.
--
-- Passwords are test-only. Never use in production.
-- =============================================================================

-- Practice fixtures
INSERT INTO practice (id, name) VALUES
  ('00000000-0000-0000-0001-000000000001', 'RLS Test Practice 1'),
  ('00000000-0000-0000-0001-000000000002', 'RLS Test Practice 2')
ON CONFLICT (id) DO NOTHING;

-- Therapist A (Practice 1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-aaaaaaaaaaaa',
  'therapist-a@rls-test.local',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"role":"therapist","practice_id":"00000000-0000-0000-0001-000000000001"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-aaaaaaaaaaaa',
  '{"sub":"00000000-0000-0000-0000-aaaaaaaaaaaa","email":"therapist-a@rls-test.local"}'::jsonb,
  'email', '00000000-0000-0000-0000-aaaaaaaaaaaa',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Therapist B (Practice 1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-bbbbbbbbbbbb',
  'therapist-b@rls-test.local',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"role":"therapist","practice_id":"00000000-0000-0000-0001-000000000001"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-bbbbbbbbbbbb',
  '{"sub":"00000000-0000-0000-0000-bbbbbbbbbbbb","email":"therapist-b@rls-test.local"}'::jsonb,
  'email', '00000000-0000-0000-0000-bbbbbbbbbbbb',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Patient A (Practice 1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-cccccccccccc',
  'patient-a@rls-test.local',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"role":"patient","practice_id":"00000000-0000-0000-0001-000000000001"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-cccccccccccc',
  '00000000-0000-0000-0000-cccccccccccc',
  '{"sub":"00000000-0000-0000-0000-cccccccccccc","email":"patient-a@rls-test.local"}'::jsonb,
  'email', '00000000-0000-0000-0000-cccccccccccc',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Manager P1 (Practice 1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-eeeeeeeeeeee',
  'manager-p1@rls-test.local',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"role":"manager","practice_id":"00000000-0000-0000-0001-000000000001"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-eeeeeeeeeeee',
  '00000000-0000-0000-0000-eeeeeeeeeeee',
  '{"sub":"00000000-0000-0000-0000-eeeeeeeeeeee","email":"manager-p1@rls-test.local"}'::jsonb,
  'email', '00000000-0000-0000-0000-eeeeeeeeeeee',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Manager P2 (Practice 2)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-ffffffffffff',
  'manager-p2@rls-test.local',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"role":"manager","practice_id":"00000000-0000-0000-0001-000000000002"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-ffffffffffff',
  '00000000-0000-0000-0000-ffffffffffff',
  '{"sub":"00000000-0000-0000-0000-ffffffffffff","email":"manager-p2@rls-test.local"}'::jsonb,
  'email', '00000000-0000-0000-0000-ffffffffffff',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Admin (Practice 1)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-111111111111',
  'admin@rls-test.local',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"role":"admin","practice_id":"00000000-0000-0000-0001-000000000001"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-111111111111',
  '00000000-0000-0000-0000-111111111111',
  '{"sub":"00000000-0000-0000-0000-111111111111","email":"admin@rls-test.local"}'::jsonb,
  'email', '00000000-0000-0000-0000-111111111111',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- ─── Therapist profile rows ────────────────────────────────────────────────
INSERT INTO therapists (id, name, practice_id) VALUES
  ('00000000-0000-0000-0000-aaaaaaaaaaaa', 'Therapist A', '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0000-bbbbbbbbbbbb', 'Therapist B', '00000000-0000-0000-0001-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ─── Patient rows ──────────────────────────────────────────────────────────
INSERT INTO patients (id, name) VALUES
  ('00000000-0000-0000-0000-cccccccccccc', 'Patient A')
ON CONFLICT (id) DO NOTHING;

-- ─── Case fixtures ─────────────────────────────────────────────────────────
INSERT INTO cases (id, therapist_id, patient_id, practice_id, case_code, status) VALUES
  ('00000000-0000-0000-1111-aaaaaaaaaaaa', '00000000-0000-0000-0000-aaaaaaaaaaaa', '00000000-0000-0000-0000-cccccccccccc', '00000000-0000-0000-0001-000000000001', 'EMP-TEST01', 'active'),
  ('00000000-0000-0000-1111-bbbbbbbbbbbb', '00000000-0000-0000-0000-bbbbbbbbbbbb', null, '00000000-0000-0000-0001-000000000001', 'EMP-TEST02', 'active'),
  ('00000000-0000-0000-1111-cccccccccccc', '00000000-0000-0000-0000-bbbbbbbbbbbb', null, '00000000-0000-0000-0001-000000000002', 'EMP-TEST03', 'active')
ON CONFLICT (id) DO NOTHING;

-- ─── user_roles fixtures ───────────────────────────────────────────────────
INSERT INTO user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-aaaaaaaaaaaa', 'therapist'),
  ('00000000-0000-0000-0000-bbbbbbbbbbbb', 'therapist'),
  ('00000000-0000-0000-0000-cccccccccccc', 'patient'),
  ('00000000-0000-0000-0000-eeeeeeeeeeee', 'manager'),
  ('00000000-0000-0000-0000-ffffffffffff', 'manager'),
  ('00000000-0000-0000-0000-111111111111', 'admin')
ON CONFLICT (user_id) DO NOTHING;

-- ─── therapist_profiles fixtures ───────────────────────────────────────────
INSERT INTO therapist_profiles (id, practice_id, preferred_name) VALUES
  ('00000000-0000-0000-0000-aaaaaaaaaaaa', '00000000-0000-0000-0001-000000000001', 'Dr. A'),
  ('00000000-0000-0000-0000-bbbbbbbbbbbb', '00000000-0000-0000-0001-000000000001', 'Dr. B')
ON CONFLICT (id) DO NOTHING;

-- ─── Snapshot fixture (for GAP-04 tests) ───────────────────────────────────
INSERT INTO case_ai_snapshots (id, case_id, therapist_id, content) VALUES
  ('00000000-0000-0000-2222-aaaaaaaaaaaa', '00000000-0000-0000-1111-aaaaaaaaaaaa', '00000000-0000-0000-0000-aaaaaaaaaaaa', '{"summary":"test"}'::jsonb)
ON CONFLICT (case_id) DO NOTHING;

-- ─── Rating fixture (for GAP-04 tests) ─────────────────────────────────────
INSERT INTO therapist_ratings (id, case_id, therapist_id, week_index, s_rating, o_rating, t_rating) VALUES
  ('00000000-0000-0000-3333-aaaaaaaaaaaa', '00000000-0000-0000-1111-aaaaaaaaaaaa', '00000000-0000-0000-0000-aaaaaaaaaaaa', 1, 7, 8, 6)
ON CONFLICT (case_id, week_index) DO NOTHING;

-- ─── QA check fixture (for GAP-07 tests) ───────────────────────────────────
INSERT INTO qa_checks (id, page_id, check_index, tester_name, status) VALUES
  ('00000000-0000-0000-4444-aaaaaaaaaaaa', 'test-page', 0, 'tester', 'pass')
ON CONFLICT (page_id, check_index, tester_name) DO NOTHING;

-- ─── Audit log fixture (for GAP-20 tests) ──────────────────────────────────
INSERT INTO audit_log (id, event, user_id, role, route, case_id) VALUES
  ('00000000-0000-0000-5555-aaaaaaaaaaaa', 'case_assigned', '00000000-0000-0000-0000-aaaaaaaaaaaa', 'therapist', '/api/cases/xxx', '00000000-0000-0000-1111-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;
