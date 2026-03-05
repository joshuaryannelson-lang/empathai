// app/api/cases/[id]/ai-summary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

/**
 * Optional: If you want, you can later import supabase and pull real case/checkin data.
 * For now, we keep this route 100% stubbed for demo purposes.
 */
// import { supabase } from "@/lib/supabase";

type AiSummaryPayload = {
  case_id: string;
  week_start: string;
  summary: string;
  changes: string[];
  risks: string[];
  next_actions: string[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Sometimes params mysteriously comes through as {} depending on Next version / typing / build.
 * This tries (in order):
 * 1) params.id if present
 * 2) parse from pathname /api/cases/<id>/ai-summary
 */
function extractCaseId(requestUrl: string, paramsMaybe: any): string | null {
  const fromParams = paramsMaybe?.id;
  if (typeof fromParams === "string" && fromParams.length) return fromParams;

  try {
    const u = new URL(requestUrl);
    const m = u.pathname.match(/\/api\/cases\/([^/]+)\/ai-summary/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {}

  return null;
}

/**
 * Deterministic pseudo-random generator so each case/week looks “consistently unique”
 * without needing a DB.
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickUnique(rng: () => number, arr: string[], n: number) {
  const copy = [...arr];
  const out: string[] = [];
  while (copy.length && out.length < n) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

export async function GET(
  request: Request,
  context: { params?: any } // keep loose to avoid Next version typing issues
) {
  const { searchParams } = new URL(request.url);

  const weekStart = searchParams.get("week_start");
  const caseId = extractCaseId(request.url, context?.params);

  // Validate inputs
  if (!caseId || !weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isUUID(caseId)) {
    return NextResponse.json(
      { data: null, error: "Missing/invalid caseId or week_start" },
      { status: 400 }
    );
  }

  // Simulate “thinking” latency so the UI feels real in demos
  const seed = hashSeed(`${caseId}-${weekStart}`);
  const rng = mulberry32(seed);
  await sleep(900 + Math.floor(rng() * 900)); // 0.9s–1.8s

  // Fake “AI” output (deterministic per case/week)
  const summaries = [
    "Client appears stable overall with moderate engagement. No acute risk signals detected in the available check-in window.",
    "Engagement looks inconsistent this week. Recommend a low-friction outreach and confirm the next session plan.",
    "Signals suggest increased strain. Consider grounding tools, clarify near-term goals, and confirm support between sessions.",
    "Progress appears steady with mild variability. Reinforce what’s working and keep the plan simple and repeatable.",
  ];

  const changeBullets = [
    "Check-in scores improved vs prior baseline.",
    "Check-ins are inconsistent (possible scheduling friction).",
    "Mood variability increased mid-week based on self-report signals.",
    "Routine disruption noted (sleep / appetite / structure).",
    "Client engagement is steady but effort seems higher than usual.",
  ];

  const riskBullets = [
    "Low-score flag detected (≤ 3) within the window.",
    "No check-ins logged this week (possible disengagement).",
    "Elevated stressors reported; monitor next week’s trend.",
    "No explicit risk indicators in the available signals.",
    "Watch for avoidance patterns (missed check-ins / low follow-through).",
  ];

  const actionBullets = [
    "Send a brief outreach message offering a 10-minute check-in.",
    "Confirm next session time + reduce friction (link + reminder).",
    "Reinforce 1–2 coping tools and agree on a tiny homework step.",
    "If scores remain low next week, consider stepping up cadence temporarily.",
    "Ask one clarifying question: “What felt hardest this week?” then reflect back.",
  ];

  const payload: AiSummaryPayload = {
    case_id: caseId,
    week_start: weekStart,
    summary: pick(rng, summaries),
    changes: pickUnique(rng, changeBullets, 2),
    risks: pickUnique(rng, riskBullets, 2),
    next_actions: pickUnique(rng, actionBullets, 3),
  };

  return NextResponse.json({ data: payload, error: null });
}