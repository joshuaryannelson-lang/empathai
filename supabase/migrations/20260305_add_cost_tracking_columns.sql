-- Add token tracking and cost estimation columns to ai_audit_logs
-- Rollback: alter table ai_audit_logs drop column if exists prompt_tokens, drop column if exists completion_tokens, drop column if exists estimated_cost_usd;

alter table ai_audit_logs add column if not exists prompt_tokens integer;
alter table ai_audit_logs add column if not exists completion_tokens integer;
alter table ai_audit_logs add column if not exists estimated_cost_usd numeric(10, 6);

-- Update the safe view to include cost data (non-sensitive)
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
    prompt_tokens,
    completion_tokens,
    estimated_cost_usd,
    redaction_flags,
    blocked,
    created_at
  from ai_audit_logs;

grant select on ai_audit_logs_safe to authenticated;
