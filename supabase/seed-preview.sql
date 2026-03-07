-- Preview environment seed data
-- SYNTHETIC ONLY — no real patient information

-- Practices (table is "practice", singular)
INSERT INTO practice (id, name) VALUES
  ('prev-practice-1', 'Sunrise Therapy Center'),
  ('prev-practice-2', 'Lakewood Counseling Group')
ON CONFLICT (id) DO NOTHING;

-- Therapists (first names only — no last names)
INSERT INTO therapists (id, name, practice_id) VALUES
  ('prev-therapist-1', 'Jordan', 'prev-practice-1'),
  ('prev-therapist-2', 'Riley', 'prev-practice-1'),
  ('prev-therapist-3', 'Morgan', 'prev-practice-2')
ON CONFLICT (id) DO NOTHING;

-- Cases (case codes only — no patient identifiers)
INSERT INTO cases (id, case_code, therapist_id, practice_id, status, title) VALUES
  ('prev-case-1', 'PRV-001', 'prev-therapist-1', 'prev-practice-1', 'active', 'Preview Case 1'),
  ('prev-case-2', 'PRV-002', 'prev-therapist-1', 'prev-practice-1', 'active', 'Preview Case 2'),
  ('prev-case-3', 'PRV-003', 'prev-therapist-2', 'prev-practice-1', 'active', 'Preview Case 3'),
  ('prev-case-4', 'PRV-004', 'prev-therapist-3', 'prev-practice-2', 'active', 'Preview Case 4')
ON CONFLICT (id) DO NOTHING;

-- Check-ins (synthetic scores and safe notes, no PHI)
-- Uses week_start (Monday-aligned YYYY-MM-DD) matching the app's weekly bucket pattern
INSERT INTO checkins (id, case_id, score, note, week_start, created_at) VALUES
  ('prev-checkin-1', 'prev-case-1', 7, 'Feeling steady this week', '2026-03-02', NOW() - INTERVAL '7 days'),
  ('prev-checkin-2', 'prev-case-1', 5, 'A bit more tired than usual', '2026-03-02', NOW() - INTERVAL '3 days'),
  ('prev-checkin-3', 'prev-case-2', 8, 'Good progress on coping strategies', '2026-03-02', NOW() - INTERVAL '5 days'),
  ('prev-checkin-4', 'prev-case-3', 3, 'Struggling with motivation', '2026-03-02', NOW() - INTERVAL '2 days'),
  ('prev-checkin-5', 'prev-case-4', 6, 'Moderate week overall', '2026-03-02', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
