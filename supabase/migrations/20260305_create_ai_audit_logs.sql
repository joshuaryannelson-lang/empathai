-- Create AI audit log table for tracking all AI service calls
create table if not exists ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  service text not null,              -- 'briefing' | 'session-prep' | 'ths'
  case_code text,                     -- never patient name, only case/practice id
  triggered_by text not null,         -- user/role identifier
  input_hash text not null,           -- sha256 of prompt, not the prompt itself
  output_summary text,                -- first 100 chars only
  model text,
  tokens_used integer,
  redaction_flags text[] default '{}',
  blocked boolean default false,
  created_at timestamptz default now()
);

-- Index for querying by service and time
create index if not exists idx_ai_audit_logs_service_created
  on ai_audit_logs (service, created_at desc);

-- Index for querying by case
create index if not exists idx_ai_audit_logs_case_code
  on ai_audit_logs (case_code)
  where case_code is not null;
