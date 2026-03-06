// app/api/cases/[id]/session-prep/route.ts
// Session preparation: GET returns raw data, POST generates AI-powered structured summary.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoSessionPrepStructured } from "@/lib/demo/demoAI";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  buildSessionPrepPrompt,
  validateSessionPrepOutput,
  estimateTokenCount,
  type SessionPrepOutput,
  type CheckInData,
  type GoalData,
} from "@/lib/ai/sessionPrepPrompt";
import { describeDsmCodes } from "@/lib/ai/dsmDescriptions";
import { hashPrompt, logAiCall } from "@/lib/services/audit";

// Format "2026-03-03" → "Week of Mar 3"
function formatWeekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `Week of ${month} ${day}`;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 800;

// Sonnet pricing: $3/M input, $15/M output
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

export async function GET(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  // Demo mode: return fixture data without DB calls
  if (isDemoMode(req.url)) {
    const { getDemoCase, getDemoCaseCheckins, getDemoCaseGoals } = await import("@/lib/demo/demoData");
    const c = getDemoCase(caseId);
    if (!c) return bad("Case not found", 404);
    const checkins = getDemoCaseCheckins(caseId).slice(0, 4).map(ci => ({ ...ci, notes: ci.note, week_start: ci.created_at.slice(0, 10) }));
    const goals = getDemoCaseGoals(caseId).filter(g => g.status === "active");
    return ok({
      case: { id: c.id, title: c.title, status: c.status, created_at: c.created_at, patient_id: c.patient_id, therapist_id: c.therapist_id, practice_id: c.practice_id },
      checkins,
      latest_checkin: checkins[0] ?? null,
      active_goals: goals,
    });
  }

  // Use supabaseAdmin (service role) to bypass RLS — anon key returns 0 rows
  // when checkins/goals RLS policies restrict SELECT to authenticated users.
  const caseRes = await supabaseAdmin.from("cases").select("id, title, status, created_at, patient_id, therapist_id, practice_id").eq("id", caseId).single();
  if (caseRes.error) return bad(caseRes.error.message, 400, caseRes.error);

  const checkinsRes = await supabaseAdmin
    .from("checkins")
    .select("id, score, mood, created_at, note, notes, week_start")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(4);

  const goalsRes = await supabaseAdmin
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

  // Demo mode: return canned session prep (structured 4-card)
  if (isDemoMode(req.url)) {
    const structured = getDemoSessionPrepStructured(caseId);
    return ok(structured);
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
  // Use supabaseAdmin (service role) — anon key returns 0 rows when RLS
  // restricts SELECT to authenticated users (checkins_select, goals_select).
  const caseRes = await supabaseAdmin
    .from("cases")
    .select("patient_id, therapist_id, dsm_codes, clinical_notes")
    .eq("id", caseId)
    .single();

  const checkinsRes = await supabaseAdmin
    .from("checkins")
    .select("score, note, notes, week_start, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(4);

  console.log(`[session-prep] case=${caseId} checkins_found=${checkinsRes.data?.length ?? 0} checkins_error=${checkinsRes.error?.message ?? "none"}`);

  // FIX 2: fetch all goals (active + completed) so model can reference recent wins
  const goalsRes = await supabaseAdmin
    .from("goals")
    .select("title, status")
    .eq("case_id", caseId)
    .in("status", ["active", "completed"]);

  if (checkinsRes.error) return bad(checkinsRes.error.message, 400);
  if (goalsRes.error) return bad(goalsRes.error.message, 400);

  // Fetch patient first name for send_this personalization
  let patientFirstName: string | undefined;
  if (caseRes.data?.patient_id) {
    const patientRes = await supabaseAdmin
      .from("patients")
      .select("first_name")
      .eq("id", caseRes.data.patient_id)
      .single();
    patientFirstName = patientRes.data?.first_name ?? undefined;
  }

  // Fetch therapist modalities for TRY THIS personalization
  let modalities: string[] | undefined;
  if (caseRes.data?.therapist_id) {
    const therapistRes = await supabaseAdmin
      .from("therapists")
      .select("extended_profile")
      .eq("id", caseRes.data.therapist_id)
      .single();
    const ep = therapistRes.data?.extended_profile as any;
    modalities = Array.isArray(ep?.therapy_modalities) && ep.therapy_modalities.length > 0
      ? ep.therapy_modalities
      : undefined;
  }

  // Translate DSM codes to plain descriptions — raw codes NEVER enter the prompt
  const rawDsmCodes: string[] = Array.isArray(caseRes.data?.dsm_codes) ? caseRes.data.dsm_codes : [];
  const dsmContext = rawDsmCodes.length > 0 ? describeDsmCodes(rawDsmCodes) : undefined;

  // Format week label: prefer week_start, fall back to created_at date
  const checkins: CheckInData[] = (checkinsRes.data ?? []).map((c: any) => ({
    rating: c.score ?? 5,
    notes: c.note ?? c.notes ?? null,
    week_label: c.week_start
      ? formatWeekLabel(c.week_start)
      : c.created_at
        ? formatWeekLabel(c.created_at.slice(0, 10))
        : null,
  }));

  // FIX 2: pass goal status so prompt shows [ACTIVE] / [COMPLETED] markers
  const goals: GoalData[] = (goalsRes.data ?? []).map((g: any) => ({
    label: g.title ?? "Untitled goal",
    status: g.status ?? "active",
  }));

  // FIX 3: pass clinical notes (scrubbing happens inside buildSessionPrepPrompt)
  const clinicalNotes: string | null = (caseRes.data as any)?.clinical_notes ?? null;

  // ── Build prompt (includes server-side PHI scrub + assertion) ──
  // Estimated ~530 input tokens typical (was ~380). Cost: ~$0.0016/call input.
  let prompt: string;
  try {
    prompt = buildSessionPrepPrompt({ checkins, goals, patientFirstName, clinicalNotes, modalities, dsmContext });
  } catch (e: any) {
    // PHI assertion failure — block the call
    console.error(`[session-prep] PHI assertion blocked call for case=${caseId}: ${e.message}`);
    return bad("Request blocked: potential PHI detected in notes. Please remove personal information.", 400);
  }

  const estimatedInputTokens = estimateTokenCount(prompt);
  console.log(`[session-prep] case=${caseId} model=${MODEL} estimated_input_tokens=${estimatedInputTokens}`);

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
    // If model didn't return valid JSON, create a fallback
    parsed = {
      rating_trend: "insufficient_data",
      rating_delta: null,
      data_source: `from last ${checkins.length} check-ins`,
      confidence: "low",
      flags: [],
      open_with: null,
      watch_for: null,
      try_this: null,
      send_this: null,
    };
  }

  // ── Validate output against policy ──
  const violations = validateSessionPrepOutput(parsed);
  if (violations.length > 0) {
    console.error(`[session-prep] Output policy violations for case=${caseId}:`, violations);
    // Null out the violating card fields
    for (const v of violations) {
      if (v.includes("open_with")) parsed.open_with = null;
      if (v.includes("watch_for")) parsed.watch_for = null;
      if (v.includes("try_this")) parsed.try_this = null;
      if (v.includes("send_this")) parsed.send_this = null;
    }
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
