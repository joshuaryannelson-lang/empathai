-- therapist_ratings: persist therapist session ratings server-side
-- Replaces localStorage-only storage.

CREATE TABLE IF NOT EXISTS therapist_ratings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  week_index   integer NOT NULL,
  s_rating     integer NOT NULL CHECK (s_rating >= 0 AND s_rating <= 10),
  o_rating     integer NOT NULL CHECK (o_rating >= 0 AND o_rating <= 10),
  t_rating     integer NOT NULL CHECK (t_rating >= 0 AND t_rating <= 10),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One rating per case per week
CREATE UNIQUE INDEX IF NOT EXISTS therapist_ratings_case_week_idx
  ON therapist_ratings(case_id, week_index);

-- For fetching ratings by therapist (admin/status table)
CREATE INDEX IF NOT EXISTS therapist_ratings_therapist_idx
  ON therapist_ratings(therapist_id);

ALTER TABLE therapist_ratings ENABLE ROW LEVEL SECURITY;
