// app/api/ai/briefing/route.ts
// Structured AI briefing endpoint using Claude Haiku for cost control.
// Returns JSON matching the AIBriefingData shape.
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/demoMode";
import { DEMO_TOUR_CASELOAD } from "@/lib/demo/demoData";
import { scrubPrompt, scrubOutput } from "@/lib/phi/scrub";
import { requireRole, isAuthError, logUnauthorizedAccess, getClientIp } from "@/lib/apiAuth";
import { checkRateLimitAsync } from "@/lib/rateLimit";
import { logAiCall, hashPrompt } from "@/lib/services/audit";
import { checkAiCostCeiling } from "@/lib/aiCostCeiling";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}
function bad(msg: string, status = 400) {
  return NextResponse.json({ data: null, error: { message: msg } }, { status });
}

// Demo briefing — matches DEMO_TOUR_CASELOAD shape
function getDemoStructuredBriefing() {
  const weekOf = "Mar 7, 2026";
  return {
    priorityAlerts: [
      {
        firstName: "Morgan",
        score: 2,
        note: "Mentioned feeling overwhelmed",
        recommendation: "Reach out before Thursday's session",
      },
    ],
    positiveSignals: [
      {
        firstName: "Jordan",
        scoreTrend: "climbing from 4 to 8",
        detail: "Strong momentum.",
      },
    ],
    stable: [
      { firstName: "Alex", score: 6, flag: null },
      { firstName: "Riley", score: 5, flag: "missing" as const },
    ],
    recommendedActions: [
      "Reach out to Morgan before Thursday's session",
      "Review Morgan's safety plan at session start",
      "Acknowledge Jordan's progress this week",
    ],
    weekOf,
  };
}

export async function POST(req: Request) {
  // ── Auth guard: admin or therapist only ──
  const auth = await requireRole("admin", "therapist");
  if (isAuthError(auth)) {
    await logUnauthorizedAccess("/api/ai/briefing", null, getClientIp(req));
    return auth;
  }

  // ── Rate limiting: therapist 20/hr, admin 60/hr ──
  const rateLimitMax = auth.role === "admin" ? 60 : 20;
  const rateLimitKey = `ai:briefing:${auth.user_id ?? auth.role}`;
  const rl = await checkRateLimitAsync(rateLimitKey, rateLimitMax, 3600_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new NextResponse(
      JSON.stringify({ data: null, error: { message: "rate_limit_exceeded", retryAfter: retryAfter > 0 ? retryAfter : 60 } }),
      { status: 429, headers: { "Retry-After": String(retryAfter > 0 ? retryAfter : 60), "Content-Type": "application/json" } },
    );
  }

  // ── Cost ceiling: $25/month ──
  const costCheck = await checkAiCostCeiling();
  if (!costCheck.allowed) {
    return bad("AI limit reached — monthly cost ceiling exceeded", 503);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { dataSnapshot, context } = body;

    // Demo mode: return canned structured briefing
    if (isDemoMode(req.url)) {
      const demo = getDemoStructuredBriefing();
      return ok(demo);
    }

    if (!dataSnapshot || typeof dataSnapshot !== "object") {
      return bad("dataSnapshot is required");
    }

    // Build prompt for Claude
    const systemPrompt = `You are a clinical support AI for a therapy practice management system. Generate a structured weekly briefing. Respond ONLY in valid JSON — no markdown, no preamble, no explanation. Shape:
{
  "priorityAlerts": [{"firstName": string, "score": number, "note": string, "recommendation": string}],
  "positiveSignals": [{"firstName": string, "scoreTrend": string, "detail": string}],
  "stable": [{"firstName": string, "score": number, "flag": string|null}],
  "recommendedActions": [string]
}
Rules: first names only, no identifiers, priorityAlerts for score ≤ 3 or drop ≥ 3 points, max 4 recommendedActions, every item clinically relevant.`;

    // Scrub all user-derived data before it enters the prompt
    const rawSnapshot = JSON.stringify(dataSnapshot);
    const scrubbedSnapshot = scrubPrompt(rawSnapshot, { field: "dataSnapshot", route: "/api/ai/briefing" });
    const scrubbedContext = context ? scrubPrompt(String(context), { field: "context", route: "/api/ai/briefing" }).text : "therapist";

    const userPrompt = `Generate a structured weekly briefing for a ${scrubbedContext} based on this data:\n${scrubbedSnapshot.text}`;

    // Try to call Claude API if key is available
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback: return structured demo-like data based on the snapshot
      return ok(buildFallbackBriefing(dataSnapshot));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      // Log failed AI call
      await logAiCall({
        service: "briefing",
        case_code: auth.user_id ?? "unknown",
        triggered_by: auth.user_id ?? auth.role ?? "unknown",
        input_hash: hashPrompt(systemPrompt + userPrompt),
        model: "claude-haiku-4-5-20251001",
        tokens_used: 0,
        error: true,
      });
      // Fallback to structured data if API fails
      return ok(buildFallbackBriefing(dataSnapshot));
    }

    const result = await response.json();
    const text = result?.content?.[0]?.text ?? "";

    // ── Audit log: after confirmed success ──
    const tokensEstimated = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    await logAiCall({
      service: "briefing",
      case_code: auth.user_id ?? "unknown",
      triggered_by: auth.user_id ?? auth.role ?? "unknown",
      input_hash: hashPrompt(systemPrompt + userPrompt),
      model: "claude-haiku-4-5-20251001",
      tokens_used: tokensEstimated,
    });

    try {
      const parsed = JSON.parse(text);
      // Add weekOf
      parsed.weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      // Scrub AI output before returning to client
      const scrubbed = scrubOutput(JSON.stringify(parsed), { field: "briefing_output", route: "/api/ai/briefing" });
      return ok(JSON.parse(scrubbed.text));
    } catch {
      // JSON parse failed, return fallback
      return ok(buildFallbackBriefing(dataSnapshot));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return bad(message, 500);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackBriefing(snapshot: any) {
  const weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  // Try to build from snapshot data
  const cases = snapshot?.cases ?? [];
  const priorityAlerts = cases
    .filter((c: { score?: number }) => c.score != null && c.score <= 3)
    .slice(0, 3)
    .map((c: { firstName?: string; score?: number; note?: string }) => ({
      firstName: c.firstName ?? "Patient",
      score: c.score ?? 0,
      note: c.note ?? "Score below threshold",
      recommendation: "Follow up before next session",
    }));

  const positiveSignals = cases
    .filter((c: { trend?: string }) => c.trend === "up")
    .slice(0, 3)
    .map((c: { firstName?: string; score?: number }) => ({
      firstName: c.firstName ?? "Patient",
      scoreTrend: `improving to ${c.score ?? "—"}`,
      detail: "Positive momentum this week.",
    }));

  const stable = cases
    .filter((c: { trend?: string; score?: number }) => c.trend === "stable" && (c.score ?? 0) > 3)
    .slice(0, 4)
    .map((c: { firstName?: string; score?: number; flag?: string | null }) => ({
      firstName: c.firstName ?? "Patient",
      score: c.score ?? 0,
      flag: c.flag ?? null,
    }));

  const actions: string[] = [];
  if (priorityAlerts.length > 0) {
    actions.push(`Follow up with ${priorityAlerts[0].firstName} before their next session`);
    actions.push(`Review safety plan for at-risk patients`);
  }
  if (positiveSignals.length > 0) {
    actions.push(`Acknowledge ${positiveSignals[0].firstName}'s progress`);
  }

  return { priorityAlerts, positiveSignals, stable, recommendedActions: actions, weekOf };
}
