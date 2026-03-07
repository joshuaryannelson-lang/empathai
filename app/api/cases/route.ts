// FILE: app/api/cases/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { BUCKET } from "@/lib/constants";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoNormalizedCases } from "@/lib/demo/demoData";
import { resolveDemoTherapistId } from "@/lib/demo/demoIds";


export const dynamic = "force-dynamic";

type CaseRow = {
  id: string;
  practice_id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  therapist_id: string | null;
  patient_id: string | null;
  case_code: string | null;
};

type TherapistRow = { id: string; name: string | null };
type PatientRow = { id: string; first_name: string | null; case_code?: string | null };
type CheckinRow = { id: string; case_id: string; score: number | null; created_at: string };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (isDemoMode(req.url)) {
    const practiceId = searchParams.get("practice_id") ?? undefined;
    const therapistId = searchParams.get("therapist_id") ?? undefined;
    const data = getDemoNormalizedCases(practiceId, therapistId);
    return NextResponse.json({ data, error: null, total: data.length, page: 1, limit: 50 });
  }

  const practiceId = searchParams.get("practice_id");
  const rawTherapistId = searchParams.get("therapist_id");
  const therapistId = rawTherapistId ? resolveDemoTherapistId(rawTherapistId) : null;
  const bucket = searchParams.get("bucket"); // "low_scores" | "missing_checkins" | ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
  const offset = (page - 1) * limit;

  if (!practiceId) {
    return NextResponse.json(
      { data: null, error: { message: "practice_id required" } },
      { status: 400 }
    );
  }

  // 1) Load cases (minimal)
  let casesQuery = supabase
    .from("cases")
    .select("id, practice_id, title, status, created_at, therapist_id, patient_id, case_code", { count: "exact" })
    .eq("practice_id", practiceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (therapistId) casesQuery = casesQuery.eq("therapist_id", therapistId);

  const unassigned = searchParams.get("unassigned");
  if (unassigned === "true") casesQuery = (casesQuery as any).is("therapist_id", null);

  const { data: casesData, error: casesErr, count: totalCount } = await casesQuery;
  if (casesErr) return NextResponse.json({ data: null, error: casesErr }, { status: 500 });

  const cases = (casesData ?? []) as CaseRow[];
  if (cases.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  const caseIds = cases.map((c) => c.id);

  const therapistIds = Array.from(
    new Set(cases.map((c) => c.therapist_id).filter((x): x is string => !!x))
  );

  const patientIds = Array.from(
    new Set(cases.map((c) => c.patient_id).filter((x): x is string => !!x))
  );

  // 2) Load therapists (id -> name)
  const therapistById = new Map<string, TherapistRow>();
  if (therapistIds.length) {
    const { data: tData, error: tErr } = await supabase
      .from("therapists")
      .select("id, name")
      .in("id", therapistIds);

    if (tErr) return NextResponse.json({ data: null, error: tErr }, { status: 500 });

    for (const t of (tData ?? []) as TherapistRow[]) therapistById.set(t.id, t);
  }

  // 3) Load patients (id -> first/last)
  const patientById = new Map<string, PatientRow>();
  if (patientIds.length) {
    const { data: pData, error: pErr } = await supabase
      .from("patients")
      .select("id, first_name")
      .in("id", patientIds);

    if (pErr) return NextResponse.json({ data: null, error: pErr }, { status: 500 });

    for (const p of (pData ?? []) as PatientRow[]) patientById.set(p.id, p);
  }

  // 4) Load checkins for these cases and compute "latest per case"
  // Use a 90-day window to avoid loading unbounded history. Cases with no check-in
  // in 90 days will correctly surface as "missing_checkins".
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const latestCheckinByCase = new Map<string, CheckinRow>();
  {
    const { data: ciData, error: ciErr } = await supabase
      .from("checkins")
      .select("id, case_id, score, created_at")
      .in("case_id", caseIds)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false });

    if (ciErr) return NextResponse.json({ data: null, error: ciErr }, { status: 500 });

    for (const ci of (ciData ?? []) as CheckinRow[]) {
      // because we sorted DESC, the first one we see per case_id is the latest
      if (!latestCheckinByCase.has(ci.case_id)) latestCheckinByCase.set(ci.case_id, ci);
    }
  }

  // 5) Normalize
  let normalized = cases.map((c) => {
    const t = c.therapist_id ? therapistById.get(c.therapist_id) ?? null : null;
    const p = c.patient_id ? patientById.get(c.patient_id) ?? null : null;
    const latest = latestCheckinByCase.get(c.id) ?? null;

    return {
      id: c.id,
      title: c.title ?? "Case",
      status: c.status ?? "active",
      created_at: c.created_at,
      practice_id: c.practice_id,
      therapist_id: c.therapist_id,
      patient_id: c.patient_id,

      therapist_name: t?.name ?? null,
      patient_first_name: p?.first_name ?? null,
      case_code: c.case_code ?? null,

      latest_score: latest?.score ?? null,
      latest_checkin: latest?.created_at ?? null,
    };
  });

  // 6) Optional bucket filters
  if (bucket === BUCKET.LOW_SCORES) {
    normalized = normalized.filter((c) => c.latest_score !== null && c.latest_score <= 3);
  } else if (bucket === BUCKET.MISSING_CHECKINS) {
    normalized = normalized.filter((c) => !c.latest_checkin);
  }

  return NextResponse.json({ data: normalized, error: null, total: totalCount ?? normalized.length, page, limit });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const patient_id = typeof body?.patient_id === "string" ? body.patient_id.trim() : "";
  const practice_id = typeof body?.practice_id === "string" ? body.practice_id.trim() : "";
  const therapist_id = typeof body?.therapist_id === "string" ? body.therapist_id.trim() : null;

  if (!patient_id || !practice_id) {
    return NextResponse.json({ data: null, error: "patient_id and practice_id are required" }, { status: 400 });
  }

  // Resolve program_id from an existing case in this practice
  const { data: existingCase } = await supabase
    .from("cases")
    .select("program_id")
    .eq("practice_id", practice_id)
    .not("program_id", "is", null)
    .limit(1)
    .single();

  const program_id = existingCase?.program_id ?? null;
  if (!program_id) {
    return NextResponse.json({ data: null, error: "No program found for this practice — cannot create case" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({ patient_id, practice_id, program_id, therapist_id: therapist_id || null, status: "active", title: "Case" })
    .select("id, patient_id, practice_id, therapist_id, status")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}