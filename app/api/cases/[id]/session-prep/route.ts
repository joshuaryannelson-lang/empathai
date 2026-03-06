// app/api/cases/[id]/session-prep/route.ts
// Session preparation: GET returns raw data, POST generates AI-powered structured summary.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoSessionPrep } from "@/lib/demo/demoAI";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  buildSessionPrepPrompt,
  validateSessionPrepOutput,
  estimateTokenCount,
  type SessionPrepOutput,
  type CheckInData,
  type GoalData,
} from "@/lib/ai/sessionPrepPrompt";
import { hashPrompt, logAiCall } from "@/lib/services/audit";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 400;

// Haiku pricing: $1/M input, $5/M output
const INPUT_COST_PER_TOKEN = 1 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 5 / 1_000_000;

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  const caseRes = await supabase.from("cases").select("id, title, status, created_at, patient_id, therapist_id, practice_id").eq("id", caseId).single();
  if (caseRes.error) return bad(caseRes.error.message, 400, caseRes.error);

  const checkinsRes = await supabase
    .from("checkins")
    .select("id, score, mood, created_at, note, notes, week_start")
    .eq("case_id", caseId)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  const goalsRes = await supabase
    .from("goals")
    .select("id, title, status, target_date")
    .eq("case_id", caseId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (checkinsRes.error) return bad(checkinsRes.error.message, 400, checkinsRes.error);
  if (goalsRes.error) return bad(goalsRes.error.message, 400, goalsRes.error);

  return ok({
    case: caseRes.data,
    checkins: checkinsRes.data ?? [],
    latest_checkin: (checkinsRes.data ?? [])[0] ?? null,
    active_goals: goalsRes.data ?? [],
  });
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  // Demo mode: return canned session prep
  if (isDemoMode(req.url)) {
    return ok({ text: getDemoSessionPrep(caseId) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return bad("Anthropic API key not configured", 500);

  // ── Rate limiting: 20 AI calls per case per day ──
  const rl = checkRateLimit(`ai:${caseId}`, 20, 86400_000);
  if (!rl.allowed) {
    return bad("AI rate limit reached for today. Try again tomorrow.", 429);
  }

  const startTime = Date.now();

  // ── Fetch case data for prompt ──
  const checkinsRes = await supabase
    .from("checkins")
    .select("score, note, notes, week_start")
    .eq("case_id", caseId)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  const goalsRes = await supabase
    .from("goals")
    .select("title, status")
    .eq("case_id", caseId)
    .eq("status", "active");

  if (checkinsRes.error) return bad(checkinsRes.error.message, 400);
  if (goalsRes.error) return bad(goalsRes.error.message, 400);

  const checkins: CheckInData[] = (checkinsRes.data ?? []).map((c: any) => ({
    rating: c.score ?? 5,
    notes: c.note ?? c.notes ?? null,
    week_index: null,
  }));

  const goals: GoalData[] = (goalsRes.data ?? []).map((g: any) => ({
    label: g.title ?? "Untitled goal",
  }));

  // ── Build prompt (includes server-side PHI scrub + assertion) ──
  let prompt: string;
  try {
    prompt = buildSessionPrepPrompt({ checkins, goals });
  } catch (e: any) {
    // PHI assertion failure — block the call
    console.error(`[session-prep] PHI assertion blocked call for case=${caseId}: ${e.message}`);
    return bad("Request blocked: potential PHI detected in notes. Please remove personal information.", 400);
  }

  const estimatedInputTokens = estimateTokenCount(prompt);
  console.log(`[session-prep] case=${caseId} estimated_input_tokens=${estimatedInputTokens}`);

  // ── Call Anthropic ──
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok) return bad(json?.error?.message ?? "Anthropic API error", res.status);

  const rawText: string = json?.content?.[0]?.text ?? "";
  const durationMs = Date.now() - startTime;
  const promptTokens = json?.usage?.input_tokens ?? estimatedInputTokens;
  const completionTokens = json?.usage?.output_tokens ?? 0;

  console.log(`[session-prep] case=${caseId} duration_ms=${durationMs} tokens=${completionTokens}`);

  // ── Parse structured output ──
  let parsed: SessionPrepOutput;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // If model didn't return valid JSON, wrap the text as a fallback
    parsed = {
      rating_trend: "insufficient_data",
      rating_delta: null,
      notable_themes: [],
      suggested_focus: rawText.slice(0, 200),
      data_source: `from last ${checkins.length} check-ins`,
      confidence: "low",
      flags: [],
    };
  }

  // ── Validate output against policy ──
  const violations = validateSessionPrepOutput(parsed);
  if (violations.length > 0) {
    console.error(`[session-prep] Output policy violations for case=${caseId}:`, violations);
    // Redact the violating fields rather than blocking entirely
    parsed.suggested_focus = "Review recent check-in data with the patient.";
    parsed.notable_themes = parsed.notable_themes.filter((_t, i) => {
      const themeLower = _t.toLowerCase();
      return !violations.some(v => v.includes(themeLower));
    });
  }

  // ── Audit log (store only the artifact, never raw prompt) ──
  const estimatedCost = (promptTokens * INPUT_COST_PER_TOKEN) + (completionTokens * OUTPUT_COST_PER_TOKEN);

  await logAiCall({
    service: "session-prep",
    case_code: caseId,
    triggered_by: "therapist",
    input_hash: hashPrompt(prompt),
    output_summary: JSON.stringify(parsed).slice(0, 100),
    model: MODEL,
    tokens_used: promptTokens + completionTokens,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    estimated_cost_usd: estimatedCost,
  });

  return ok(parsed);
}
