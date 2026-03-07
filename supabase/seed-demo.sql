-- Demo seed data for EmpathAI
-- All data is synthetic — no real PHI
-- Safe to re-run (uses upsert / ON CONFLICT + DELETE-before-insert)
--
-- To run against production:
--   SUPABASE_ENV=production SUPABASE_PROJECT_REF=<ref> ./scripts/seed-demo-accounts.sh

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
  ('demo-patient-01', 'Alex'),
  ('demo-patient-02', 'Jordan'),
  ('demo-patient-03', 'Sam')
ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo cases with case_codes
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO cases (id, title, status, therapist_id, patient_id, practice_id, case_code) VALUES
  ('demo-case-01', 'Weekly Support',    'active', 'demo-therapist-01', 'demo-patient-01', 'demo-practice-01', 'EMP-DEMO01'),
  ('demo-case-02', 'Stress Management', 'active', 'demo-therapist-01', 'demo-patient-02', 'demo-practice-01', 'EMP-DEMO02'),
  ('demo-case-03', 'Coping Skills',     'active', 'demo-therapist-01', 'demo-patient-03', 'demo-practice-01', 'EMP-DEMO03')
ON CONFLICT (id) DO UPDATE SET
  patient_id = EXCLUDED.patient_id,
  status     = EXCLUDED.status;

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo check-ins (2-3 per case, recent dates, synthetic mood scores 1-10)
-- ─────────────────────────────────────────────────────────────────────────────
-- Clear old demo check-ins to prevent duplicates on re-run
DELETE FROM checkins WHERE case_id IN ('demo-case-01', 'demo-case-02', 'demo-case-03');

INSERT INTO checkins (case_id, score, created_at) VALUES
  -- Case 01 (Alex): scores 7, 6, 8 — stable
  ('demo-case-01', 7, NOW() - INTERVAL '14 days'),
  ('demo-case-01', 6, NOW() - INTERVAL '7 days'),
  ('demo-case-01', 8, NOW() - INTERVAL '1 day'),
  -- Case 02 (Jordan): scores 4, 3, 5 — at-risk
  ('demo-case-02', 4, NOW() - INTERVAL '12 days'),
  ('demo-case-02', 3, NOW() - INTERVAL '5 days'),
  -- Case 03 (Sam): scores 6, 7 — improving
  ('demo-case-03', 6, NOW() - INTERVAL '10 days'),
  ('demo-case-03', 7, NOW() - INTERVAL '2 days');

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo goals (1-2 per case, synthetic titles)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM goals WHERE case_id IN ('demo-case-01', 'demo-case-02', 'demo-case-03');

INSERT INTO goals (case_id, title, status, target_date, created_at) VALUES
  ('demo-case-01', 'Practice daily mindfulness exercise',       'active',    (NOW() + INTERVAL '30 days')::date, NOW() - INTERVAL '21 days'),
  ('demo-case-01', 'Identify three positive coping strategies', 'completed', (NOW() - INTERVAL '3 days')::date,  NOW() - INTERVAL '28 days'),
  ('demo-case-02', 'Reduce work-related stress triggers',       'active',    (NOW() + INTERVAL '14 days')::date, NOW() - INTERVAL '14 days'),
  ('demo-case-02', 'Establish consistent sleep routine',        'active',    (NOW() + INTERVAL '21 days')::date, NOW() - INTERVAL '10 days'),
  ('demo-case-03', 'Build emotional regulation toolkit',        'active',    (NOW() + INTERVAL '28 days')::date, NOW() - INTERVAL '12 days');

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
