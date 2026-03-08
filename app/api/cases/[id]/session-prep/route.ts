// app/api/cases/[id]/session-prep/route.ts
// Session preparation: GET returns raw data, POST generates AI-powered structured summary.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoSessionPrepStructured } from "@/lib/demo/demoAI";
import { checkRateLimitAsync } from "@/lib/rateLimit";
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
import { scrubOutput } from "@/lib/phi/scrub";
import { requireRole, isAuthError, verifyCaseOwnership } from "@/lib/apiAuth";
import { checkCostCeiling, checkCostAlert, recordSpend } from "@/lib/ai-cost-guard";
import { calculateCost } from "@/lib/ai-pricing";
import { safeLog } from "@/lib/logger";

// Format "2026-03-03" → "Week of Mar 3"
function formatWeekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `Week of ${month} ${day}`;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 800;

// Pricing now managed by lib/ai-pricing.ts (single source of truth)

export async function GET(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  // Demo mode: return fixture data without DB calls
  if (isDemoMode(req.url)) {
    const { getDemoCase, getDemoCaseCheckins, getDemoCaseGoals } = await import("@/lib/demo/demoData");
    const c = getDemoCase(caseId);
    if (!c) return bad("Case not found", 404);
    const checkins = getDemoCaseCheckins(caseId).slice(0, 4).map(ci => ({ ...ci, week_start: ci.created_at.slice(0, 10) }));
    const goals = getDemoCaseGoals(caseId).filter(g => g.status === "active");
    return ok({
      case: { id: c.id, title: c.title, status: c.status, created_at: c.created_at, patient_id: c.patient_id, therapist_id: c.therapist_id, practice_id: c.practice_id },
      checkins,
      latest_checkin: checkins[0] ?? null,
      active_goals: goals,
      snapshot: null,
    });
  }

  // Use supabaseAdmin (service role) to bypass RLS — anon key returns 0 rows
  // when checkins/goals RLS policies restrict SELECT to authenticated users.
  const caseRes = await supabaseAdmin.from("cases").select("id, title, status, created_at, patient_id, therapist_id, practice_id").eq("id", caseId).single();
  if (caseRes.error) return bad(caseRes.error.message, 400, caseRes.error);

  const checkinsRes = await supabaseAdmin
    .from("checkins")
    .select("id, score, mood, created_at, note, week_start")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(4);

  const goalsRes = await supabaseAdmin
    .from("goals")
    .select("id, title, status, target_date")
    .eq("case_id", caseId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Load existing AI snapshot (if any)
  const snapshotRes = await supabaseAdmin
    .from("case_ai_snapshots")
    .select("id, content, generated_at, reviewed, reviewed_at, reviewed_by")
    .eq("case_id", caseId)
    .single();

  if (checkinsRes.error) return bad(checkinsRes.error.message, 400, checkinsRes.error);
  if (goalsRes.error) return bad(goalsRes.error.message, 400, goalsRes.error);

  return ok({
    case: caseRes.data,
    checkins: checkinsRes.data ?? [],
    latest_checkin: (checkinsRes.data ?? [])[0] ?? null,
    active_goals: goalsRes.data ?? [],
    snapshot: snapshotRes.data ?? null,
  });
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  // ── Auth guard: admin or therapist only ──
  const auth = await requireRole("admin", "therapist");
  if (isAuthError(auth)) return auth;

  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  // Ownership check
  const ownershipErr = await verifyCaseOwnership(caseId, auth);
  if (ownershipErr) return ownershipErr;

  // Demo mode: return canned session prep (structured 4-card)
  if (isDemoMode(req.url)) {
    const structured = getDemoSessionPrepStructured(caseId);
    return ok(structured);
  }

  // ── Cost ceiling: $25/month (Redis-backed circuit breaker) ──
  const costCheck = await checkCostCeiling();
  if (!costCheck.allowed) {
    return bad("ai_cost_ceiling_reached", 503);
  }
  // Alert threshold at $20 — structured warning for observability
  const isAlertMode = await checkCostAlert();
  if (isAlertMode) {
    safeLog.warn("[session-prep] AI cost alert threshold reached", { alert: "ai_cost_threshold", spend: costCheck.spend.toFixed(4), threshold: "20" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return bad("Anthropic API key not configured", 500);

  // ── Rate limiting: 20 AI calls per case per day ──
  const rl = await checkRateLimitAsync(`ai:session-prep:${caseId}`, 20, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ data: null, error: { message: "rate_limit_exceeded", retryAfter: retryAfter > 0 ? retryAfter : 60 } }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter > 0 ? retryAfter : 60) } },
    );
  }

  const startTime = Date.now();

  // Diagnostic: log whether service role key is configured (no case codes)
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  safeLog.info("[session-prep] POST started", { event: "session_prep_start", route: "/api/cases/[id]/session-prep", hasServiceRoleKey: String(hasServiceKey) });

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
    .select("score, note, week_start, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(4);

  safeLog.info("[session-prep] data fetched", { event: "session_prep_data", route: "/api/cases/[id]/session-prep", case_found: String(!!caseRes.data), checkins_found: String(checkinsRes.data?.length ?? 0) });

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
    notes: c.note ?? null,
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
    safeLog.error("[session-prep] PHI assertion blocked call", { event: "phi_blocked", route: "/api/cases/[id]/session-prep", reason: e.message });
    return bad("Request blocked: potential PHI detected in notes. Please remove personal information.", 400);
  }

  const estimatedInputTokens = estimateTokenCount(prompt);
  safeLog.info("[session-prep] prompt built", { event: "prompt_ready", route: "/api/cases/[id]/session-prep", model: MODEL, estimated_input_tokens: String(estimatedInputTokens) });

  // ── GAP-13: Call Anthropic with retry logic ──────────────────────────────
  // Retries up to 2 times on 504 / network errors only (not 4xx).
  // Exponential backoff: 1s, 2s. Each attempt has its own 10s AbortController.
  // On final failure: returns bad('prep_unavailable', 503).
  // Structured JSON logging per attempt — NO case codes, NO PHI.
  const MAX_RETRIES = 2;
  const BACKOFF_MS = [1000, 2000];
  const TIMEOUT_MS = 10_000;

  let res: Response | null = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
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
        signal: controller.signal,
      });
      clearTimeout(timeout);
      lastStatus = res.status;

      // Success or client error (4xx) — do not retry
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        break;
      }

      // Server error (5xx including 504) — retry
      safeLog.warn("[session-prep] retrying", { event: "ai_retry", route: "/api/cases/[id]/session-prep", attempt: String(attempt), status: String(res.status), latency_ms: String(Date.now() - attemptStart) });

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - attemptStart;
      const isTimeout = err?.name === "AbortError";

      safeLog.warn("[session-prep] retrying after error", { event: "ai_retry", route: "/api/cases/[id]/session-prep", attempt: String(attempt), status: isTimeout ? "504" : "0", latency_ms: String(latencyMs) });

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }

      // Final attempt failed — log and return
      await logAiCall({ service: "session-prep", case_code: caseId, triggered_by: "therapist", input_hash: hashPrompt(prompt), error: true });
      return bad("prep_unavailable", 503);
    }
  }

  // If we exhausted retries on server errors
  if (!res || (!res.ok && !(res.status >= 400 && res.status < 500))) {
    await logAiCall({ service: "session-prep", case_code: caseId, triggered_by: "therapist", input_hash: hashPrompt(prompt), error: true });
    return bad("prep_unavailable", 503);
  }

  const json = await res.json();
  if (!res.ok) {
    await logAiCall({ service: "session-prep", case_code: caseId, triggered_by: "therapist", input_hash: hashPrompt(prompt), error: true });
    return bad(json?.error?.message ?? "Anthropic API error", res.status);
  }

  const rawText: string = json?.content?.[0]?.text ?? "";
  const durationMs = Date.now() - startTime;
  const promptTokens = json?.usage?.input_tokens ?? estimatedInputTokens;
  const completionTokens = json?.usage?.output_tokens ?? 0;

  safeLog.info("[session-prep] response received", { event: "ai_response", route: "/api/cases/[id]/session-prep", duration_ms: String(durationMs), tokens: String(completionTokens) });

  // ── Parse structured output ──
  // Strip markdown fences the model may wrap around JSON (e.g. ```json ... ```)
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: SessionPrepOutput;
  try {
    parsed = JSON.parse(cleaned);
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

  // ── Replace [NAME] placeholders with actual patient first name ──
  // The AI sometimes echoes the [NAME] redaction tag from scrubbed check-in notes
  // instead of using the patientFirstName field provided separately in the prompt.
  if (patientFirstName) {
    const replaceName = (s: string | null) => s?.replace(/\[NAME\]/g, patientFirstName) ?? s;
    parsed.open_with = replaceName(parsed.open_with);
    parsed.watch_for = replaceName(parsed.watch_for);
    parsed.try_this = replaceName(parsed.try_this);
    parsed.send_this = replaceName(parsed.send_this);
  } else {
    // No name available — replace [NAME] with a safe fallback
    const replaceName = (s: string | null) => s?.replace(/\[NAME\]/g, "there") ?? s;
    parsed.open_with = replaceName(parsed.open_with);
    parsed.watch_for = replaceName(parsed.watch_for);
    parsed.try_this = replaceName(parsed.try_this);
    parsed.send_this = replaceName(parsed.send_this);
  }

  // ── Validate output against policy ──
  const violations = validateSessionPrepOutput(parsed);
  if (violations.length > 0) {
    safeLog.error("[session-prep] Output policy violations", { event: "policy_violation", route: "/api/cases/[id]/session-prep", violations: violations.join(", ") });
    // Null out the violating card fields
    for (const v of violations) {
      if (v.includes("open_with")) parsed.open_with = null;
      if (v.includes("watch_for")) parsed.watch_for = null;
      if (v.includes("try_this")) parsed.try_this = null;
      if (v.includes("send_this")) parsed.send_this = null;
    }
  }

  // ── Scrub AI output before returning to client (GAP-18) ──
  const textFields = ["open_with", "watch_for", "try_this", "send_this"] as const;
  for (const key of textFields) {
    if (parsed[key]) {
      const scrubbed = scrubOutput(parsed[key]!, { field: key, route: "/api/cases/session-prep" });
      parsed[key] = scrubbed.text;
    }
  }

  // ── Audit log (store only the artifact, never raw prompt) ──
  const estimatedCost = calculateCost(MODEL, promptTokens, completionTokens);

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

  // ── Record spend in Redis for circuit breaker ──
  await recordSpend(estimatedCost);

  // Log redaction service activity (scrubbing always runs inside buildSessionPrepPrompt)
  await logAiCall({
    service: "redaction",
    case_code: caseId,
    triggered_by: "system:pipeline",
    input_hash: hashPrompt(prompt),
    output_summary: "prompt-scrub",
  });

  // ── Persist snapshot (upsert — one per case) ──
  const therapistId = caseRes.data?.therapist_id ?? null;
  await supabaseAdmin
    .from("case_ai_snapshots")
    .upsert(
      {
        case_id: caseId,
        therapist_id: therapistId,
        content: parsed,
        generated_at: new Date().toISOString(),
        reviewed: false,
        reviewed_at: null,
        reviewed_by: null,
      },
      { onConflict: "case_id" }
    );

  return ok(parsed);
}

export async function PATCH(req: Request, ctx: RouteContextWithId) {
  const auth = await requireRole("admin", "therapist");
  if (isAuthError(auth)) return auth;

  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  const ownershipErr = await verifyCaseOwnership(caseId, auth);
  if (ownershipErr) return ownershipErr;

  const body = await req.json().catch(() => ({}));
  const reviewed = body?.reviewed;
  const reviewedBy = typeof body?.reviewed_by === "string" ? body.reviewed_by : null;

  if (typeof reviewed !== "boolean") return bad("reviewed (boolean) required");

  const update: Record<string, unknown> = {
    reviewed,
    reviewed_at: reviewed ? new Date().toISOString() : null,
    reviewed_by: reviewed ? reviewedBy : null,
  };

  const { data, error } = await supabaseAdmin
    .from("case_ai_snapshots")
    .update(update)
    .eq("case_id", caseId)
    .select("id, reviewed, reviewed_at, reviewed_by")
    .single();

  if (error) return bad(error.message, 400);
  return ok(data);
}
