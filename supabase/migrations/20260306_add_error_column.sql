-- Add error tracking column to ai_audit_logs
alter table ai_audit_logs add column if not exists error boolean default false;

-- Index for efficient error counting in /api/status
create index if not exists idx_ai_audit_logs_error
  on ai_audit_logs (service, error, created_at desc)
  where error = true;

-- Update the safe view to include error column
create or replace view ai_audit_logs_safe as
  select
    id,
    service,
    case_code,
    triggered_by,
    model,
    tokens_used,
    prompt_tokens,
    completion_tokens,
    estimated_cost_usd,
    redaction_flags,
    blocked,
    error,
    created_at
  from ai_audit_logs;

grant select on ai_audit_logs_safe to authenticated;
