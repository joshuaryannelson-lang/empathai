// app/api/ai/briefing/route.ts
// Structured AI briefing endpoint using Claude Haiku for cost control.
// Returns JSON matching the AIBriefingData shape.
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/demoMode";
import { DEMO_TOUR_CASELOAD } from "@/lib/demo/demoData";

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

    const userPrompt = `Generate a structured weekly briefing for a ${context ?? "therapist"} based on this data:\n${JSON.stringify(dataSnapshot)}`;

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
      // Fallback to structured data if API fails
      return ok(buildFallbackBriefing(dataSnapshot));
    }

    const result = await response.json();
    const text = result?.content?.[0]?.text ?? "";

    try {
      const parsed = JSON.parse(text);
      // Add weekOf
      parsed.weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return ok(parsed);
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
