// FILE: app/api/therapists/[id]/care/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isScoreCritical } from "@/lib/services/risk";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoTherapistCare } from "@/lib/demo/demoData";

export const dynamic = "force-dynamic";

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7; // Monday => 0
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return toYYYYMMDD(d);
}

function startOfDayISO(yyyyMmDd: string) {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();
}

function addDaysISO(yyyyMmDd: string, days: number) {
  const d = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export async function GET(
  request: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve((ctx as any).params);
  const therapistId = resolvedParams?.id as string | undefined;

  const { searchParams } = new URL(request.url);

  const rawWeekStart = searchParams.get("week_start");
  const weekStartYYYYMMDD =
    rawWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(rawWeekStart)
      ? toMondayYYYYMMDD(rawWeekStart)
      : toMondayYYYYMMDD(toYYYYMMDD(new Date()));

  if (!therapistId) {
    return NextResponse.json(
      { data: null, error: { message: "Missing therapistId (route param id)." } },
      { status: 400 }
    );
  }

  if (isDemoMode(request.url)) {
    return NextResponse.json({ data: getDemoTherapistCare(therapistId), error: null });
  }

  // 0) Therapist name + practice for header
  const { data: therapistRow, error: therapistErr } = await supabaseAdmin
    .from("therapists")
    .select("id, name, practice_id")
    .eq("id", therapistId)
    .single();

  if (therapistErr) {
    return NextResponse.json({ data: null, error: therapistErr }, { status: 500 });
  }

  const therapist_name = therapistRow?.name ?? null;
  const practiceId = (therapistRow?.practice_id as string | null) ?? null;

  const weekStartISO = startOfDayISO(weekStartYYYYMMDD);
  const weekEndISO = addDaysISO(weekStartYYYYMMDD, 7);

  // 1) Cases assigned to therapist (optionally scoped to practice)
  let casesQuery = supabaseAdmin
    .from("cases")
    .select("id")
    .eq("therapist_id", therapistId);

  if (practiceId) casesQuery = casesQuery.eq("practice_id", practiceId);

  const { data: casesRaw, error: casesError } = await casesQuery;

  if (casesError) {
    return NextResponse.json({ data: null, error: casesError }, { status: 500 });
  }

  const caseIds = (casesRaw ?? []).map((c: any) => c.id as string);

  if (caseIds.length === 0) {
    return NextResponse.json({
      data: {
        therapist_id: therapistId,
        therapist_name,
        week_start: weekStartYYYYMMDD,
        practice_id: practiceId,
        totals: {
          active_cases: 0,
          checkins: 0,
          avg_score: null,
          at_risk_checkins: 0,
          missing_checkins: 0,
        },
        cases: [],
      },
      error: null,
    });
  }

  // 2) Check-ins within bucket
  const { data: checkinsRaw, error: checkinsError } = await supabaseAdmin
    .from("checkins")
    .select("case_id, score, created_at")
    .in("case_id", caseIds)
    .gte("created_at", weekStartISO)
    .lt("created_at", weekEndISO);

  if (checkinsError) {
    return NextResponse.json({ data: null, error: checkinsError }, { status: 500 });
  }

  const checkins = checkinsRaw ?? [];

  const casesWithCheckins = new Set(checkins.map((c: any) => c.case_id as string));

  // Per-case aggregation (mirrors how the manager API aggregates per-practice)
  const perCase = new Map<string, {
    count: number;
    sum: number;
    scored: number;
    low: number;
    lowest: number | null;
    lastAt: string | null;
  }>();

  // Initialize all cases so missing-checkin cases appear in the table
  for (const cid of caseIds) {
    perCase.set(cid, { count: 0, sum: 0, scored: 0, low: 0, lowest: null, lastAt: null });
  }

  let totalCheckins = 0;
  let totalSum = 0;
  let totalScored = 0;
  let totalLow = 0;

  for (const ci of checkins as any[]) {
    const cid = ci.case_id as string;
    const score = typeof ci.score === "number" ? (ci.score as number) : null;
    const createdAt = (ci.created_at as string) ?? null;

    totalCheckins += 1;

    const bucket = perCase.get(cid);
    if (!bucket) continue;

    bucket.count += 1;

    if (score !== null) {
      bucket.sum += score;
      bucket.scored += 1;
      if (isScoreCritical(score)) bucket.low += 1;
      if (bucket.lowest === null || score < bucket.lowest) bucket.lowest = score;

      totalSum += score;
      totalScored += 1;
      if (isScoreCritical(score)) totalLow += 1;
    }

    if (createdAt) {
      if (!bucket.lastAt || new Date(createdAt).getTime() > new Date(bucket.lastAt).getTime()) {
        bucket.lastAt = createdAt;
      }
    }
  }

  // 3) Fetch case meta + patient names for ALL cases
  const { data: metaRows, error: metaErr } = await supabaseAdmin
    .from("cases")
    .select("id, title, patient_id")
    .in("id", caseIds);

  if (metaErr) {
    return NextResponse.json({ data: null, error: metaErr }, { status: 500 });
  }

  const metaById = new Map<string, { title: string | null; patient_id: string | null }>();
  const patientIds = new Set<string>();

  for (const r of (metaRows ?? []) as any[]) {
    metaById.set(r.id, { title: r.title ?? null, patient_id: r.patient_id ?? null });
    if (r.patient_id) patientIds.add(r.patient_id);
  }

  const patientById = new Map<string, { first_name: string | null }>();
  if (patientIds.size) {
    const { data: pRows, error: pErr } = await supabaseAdmin
      .from("patients")
      .select("id, first_name")
      .in("id", Array.from(patientIds));

    if (pErr) {
      return NextResponse.json({ data: null, error: pErr }, { status: 500 });
    }

    for (const p of (pRows ?? []) as any[]) {
      patientById.set(p.id, { first_name: p.first_name ?? null });
    }
  }

  // 4) Build per-patient cases table (mirrors manager's practicesTable)
  const casesTable = caseIds.map((case_id) => {
    const stats = perCase.get(case_id)!;
    const avg = stats.scored ? stats.sum / stats.scored : null;
    const meta = metaById.get(case_id);
    const pid = meta?.patient_id ?? null;
    const patient = pid ? patientById.get(pid) ?? null : null;

    return {
      case_id,
      case_title: meta?.title ?? null,
      patient_first_name: patient?.first_name ?? null,
      checkins: stats.count,
      avg_score: avg,
      lowest_score: stats.lowest,
      at_risk_checkins: stats.low,
      missing_checkin: !casesWithCheckins.has(case_id),
      last_checkin_at: stats.lastAt,
    };
  });

  // Sort: most at-risk first, then missing check-ins, then lowest avg score
  casesTable.sort((a, b) => {
    if (b.at_risk_checkins !== a.at_risk_checkins) return b.at_risk_checkins - a.at_risk_checkins;
    if (b.missing_checkin !== a.missing_checkin) return (b.missing_checkin ? 1 : 0) - (a.missing_checkin ? 1 : 0);
    return (a.avg_score ?? 999) - (b.avg_score ?? 999);
  });

  return NextResponse.json({
    data: {
      therapist_id: therapistId,
      therapist_name,
      week_start: weekStartYYYYMMDD,
      practice_id: practiceId,
      totals: {
        active_cases: caseIds.length,
        checkins: totalCheckins,
        avg_score: totalScored ? totalSum / totalScored : null,
        at_risk_checkins: totalLow,
        missing_checkins: caseIds.filter((id) => !casesWithCheckins.has(id)).length,
      },
      cases: casesTable,
    },
    error: null,
  });
}
