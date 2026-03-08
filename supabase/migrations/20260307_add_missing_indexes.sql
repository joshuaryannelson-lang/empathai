-- GAP-25: Add missing query indexes for performance
-- Apply: supabase db push (or supabase migration up)
-- Note: Indexes do NOT bypass RLS policies

-- =============================================================================
-- CHECKINS INDEXES
-- =============================================================================

-- Supports /api/cases/[id]/session-prep, /api/cases/[id]/checkins, and
-- any check-in lookup filtered by case_id
CREATE INDEX IF NOT EXISTS idx_checkins_case_id
  ON checkins (case_id);

-- Supports weekly dashboard queries that filter checkins by week_start
CREATE INDEX IF NOT EXISTS idx_checkins_week_start
  ON checkins (week_start);

-- Composite index covering queries that filter by both case_id and week_start
-- (e.g., /api/cases/[id]/session-prep fetching latest check-in for a case in a given week)
CREATE INDEX IF NOT EXISTS idx_checkins_case_id_week_start
  ON checkins (case_id, week_start);


-- =============================================================================
-- GOALS INDEXES
-- =============================================================================

-- Supports /api/cases/[id]/session-prep goals lookup and case detail pages
CREATE INDEX IF NOT EXISTS idx_goals_case_id
  ON goals (case_id);


-- =============================================================================
-- CASES INDEXES
-- =============================================================================

-- Supports therapist dashboard /api/therapists/[id]/cases and care dashboard
CREATE INDEX IF NOT EXISTS idx_cases_therapist_id
  ON cases (therapist_id);

-- Supports practice dashboard /api/practices/[id]/at-risk, /api/practices/[id]/therapist-overview
CREATE INDEX IF NOT EXISTS idx_cases_practice_id
  ON cases (practice_id);

-- Supports patient case lookup /api/patients/[id] and patient portal queries
CREATE INDEX IF NOT EXISTS idx_cases_patient_id
  ON cases (patient_id);

-- Composite index for dashboard join queries that filter by both therapist and practice
-- (e.g., practice-scoped therapist views)
CREATE INDEX IF NOT EXISTS idx_cases_therapist_id_practice_id
  ON cases (therapist_id, practice_id);


-- =============================================================================
-- RLS CONFIRMATION
-- =============================================================================
-- These indexes improve query performance only. They do NOT affect Row Level
-- Security policies in any way. RLS policies continue to enforce access control
-- on every query regardless of which indexes exist.
