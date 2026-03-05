
// FILE: app/api/cases/[id]/timeline/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve((ctx as any).params);
  const caseId = resolvedParams?.id as string | undefined;

  if (!caseId) {
    return NextResponse.json(
      { data: null, error: { message: "case id required" } },
      { status: 400 }
    );
  }

  // 1) Load the case (to get patient_id / therapist_id / title)
  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, status, created_at, practice_id, therapist_id, patient_id")
    .eq("id", caseId)
    .single();

  if (caseErr) return NextResponse.json({ data: null, error: caseErr }, { status: 500 });
  if (!caseRow) return NextResponse.json({ data: null, error: { message: "case not found" } }, { status: 404 });

  // 2) Load patient + therapist (optional, but makes the UI demo-ready)
  const patientId = caseRow.patient_id as string | null;
  const therapistId = caseRow.therapist_id as string | null;

  const [{ data: patientRow, error: patientErr }, { data: therapistRow, error: therapistErr }] =
    await Promise.all([
      patientId
        ? supabase.from("patients").select("id, first_name, last_name, extended_profile").eq("id", patientId).single()
        : Promise.resolve({ data: null, error: null } as any),
      therapistId
        ? supabase.from("therapists").select("id, name, extended_profile").eq("id", therapistId).single()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

  if (patientErr) return NextResponse.json({ data: null, error: patientErr }, { status: 500 });
  if (therapistErr) return NextResponse.json({ data: null, error: therapistErr }, { status: 500 });

  // 3) Load last N check-ins (this is your “timeline”)
  const { data: checkins, error: ciErr } = await supabase
    .from("checkins")
    .select("id, case_id, score, mood, created_at, note, notes")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(14);

  if (ciErr) return NextResponse.json({ data: null, error: ciErr }, { status: 500 });

  return NextResponse.json({
    data: {
      case: caseRow,
      patient: patientRow ?? null,
      therapist: therapistRow ?? null,
      checkins: checkins ?? [],
    },
    error: null,
  });
}