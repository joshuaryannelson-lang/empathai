// lib/services/audit.ts
// Persistent audit log for every AI call. Never silently swallow errors.

import { supabaseAdmin } from "@/lib/supabase";
import { createHash } from "crypto";

export interface AuditEntry {
  service: string;           // 'briefing' | 'session-prep' | 'ths'
  case_code?: string | null; // never patient name, only case/practice id
  triggered_by: string;      // user/role identifier
  input_hash: string;        // sha256 of prompt
  output_summary?: string;   // first 100 chars only
  model?: string;
  tokens_used?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  estimated_cost_usd?: number;
  redaction_flags?: string[];
  blocked?: boolean;
  error?: boolean;
}

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

export async function logAiCall(entry: AuditEntry): Promise<void> {
  try {
    const row = {
      service: entry.service,
      case_code: entry.case_code ?? null,
      triggered_by: entry.triggered_by,
      input_hash: entry.input_hash,
      output_summary: entry.output_summary
        ? entry.output_summary.slice(0, 100)
        : null,
      model: entry.model ?? null,
      tokens_used: entry.tokens_used ?? null,
      prompt_tokens: entry.prompt_tokens ?? null,
      completion_tokens: entry.completion_tokens ?? null,
      estimated_cost_usd: entry.estimated_cost_usd ?? null,
      redaction_flags: entry.redaction_flags ?? [],
      blocked: entry.blocked ?? false,
      error: entry.error ?? false,
    };

    const { error } = await supabaseAdmin
      .from("ai_audit_logs")
      .insert(row);

    if (error) {
      // Log the failure — never silently swallow
      console.error("[audit] Failed to write ai_audit_logs:", error.message, row);
    }
  } catch (err) {
    // Catch-all so audit failures never break the request
    console.error("[audit] Exception writing ai_audit_logs:", err);
  }
}
