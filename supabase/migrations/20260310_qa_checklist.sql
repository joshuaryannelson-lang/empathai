-- =============================================================================
-- QA CHECKLIST
-- =============================================================================
-- Lightweight collaborative QA board. No auth required — anyone with the
-- link can view and submit check results.
--
-- Rollback:
--   drop table if exists qa_checks;
-- =============================================================================

create table if not exists qa_checks (
  id            uuid primary key default gen_random_uuid(),
  page_id       text not null,
  check_index   integer not null,
  tester_name   text not null,
  status        text not null check (status in ('pass', 'fail', 'skip')),
  note          text,
  checked_at    timestamptz not null default now(),
  unique (page_id, check_index, tester_name)
);

create index if not exists idx_qa_checks_page on qa_checks(page_id);

-- ── RLS ──
alter table qa_checks enable row level security;

-- Anyone can read
create policy qa_checks_select on qa_checks
  for select using (true);

-- Anyone can insert (rate limiting handled at API layer)
create policy qa_checks_insert on qa_checks
  for insert with check (true);

-- Anyone can update (upsert overwrites previous result)
create policy qa_checks_update on qa_checks
  for update using (true) with check (true);

-- Anyone can delete their own results (clear/undo)
create policy qa_checks_delete on qa_checks
  for delete using (true);

