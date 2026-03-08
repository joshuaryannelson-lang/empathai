-- =============================================================================
-- GAP-20: Create audit_log table (referenced in app/api/cases/[id]/route.ts
-- but never created)
-- =============================================================================
-- PHI GUARDRAIL: This table must NEVER store patient_name, DOB, email,
-- or phone. Only IDs, roles, events, and timestamps.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event      text NOT NULL,
  user_id    uuid REFERENCES auth.users(id),
  role       text,
  route      text,
  case_id    uuid REFERENCES cases(id),
  ip         inet,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_event ON audit_log(event);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin: SELECT all
CREATE POLICY audit_log_admin_select ON audit_log
  FOR SELECT TO authenticated
  USING (auth.role() = 'admin');

-- All other roles: INSERT only (write own events, cannot read)
CREATE POLICY audit_log_authenticated_insert ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE for anyone (append-only)
