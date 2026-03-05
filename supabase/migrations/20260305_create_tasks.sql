-- Task generation table for AI-generated and manual therapist/patient tasks
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  assigned_to_role text not null
    check (assigned_to_role in ('therapist', 'patient')),
  assigned_to_id uuid,
  created_by text not null
    check (created_by in ('ai', 'therapist', 'system')),
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'dismissed')),
  due_date date,
  source_checkin_id uuid,
  redaction_flags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fetching tasks by case
create index if not exists idx_tasks_case_id
  on tasks (case_id, created_at desc);

-- Index for fetching tasks assigned to a specific user
create index if not exists idx_tasks_assigned_to
  on tasks (assigned_to_id, status)
  where assigned_to_id is not null;

-- Index for fetching tasks by status
create index if not exists idx_tasks_status
  on tasks (status, due_date);

-- RLS policies
alter table tasks enable row level security;

-- Therapists can read/write tasks for their own cases only
create policy tasks_therapist_select on tasks
  for select to authenticated
  using (
    exists (
      select 1 from cases c
      where c.id = tasks.case_id
        and c.therapist_id = auth.uid()
    )
  );

create policy tasks_therapist_insert on tasks
  for insert to authenticated
  with check (
    exists (
      select 1 from cases c
      where c.id = tasks.case_id
        and c.therapist_id = auth.uid()
    )
  );

create policy tasks_therapist_update on tasks
  for update to authenticated
  using (
    exists (
      select 1 from cases c
      where c.id = tasks.case_id
        and c.therapist_id = auth.uid()
    )
  );

-- Patients can read tasks assigned to them
create policy tasks_patient_select on tasks
  for select to authenticated
  using (
    assigned_to_role = 'patient'
    and assigned_to_id = auth.uid()
  );

-- Patients can update status only on their own tasks
create policy tasks_patient_update on tasks
  for update to authenticated
  using (
    assigned_to_role = 'patient'
    and assigned_to_id = auth.uid()
  )
  with check (
    assigned_to_role = 'patient'
    and assigned_to_id = auth.uid()
  );
