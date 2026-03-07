// app/api/therapists/[id]/case-signals/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SIGNAL, Signal } from "@/lib/constants";
import { hasAtRiskScore, RISK_THRESHOLDS } from "@/lib/services/risk";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCaseSignals } from "@/lib/demo/demoData";
import { resolveDemoTherapistId } from "@/lib/demo/demoIds";
import { hashPrompt, logAiCall } from "@/lib/services/audit";

function startOfDayISO(dateStr: string) {
  // dateStr expected: YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function addDaysISO(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

type CaseRow = {
  id: string;
  therapist_id: string | null;
  practice_id: string | null;
};

type CheckinRow = {
  case_id: string;
  score: number | null;
  created_at: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const therapistId = resolveDemoTherapistId(rawId);

  if (isDemoMode(request.url)) {
    return NextResponse.json({ data: getDemoCaseSignals(therapistId), error: null });
  }

  const { searchParams } = new URL(request.url);
  const weekStartRaw = searchParams.get("week_start");

  if (!therapistId || !weekStartRaw) {
    return NextResponse.json(
      { data: null, error: { message: "Missing therapistId or week_start" } },
      { status: 400 }
    );
  }

  // Normalize week range as ISO timestamps (UTC)
  const weekStartISO = startOfDayISO(weekStartRaw);
  const weekEndISO = addDaysISO(weekStartRaw, 7);

  // 1) Fetch therapist’s assigned cases
  const { data: caseRowsRaw, error: casesError } = await supabase
    .from("cases")
    .select("id, therapist_id, practice_id")
    .eq("therapist_id", therapistId);

  if (casesError) {
    return NextResponse.json(
      { data: null, error: casesError },
      { status: 500 }
    );
  }

  const caseRows = (caseRowsRaw ?? []) as CaseRow[];
  const caseIds = caseRows.map((c) => c.id);

  if (caseIds.length === 0) {
    return NextResponse.json({
      data: {
        therapist_id: therapistId,
        week_start: weekStartRaw,
        cases: [],
      },
      error: null,
    });
  }

  // 2) Fetch check-ins within the selected week
  const { data: weekCheckinsRaw, error: weekCheckinsError } = await supabase
    .from("checkins")
    .select("case_id, score, created_at")
    .in("case_id", caseIds)
    .gte("created_at", weekStartISO)
    .lt("created_at", weekEndISO);

  if (weekCheckinsError) {
    return NextResponse.json(
      { data: null, error: weekCheckinsError },
      { status: 500 }
    );
  }

  // 3) Fetch “most recent check-in” (best-effort; not perfect per-case, but good enough for now)
  const { data: recentCheckinsRaw, error: recentCheckinsError } = await supabase
    .from("checkins")
    .select("case_id, score, created_at")
    .in("case_id", caseIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (recentCheckinsError) {
    return NextResponse.json(
      { data: null, error: recentCheckinsError },
      { status: 500 }
    );
  }

  const weekList = (weekCheckinsRaw ?? []) as CheckinRow[];
  const recentList = (recentCheckinsRaw ?? []) as CheckinRow[];

  const weekByCase: Record<string, CheckinRow[]> = {};
  for (const ci of weekList) {
    (weekByCase[ci.case_id] ||= []).push(ci);
  }

  const lastByCase: Record<string, CheckinRow> = {};
  for (const ci of recentList) {
    if (!lastByCase[ci.case_id]) lastByCase[ci.case_id] = ci;
  }

  // IMPORTANT: do NOT name this "cases" (it collides with earlier identifiers in other codebases)
  const caseSignals = caseIds.map((caseId) => {
    const w = weekByCase[caseId] ?? [];
    const last = lastByCase[caseId] ?? null;

    const scores = w
      .map((x) => x.score)
      .filter((s): s is number => typeof s === "number");

    const avgWeekScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const missingCheckinThisWeek = w.length === 0;
    const atRiskThisWeek = hasAtRiskScore(scores);

    let signal: Signal = SIGNAL.OK;
    if (atRiskThisWeek) signal = SIGNAL.AT_RISK;
    else if (missingCheckinThisWeek) signal = SIGNAL.MISSING_CHECKIN;
    else if (avgWeekScore !== null && avgWeekScore <= RISK_THRESHOLDS.monitorAvgScore) signal = SIGNAL.MONITOR;

    return {
      case_id: caseId,
      label: caseId, // placeholder until you add patient fields
      signal,
      last_checkin_at: last?.created_at ?? null,
      last_score: typeof last?.score === "number" ? last.score : null,
      week_checkins: w.length,
      week_avg_score: avgWeekScore,
    };
  });

  // Optional: sort by severity so UI is nicer
  const severity: Record<Signal, number> = {
    [SIGNAL.AT_RISK]: 0,
    [SIGNAL.MISSING_CHECKIN]: 1,
    [SIGNAL.MONITOR]: 2,
    [SIGNAL.OK]: 3,
  };
  caseSignals.sort((a, b) => severity[a.signal] - severity[b.signal]);

  // Log risk-classification activity
  if (caseSignals.length > 0) {
    await logAiCall({
      service: "risk-classification",
      case_code: therapistId,
      triggered_by: "system:pipeline",
      input_hash: hashPrompt(`risk-classify:${therapistId}:${weekStartRaw}`),
      output_summary: `classified ${caseSignals.length} cases`,
    });
  }

  return NextResponse.json({
    data: {
      therapist_id: therapistId,
      week_start: weekStartRaw,
      cases: caseSignals,
    },
    error: null,
  });
}