-- Demo seed data for EmpathAI
-- All data is synthetic — no real PHI
-- Safe to re-run (uses upsert / ON CONFLICT)

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo practices (table is "practice", singular)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO practice (id, name) VALUES
  ('demo-practice-01', 'Sunrise Wellness Center'),
  ('demo-practice-02', 'Harbor Mental Health')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo therapist (linked to practice)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO therapists (id, name, practice_id) VALUES
  ('demo-therapist-01', 'Dr. Demo', 'demo-practice-01')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo patients (first_name only — no last names, DOBs, emails)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO patients (id, first_name) VALUES
  ('demo-patient-01', 'Alex')
ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo cases with case_codes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO cases (id, title, status, therapist_id, patient_id, practice_id, case_code) VALUES
  ('demo-case-01', 'Weekly Support',    'active', 'demo-therapist-01', 'demo-patient-01', 'demo-practice-01', 'EMP-DEMO01'),
  ('demo-case-02', 'Stress Management', 'active', 'demo-therapist-01', null,              'demo-practice-01', 'EMP-DEMO02'),
  ('demo-case-03', 'Coping Skills',     'active', 'demo-therapist-01', null,              'demo-practice-01', 'EMP-DEMO03')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo join code for patient testing
-- Never expires (2099), not redeemed
-- ─────────────────────────────────────────────────────────────────────────────
-- Note: created_by is uuid NOT NULL (references auth user, not therapists table).
-- Use a deterministic demo UUID that won't collide with real users.
-- Delete any existing TEST-0000 first (code has UNIQUE constraint, ON CONFLICT (id) won't catch code collisions)
DELETE FROM join_codes WHERE code = 'TEST-0000';
INSERT INTO join_codes (id, code, case_code, created_by, expires_at, redeemed_at) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'TEST-0000', 'EMP-DEMO01',
   '00000000-0000-0000-0000-de0000000001'::uuid, '2099-12-31T23:59:59Z', null)
ON CONFLICT (id) DO UPDATE SET
  code        = EXCLUDED.code,
  case_code   = EXCLUDED.case_code,
  redeemed_at = null,
  expires_at  = '2099-12-31T23:59:59Z';
