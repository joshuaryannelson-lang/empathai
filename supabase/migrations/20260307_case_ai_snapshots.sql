-- case_ai_snapshots: persist session prep AI output per case
-- Stores the last generated prep so it loads from cache on page load.
-- Only regenerated on explicit "Regenerate" click.

CREATE TABLE IF NOT EXISTS case_ai_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES therapists(id) ON DELETE SET NULL,
  content     jsonb NOT NULL,              -- the 4-card SessionPrepOutput
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed    boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES therapists(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One snapshot per case (upsert pattern: latest wins)
CREATE UNIQUE INDEX IF NOT EXISTS case_ai_snapshots_case_id_idx
  ON case_ai_snapshots(case_id);

-- RLS: service role only (no anon/patient access)
ALTER TABLE case_ai_snapshots ENABLE ROW LEVEL SECURITY;
