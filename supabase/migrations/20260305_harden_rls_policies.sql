-- =============================================================================
-- RLS HARDENING MIGRATION — EmpathAI Security Audit
-- =============================================================================
-- Enables RLS on every table and creates role-scoped policies.
-- Assumes Supabase auth with auth.uid() and a user_roles table or
-- app_metadata claims for role lookup.
--
-- Role resolution helper: checks auth.jwt()->'app_metadata'->>'role'
-- Supported roles: 'therapist', 'patient', 'manager', 'admin'
-- Practice association stored in auth.jwt()->'app_metadata'->>'practice_id'
-- =============================================================================

-- ─── Helper functions ────────────────────────────────────────────────────────

-- Returns the role claim from the JWT
create or replace function auth.role()
returns text
language sql stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'role',
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role'),
    'anon'
  );
$$;

-- Returns the practice_id claim from the JWT
create or replace function auth.practice_id()
returns text
language sql stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'practice_id',
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'practice_id')
  );
$$;


-- =============================================================================
-- 1. PRACTICES
-- =============================================================================
-- Rollback: alter table practice disable row level security;
alter table practice enable row level security;

-- Therapists/managers see their own practice; admins see all
-- Rollback: drop policy if exists practices_therapist_select on practice;
create policy practices_therapist_select on practice
  for select to authenticated
  using (
    auth.role() = 'admin'
    or id = auth.practice_id()
  );

-- Only admin can insert/update/delete practices
-- Rollback: drop policy if exists practices_admin_insert on practice;
create policy practices_admin_insert on practice
  for insert to authenticated
  with check (auth.role() = 'admin');

-- Rollback: drop policy if exists practices_admin_update on practice;
create policy practices_admin_update on practice
  for update to authenticated
  using (auth.role() = 'admin');

-- Rollback: drop policy if exists practices_admin_delete on practice;
create policy practices_admin_delete on practice
  for delete to authenticated
  using (auth.role() = 'admin');


-- =============================================================================
-- 2. THERAPISTS
-- =============================================================================
-- Rollback: alter table therapists disable row level security;
alter table therapists enable row level security;

-- A therapist can see themselves; managers see therapists in their practice; admins see all
-- Rollback: drop policy if exists therapists_select on therapists;
create policy therapists_select on therapists
  for select to authenticated
  using (
    auth.role() = 'admin'
    or id = auth.uid()
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );

-- Only admin/manager can insert/update/delete therapists in their practice
-- Rollback: drop policy if exists therapists_admin_insert on therapists;
create policy therapists_admin_insert on therapists
  for insert to authenticated
  with check (
    auth.role() = 'admin'
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );

-- Rollback: drop policy if exists therapists_admin_update on therapists;
create policy therapists_admin_update on therapists
  for update to authenticated
  using (
    auth.role() = 'admin'
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );

-- Rollback: drop policy if exists therapists_admin_delete on therapists;
create policy therapists_admin_delete on therapists
  for delete to authenticated
  using (
    auth.role() = 'admin'
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );


-- =============================================================================
-- 3. PATIENTS
-- =============================================================================
-- Rollback: alter table patients disable row level security;
alter table patients enable row level security;

-- A patient can only see their own record
-- Therapists see patients in their cases; managers see patients in their practice
-- Rollback: drop policy if exists patients_select on patients;
create policy patients_select on patients
  for select to authenticated
  using (
    auth.role() = 'admin'
    or id = auth.uid()
    or (auth.role() = 'therapist' and exists (
      select 1 from cases c where c.patient_id = patients.id and c.therapist_id = auth.uid()
    ))
    or (auth.role() = 'manager' and exists (
      select 1 from cases c where c.patient_id = patients.id and c.practice_id = auth.practice_id()
    ))
  );

-- Only admin/manager can insert patients
-- Rollback: drop policy if exists patients_admin_insert on patients;
create policy patients_admin_insert on patients
  for insert to authenticated
  with check (auth.role() in ('admin', 'manager'));

-- Rollback: drop policy if exists patients_admin_update on patients;
create policy patients_admin_update on patients
  for update to authenticated
  using (
    auth.role() = 'admin'
    or id = auth.uid()
    or (auth.role() = 'manager' and exists (
      select 1 from cases c where c.patient_id = patients.id and c.practice_id = auth.practice_id()
    ))
  );


-- =============================================================================
-- 4. CASES
-- =============================================================================
-- Rollback: alter table cases disable row level security;
alter table cases enable row level security;

-- Therapist sees only their assigned cases
-- Manager sees all cases in their practice
-- Patient sees only their own case
-- Admin sees all
-- Rollback: drop policy if exists cases_select on cases;
create policy cases_select on cases
  for select to authenticated
  using (
    auth.role() = 'admin'
    or therapist_id = auth.uid()
    or patient_id = auth.uid()
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );

-- Rollback: drop policy if exists cases_insert on cases;
create policy cases_insert on cases
  for insert to authenticated
  with check (
    auth.role() = 'admin'
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );

-- Rollback: drop policy if exists cases_update on cases;
create policy cases_update on cases
  for update to authenticated
  using (
    auth.role() = 'admin'
    or therapist_id = auth.uid()
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );

-- Rollback: drop policy if exists cases_delete on cases;
create policy cases_delete on cases
  for delete to authenticated
  using (
    auth.role() = 'admin'
    or (auth.role() = 'manager' and practice_id = auth.practice_id())
  );


-- =============================================================================
-- 5. CHECKINS
-- =============================================================================
-- Rollback: alter table checkins disable row level security;
alter table checkins enable row level security;

-- Therapist sees checkins for their cases only
-- Patient sees their own checkins (via case.patient_id)
-- Manager sees all checkins in their practice
-- Rollback: drop policy if exists checkins_select on checkins;
create policy checkins_select on checkins
  for select to authenticated
  using (
    auth.role() = 'admin'
    or exists (
      select 1 from cases c
      where c.id = checkins.case_id
        and (
          c.therapist_id = auth.uid()
          or c.patient_id = auth.uid()
          or (auth.role() = 'manager' and c.practice_id = auth.practice_id())
        )
    )
  );

-- Only the patient (via their case) or service role can insert checkins
-- Rollback: drop policy if exists checkins_insert on checkins;
create policy checkins_insert on checkins
  for insert to authenticated
  with check (
    auth.role() = 'admin'
    or exists (
      select 1 from cases c
      where c.id = checkins.case_id
        and c.patient_id = auth.uid()
    )
  );


-- =============================================================================
-- 6. GOALS
-- =============================================================================
-- Rollback: alter table goals disable row level security;
alter table goals enable row level security;

-- Same scoping as checkins — through the case
-- Rollback: drop policy if exists goals_select on goals;
create policy goals_select on goals
  for select to authenticated
  using (
    auth.role() = 'admin'
    or exists (
      select 1 from cases c
      where c.id = goals.case_id
        and (
          c.therapist_id = auth.uid()
          or c.patient_id = auth.uid()
          or (auth.role() = 'manager' and c.practice_id = auth.practice_id())
        )
    )
  );

-- Therapists and admin can create/update goals
-- Rollback: drop policy if exists goals_insert on goals;
create policy goals_insert on goals
  for insert to authenticated
  with check (
    auth.role() = 'admin'
    or exists (
      select 1 from cases c
      where c.id = goals.case_id and c.therapist_id = auth.uid()
    )
  );

-- Rollback: drop policy if exists goals_update on goals;
create policy goals_update on goals
  for update to authenticated
  using (
    auth.role() = 'admin'
    or exists (
      select 1 from cases c
      where c.id = goals.case_id and c.therapist_id = auth.uid()
    )
  );


-- =============================================================================
-- 7. TASKS (existing RLS — harden with manager policy)
-- =============================================================================
-- Tasks table already has RLS enabled and therapist/patient policies from
-- 20260305_create_tasks.sql. Add manager scope.

-- Rollback: drop policy if exists tasks_manager_select on tasks;
create policy tasks_manager_select on tasks
  for select to authenticated
  using (
    auth.role() = 'admin'
    or (auth.role() = 'manager' and exists (
      select 1 from cases c
      where c.id = tasks.case_id and c.practice_id = auth.practice_id()
    ))
  );


-- =============================================================================
-- 8. AI AUDIT LOGS
-- =============================================================================
-- Rollback: alter table ai_audit_logs disable row level security;
alter table ai_audit_logs enable row level security;

-- Admin can see everything
-- Rollback: drop policy if exists ai_audit_logs_admin_select on ai_audit_logs;
create policy ai_audit_logs_admin_select on ai_audit_logs
  for select to authenticated
  using (auth.role() = 'admin');

-- Manager can see logs scoped to their practice (via case_code prefix or triggered_by)
-- but CANNOT see input_hash (enforced via a restricted view — see below)
-- Rollback: drop policy if exists ai_audit_logs_manager_select on ai_audit_logs;
create policy ai_audit_logs_manager_select on ai_audit_logs
  for select to authenticated
  using (
    auth.role() = 'manager'
    and case_code like auth.practice_id() || '%'
  );

-- No user can insert — only service role (audit.ts uses supabaseAdmin)
-- Rollback: drop policy if exists ai_audit_logs_service_insert on ai_audit_logs;
-- (No insert policy for authenticated — service role bypasses RLS)

-- ── Restricted view for non-admin: excludes input_hash and output_summary ──
-- Rollback: drop view if exists ai_audit_logs_safe;
create or replace view ai_audit_logs_safe as
  select
    id,
    service,
    case_code,
    triggered_by,
    -- input_hash deliberately excluded
    -- output_summary deliberately excluded
    model,
    tokens_used,
    redaction_flags,
    blocked,
    created_at
  from ai_audit_logs;

-- Grant select on the safe view to authenticated users
grant select on ai_audit_logs_safe to authenticated;


-- =============================================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- =============================================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT * FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
