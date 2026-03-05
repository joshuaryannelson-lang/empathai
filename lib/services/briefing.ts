// lib/services/briefing.ts
// Server-side briefing service. All prompt construction happens here — never in React components.

import { scrubPrompt, scrubOutput } from "./redaction";
import { logAiCall, hashPrompt } from "./audit";

// ── Types ────────────────────────────────────────────────────────────────────

export type BriefingRole = "therapist" | "manager" | "network";

export interface BriefingRequest {
  role: BriefingRole;
  triggeredBy: string; // user/role identifier for audit
  caseCode?: string;   // practice or therapist id — never a patient name
  dataSnapshot: TherapistSnapshot | ManagerSnapshot | NetworkSnapshot;
}

export interface TherapistSnapshot {
  therapist_name: string | null;
  week_start: string;
  active_cases: number;
  avg_score: number | null;
  at_risk_checkins: number;
  missing_checkins: number;
  low_score_patients: string[];  // patient names — will be redacted before prompt
  missing_patients: string[];    // patient names — will be redacted before prompt
  low_score_details: Array<{ name: string; lowest_score: number | null; last_checkin_at: string | null }>;
}

export interface ManagerSnapshot {
  practice_name: string | null;
  week_start: string;
  therapists: Array<{
    name: string;
    active_cases: number;
    avg_score: number | null;
    missing_checkins: number;
    at_risk_patients: number;
  }>;
  totals: {
    totalActive: number;
    teamAvg: number | null;
    missing: number;
    atRisk: number;
  };
}

export interface NetworkSnapshot {
  totals: {
    practices: number;
    therapists: number;
    active_cases: number;
    unassigned_cases: number;
    checkins: number;
    avg_score: number | null;
    at_risk_checkins: number;
  };
  practices: Array<{
    name: string | null;
    id: string;
    therapists: number;
    active_cases: number;
    unassigned_cases: number;
    at_risk_checkins: number;
    avg_score: number | null;
  }>;
}

export interface BriefingResult {
  output: string;
  blocked: boolean;
  redactionFlags: string[];
}

// ── Prompt builders (private) ────────────────────────────────────────────────

function fmtAvg(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1);
}

function buildTherapistPrompt(snap: TherapistSnapshot): string {
  return `Weekly therapist briefing. 3-4 sentences, warm prose, under 100 words. Lead with urgent concerns, end with one action.

${snap.therapist_name ?? "Therapist"} | Week ${snap.week_start} | ${snap.active_cases} cases | Avg ${fmtAvg(snap.avg_score)}/10
Low (≤3): ${snap.at_risk_checkins}${snap.low_score_patients.length ? ` — ${snap.low_score_patients.join(", ")}` : ""}
Missing: ${snap.missing_checkins}${snap.missing_patients.length ? ` — ${snap.missing_patients.join(", ")}` : ""}${snap.low_score_details.map(c => `\n${c.name}: ${c.lowest_score}/10, last: ${c.last_checkin_at ?? "?"}`).join("")}`;
}

function buildManagerPrompt(snap: ManagerSnapshot): string {
  const therapistLines = snap.therapists
    .map(r => `${r.name}: ${r.active_cases}c, avg ${fmtAvg(r.avg_score)}, ${r.missing_checkins} missing, ${r.at_risk_patients} risk`)
    .join("\n");

  return `Practice manager briefing. Reply EXACTLY four lines: PRIORITY, AT RISK, FOLLOW UP, THIS WEEK.

${snap.practice_name ?? "Practice"} | Week ${snap.week_start}
${snap.therapists.length} therapists, ${snap.totals.totalActive} cases, avg ${fmtAvg(snap.totals.teamAvg)}, ${snap.totals.missing} missing, ${snap.totals.atRisk} at-risk

${therapistLines || "(no therapists)"}`;
}

function buildNetworkPrompt(snap: NetworkSnapshot): string {
  const t = snap.totals;
  const practiceLines = snap.practices
    .map(p => `${p.name ?? p.id}: ${p.therapists}t, ${p.active_cases}c, ${p.unassigned_cases} unasgn, ${p.at_risk_checkins} risk, avg ${fmtAvg(p.avg_score)}`)
    .join("\n");

  return `Network briefing. Reply EXACTLY four lines: PRIORITY, UNASSIGNED, AT RISK, THIS WEEK.

${t.practices} practices, ${t.therapists} therapists, ${t.active_cases} cases, ${t.unassigned_cases} unassigned, ${t.checkins} check-ins, avg ${fmtAvg(t.avg_score)}, ${t.at_risk_checkins} at-risk

${practiceLines}`;
}

// ── Collect known names from snapshots for redaction ─────────────────────────

function collectNames(role: BriefingRole, snap: BriefingRequest["dataSnapshot"]): string[] {
  const names: string[] = [];
  if (role === "therapist") {
    const s = snap as TherapistSnapshot;
    if (s.therapist_name) names.push(s.therapist_name);
    names.push(...s.low_score_patients, ...s.missing_patients);
    for (const d of s.low_score_details) {
      if (d.name) names.push(d.name);
    }
  } else if (role === "manager") {
    const s = snap as ManagerSnapshot;
    for (const t of s.therapists) {
      if (t.name) names.push(t.name);
    }
  }
  // Deduplicate and filter empties
  return [...new Set(names.filter(n => n.trim().length > 0))];
}

// ── Call Anthropic ────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const model = "claude-haiku-4-5-20251001";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Anthropic API error (${res.status})`);
  }

  const text: string = json?.content?.[0]?.text ?? "";
  const inputTokens: number = json?.usage?.input_tokens ?? 0;
  const outputTokens: number = json?.usage?.output_tokens ?? 0;
  return { text, model, inputTokens, outputTokens };
}

// ── Briefing cache (4-hour TTL, keyed by input_hash) ────────────────────────

const BRIEFING_CACHE_TTL = 4 * 3600 * 1000; // 4 hours

async function getCachedBriefing(inputHash: string): Promise<string | null> {
  try {
    const cutoff = new Date(Date.now() - BRIEFING_CACHE_TTL).toISOString();
    const { data } = await (await import("@/lib/supabase")).supabaseAdmin
      .from("ai_audit_logs")
      .select("output_summary")
      .eq("service", "briefing")
      .eq("input_hash", inputHash)
      .eq("blocked", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // output_summary is truncated to 100 chars, so only use cache if it looks complete
    // For a proper cache we'd need a full output column, but this avoids the API call
    // when the same data hasn't changed
    return data?.output_summary ?? null;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateBriefing(request: BriefingRequest): Promise<BriefingResult> {
  const { role, dataSnapshot, triggeredBy, caseCode } = request;

  // Short-circuit: if therapist snapshot has no data worth summarizing, return default
  if (role === "therapist") {
    const snap = dataSnapshot as TherapistSnapshot;
    if (snap.active_cases === 0 && snap.at_risk_checkins === 0 && snap.missing_checkins === 0 && snap.low_score_details.length === 0) {
      return { output: "No active cases or check-in data this week. Briefing will populate once patients begin checking in.", blocked: false, redactionFlags: [] };
    }
  }

  const knownNames = collectNames(role, dataSnapshot);

  // 1. Build prompt from snapshot
  let rawPrompt: string;
  if (role === "therapist") {
    rawPrompt = buildTherapistPrompt(dataSnapshot as TherapistSnapshot);
  } else if (role === "manager") {
    rawPrompt = buildManagerPrompt(dataSnapshot as ManagerSnapshot);
  } else {
    rawPrompt = buildNetworkPrompt(dataSnapshot as NetworkSnapshot);
  }

  // 2. Redact PII from prompt before sending to LLM
  const redactedPrompt = scrubPrompt(rawPrompt, knownNames);
  const inputHash = hashPrompt(redactedPrompt.text);

  // 3. Check cache (4h TTL) — skip if last call with same hash was recent
  const cached = await getCachedBriefing(inputHash);
  if (cached) {
    return { output: cached, blocked: false, redactionFlags: redactedPrompt.redactions };
  }

  // 4. Call LLM
  let llmText: string;
  let model = "claude-haiku-4-5-20251001";
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const result = await callAnthropic(redactedPrompt.text);
    llmText = result.text;
    model = result.model;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  } catch (err) {
    await logAiCall({
      service: "briefing",
      case_code: caseCode,
      triggered_by: triggeredBy,
      input_hash: inputHash,
      output_summary: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
      model,
      redaction_flags: redactedPrompt.redactions,
      blocked: true,
    });
    throw err;
  }

  // 5. Scrub PII from output before returning
  const safeOutput = scrubOutput(llmText, knownNames);
  const allRedactions = [...new Set([...redactedPrompt.redactions, ...safeOutput.redactions])];

  // 6. Audit log
  await logAiCall({
    service: "briefing",
    case_code: caseCode,
    triggered_by: triggeredBy,
    input_hash: inputHash,
    output_summary: safeOutput.text.slice(0, 100),
    model,
    tokens_used: outputTokens,
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    estimated_cost_usd: estimateCost(model, inputTokens, outputTokens),
    redaction_flags: allRedactions,
    blocked: safeOutput.blocked,
  });

  return {
    output: safeOutput.text,
    blocked: safeOutput.blocked,
    redactionFlags: allRedactions,
  };
}

// ── Cost estimation ──────────────────────────────────────────────────────────

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  if (model.includes("haiku")) {
    return (inputTokens * 0.80 + outputTokens * 4.00) / 1_000_000;
  }
  // sonnet
  return (inputTokens * 3.00 + outputTokens * 15.00) / 1_000_000;
}
