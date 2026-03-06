-- =============================================================================
-- MANAGER-PRACTICE ASSIGNMENTS
-- =============================================================================
-- Enables multi-practice manager scoping. A manager can only see practices
-- they are explicitly assigned to by an admin.
--
-- Rollback (run each line):
--   drop policy if exists mpa_admin_delete on manager_practice_assignments;
--   drop policy if exists mpa_admin_update on manager_practice_assignments;
--   drop policy if exists mpa_admin_insert on manager_practice_assignments;
--   drop policy if exists mpa_manager_select on manager_practice_assignments;
--   drop index if exists idx_mpa_practice_id;
--   drop index if exists idx_mpa_manager_id;
--   drop table if exists manager_practice_assignments;
--   drop policy if exists practices_select on practice;
-- =============================================================================

-- ── Table ──

create table if not exists manager_practice_assignments (
  id          uuid primary key default gen_random_uuid(),
  manager_id  uuid not null references auth.users(id) on delete cascade,
  practice_id uuid not null references practice(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null references auth.users(id) on delete set null,
  unique (manager_id, practice_id)
);

-- Index for fast lookup by manager
create index if not exists idx_mpa_manager_id
  on manager_practice_assignments(manager_id);

-- Index for fast lookup by practice
create index if not exists idx_mpa_practice_id
  on manager_practice_assignments(practice_id);

-- ── RLS ──

alter table manager_practice_assignments enable row level security;

-- Manager can SELECT their own assignments; admin can SELECT all
create policy mpa_manager_select on manager_practice_assignments
  for select to authenticated
  using (
    manager_id = auth.uid()
    or auth.role() = 'admin'
  );

-- Only admin can INSERT assignments
create policy mpa_admin_insert on manager_practice_assignments
  for insert to authenticated
  with check (auth.role() = 'admin');

-- Only admin can UPDATE assignments
create policy mpa_admin_update on manager_practice_assignments
  for update to authenticated
  using (auth.role() = 'admin')
  with check (auth.role() = 'admin');

-- Only admin can DELETE assignments
create policy mpa_admin_delete on manager_practice_assignments
  for delete to authenticated
  using (auth.role() = 'admin');

-- ── Update practices SELECT policy ──
-- Replace the existing single-practice_id policy with one that supports
-- multi-practice via the assignments table.
-- The old policy used: id = auth.practice_id()  (single JWT claim)
-- The new policy adds: manager can see practices they are assigned to

drop policy if exists practices_therapist_select on practice;

create policy practices_select on practice
  for select to authenticated
  using (
    auth.role() = 'admin'
    or id = auth.practice_id()  -- therapists: still use JWT claim
    or (auth.role() = 'manager' and exists (
      select 1 from manager_practice_assignments mpa
      where mpa.practice_id = practice.id
        and mpa.manager_id = auth.uid()
    ))
  );
