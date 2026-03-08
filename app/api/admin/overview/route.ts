// app/api/admin/overview/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoAdminOverview } from "@/lib/demo/demoData";
import { requireRole, isAuthError, logUnauthorizedAccess, getClientIp } from "@/lib/apiAuth";

type RangeKey = "1d" | "7d" | "30d" | "this_week" | "last_week";

const ALLOWED: RangeKey[] = ["1d", "7d", "30d", "this_week", "last_week"];

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = (day + 6) % 7; // Monday => 0
  x.setDate(x.getDate() - diffToMonday);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function computeWindow(range: RangeKey) {
  const now = new Date();
  const end = new Date(now);

  if (range === "1d") return { start: addDays(end, -1), end };
  if (range === "7d") return { start: addDays(end, -7), end };
  if (range === "30d") return { start: addDays(end, -30), end };

  // Weekly buckets only for these two (still not “week UI”, just a stable window)
  if (range === "this_week") {
    const start = startOfWeekMonday(now);
    return { start, end: addDays(start, 7) };
  }

  // last_week
  const thisWeekStart = startOfWeekMonday(now);
  return { start: addDays(thisWeekStart, -7), end: thisWeekStart };
}

function errMsg(e: any) {
  // Supabase errors often have .message
  return typeof e?.message === "string" ? e.message : "Unknown error";
}

export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) {
    await logUnauthorizedAccess("/api/admin/overview", null, getClientIp(request));
    return auth;
  }

  if (isDemoMode(request.url)) {
    return NextResponse.json({ data: getDemoAdminOverview(), error: null });
  }

  const { searchParams } = new URL(request.url);
  const rawRange = (searchParams.get("range") as RangeKey) || "7d";
  const range: RangeKey = ALLOWED.includes(rawRange) ? rawRange : "7d";

  const { start, end } = computeWindow(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // IMPORTANT: confirm your table name is actually "practice".
  // If your schema uses "practices", change it here and everywhere else.
  const { data: practices, error: pErr } = await supabase
    .from("practice")
    .select("id, name")
    .order("name", { ascending: true });

  if (pErr) {
    return NextResponse.json({ data: null, error: errMsg(pErr) }, { status: 500 });
  }

  const practiceIds = (practices ?? []).map((p) => p.id);

  // Early return: no practices means no downstream queries needed
  if (practiceIds.length === 0) {
    return NextResponse.json({
      data: {
        range,
        window: { start: startISO, end: endISO },
        totals: {
          practices: 0,
          therapists: 0,
          active_cases: 0,
          unassigned_cases: 0,
          checkins: 0,
          avg_score: null,
          at_risk_checkins: 0,
        },
        practices: [],
      },
      error: null,
    });
  }

  const { data: therapists, error: tErr } = await supabase
    .from("therapists")
    .select("id, practice_id")
    .in("practice_id", practiceIds);

  if (tErr) {
    return NextResponse.json({ data: null, error: errMsg(tErr) }, { status: 500 });
  }

  const { data: cases, error: cErr } = await supabase
    .from("cases")
    .select("id, practice_id, therapist_id, status")
    .in("practice_id", practiceIds);

  if (cErr) {
    return NextResponse.json({ data: null, error: errMsg(cErr) }, { status: 500 });
  }

  const caseIds = (cases ?? []).map((c) => c.id);

  const { data: checkins, error: ciErr } =
    caseIds.length > 0
      ? await supabase
          .from("checkins")
          .select("case_id, score, created_at")
          .in("case_id", caseIds)
          .gte("created_at", startISO)
          .lt("created_at", endISO)
      : { data: [], error: null };

  if (ciErr) {
    return NextResponse.json({ data: null, error: errMsg(ciErr) }, { status: 500 });
  }

  // ---------- Aggregation ----------
  const therapistsByPractice: Record<string, number> = {};
  for (const t of therapists ?? []) {
    const pid = (t as any).practice_id as string;
    therapistsByPractice[pid] = (therapistsByPractice[pid] ?? 0) + 1;
  }

  const totalCasesByPractice: Record<string, number> = {};
  const activeCasesByPractice: Record<string, number> = {};
  const unassignedByPractice: Record<string, number> = {};
  const practiceByCase: Record<string, string> = {};

  for (const c of cases ?? []) {
    const pid = (c as any).practice_id as string;
    const therapistId = (c as any).therapist_id as string | null;
    const status = (c as any).status as string | null;

    totalCasesByPractice[pid] = (totalCasesByPractice[pid] ?? 0) + 1;
    if (!therapistId) unassignedByPractice[pid] = (unassignedByPractice[pid] ?? 0) + 1;

    // If you want stricter “active” semantics, replace this with: status === "active"
    if (!status || status === "active") {
      activeCasesByPractice[pid] = (activeCasesByPractice[pid] ?? 0) + 1;
    }

    practiceByCase[(c as any).id] = pid;
  }

  const checkinsByPractice: Record<string, { count: number; sum: number; scored: number; low: number }> = {};

  let totalCheckins = 0;
  let totalScored = 0;
  let totalSum = 0;
  let totalLow = 0;

  for (const ci of checkins ?? []) {
    totalCheckins += 1;

    const pid = practiceByCase[(ci as any).case_id];
    if (!pid) continue;

    const bucket = (checkinsByPractice[pid] ??= { count: 0, sum: 0, scored: 0, low: 0 });
    bucket.count += 1;

    const score = (ci as any).score;
    if (typeof score === "number") {
      bucket.sum += score;
      bucket.scored += 1;
      if (score <= 3) bucket.low += 1;

      totalSum += score;
      totalScored += 1;
      if (score <= 3) totalLow += 1;
    }
  }

  const practicesTable = (practices ?? []).map((p) => {
    const pid = p.id;
    const ci = checkinsByPractice[pid] ?? { count: 0, sum: 0, scored: 0, low: 0 };
    const avg = ci.scored ? ci.sum / ci.scored : null;

    return {
      id: pid,
      name: p.name ?? null,
      therapists: therapistsByPractice[pid] ?? 0,
      active_cases: activeCasesByPractice[pid] ?? 0,
      total_cases: totalCasesByPractice[pid] ?? 0,
      unassigned_cases: unassignedByPractice[pid] ?? 0,
      checkins: ci.count,
      avg_score: avg,
      at_risk_checkins: ci.low,
    };
  });

  // sort: most at-risk first, then unassigned, then lowest avg
  practicesTable.sort((a, b) => {
    if (b.at_risk_checkins !== a.at_risk_checkins) return b.at_risk_checkins - a.at_risk_checkins;
    if (b.unassigned_cases !== a.unassigned_cases) return b.unassigned_cases - a.unassigned_cases;
    return (a.avg_score ?? 999) - (b.avg_score ?? 999);
  });

  return NextResponse.json({
    data: {
      range,
      window: { start: startISO, end: endISO },
      totals: {
        practices: practices?.length ?? 0,
        therapists: therapists?.length ?? 0,
        active_cases: Object.values(activeCasesByPractice).reduce((a, b) => a + b, 0),
        unassigned_cases: Object.values(unassignedByPractice).reduce((a, b) => a + b, 0),
        checkins: totalCheckins,
        avg_score: totalScored ? totalSum / totalScored : null,
        at_risk_checkins: totalLow,
      },
      practices: practicesTable,
    },
    error: null,
  });
}