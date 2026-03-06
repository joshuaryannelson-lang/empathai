// app/api/cases/[id]/context/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCase, getDemoPatient, getDemoTherapist, demoPractice } from "@/lib/demo/demoData";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;

  if (!caseId) {
    return NextResponse.json({ data: null, error: "Missing caseId" }, { status: 400 });
  }

  if (isDemoMode(_.url)) {
    const c = getDemoCase(caseId);
    if (!c) return NextResponse.json({ data: null, error: "Case not found" }, { status: 404 });
    const patient = getDemoPatient(c.patient_id);
    const therapist = getDemoTherapist(c.therapist_id);
    return NextResponse.json({
      data: {
        case: { id: c.id, title: c.title, status: c.status },
        practice: { id: demoPractice.id, name: demoPractice.name },
        therapist: therapist ? { id: therapist.id, name: therapist.name, extended_profile: therapist.extended_profile } : null,
        patient: patient ? { id: patient.id, first_name: patient.first_name, extended_profile: {} } : null,
      },
      error: null,
    });
  }

  // Case
  const { data: c, error: cErr } = await supabase
    .from("cases")
    .select("id, title, status, practice_id, therapist_id")
    .eq("id", caseId)
    .single();

  if (cErr) return NextResponse.json({ data: null, error: cErr }, { status: 500 });
  if (!c) return NextResponse.json({ data: null, error: "Case not found" }, { status: 404 });

  // Practice (optional name)
  // Guard in case practice_id is missing (if your schema allows it)
  let practice: { id: string; name: string | null } | null = null;
  if ((c as any).practice_id) {
    const { data: p } = await supabase
      .from("practice")
      .select("id, name")
      .eq("id", (c as any).practice_id)
      .single();

    practice = p ? { id: p.id, name: (p as any).name ?? null } : { id: (c as any).practice_id, name: null };
  }

  // Therapist (optional)
  const therapistId = (c as any).therapist_id as string | null;
  const patientId = (c as any).patient_id as string | null;
  const [{ data: t }, { data: pat }] = await Promise.all([
    therapistId
      ? supabase.from("therapists").select("id, name, extended_profile").eq("id", therapistId).single()
      : Promise.resolve({ data: null } as any),
    patientId
      ? supabase.from("patients").select("id, first_name, extended_profile").eq("id", patientId).single()
      : Promise.resolve({ data: null } as any),
  ]);

  return NextResponse.json({
    data: {
      case: {
        id: (c as any).id,
        title: (c as any).title ?? null,
        status: (c as any).status ?? null,
      },
      practice: practice ?? { id: (c as any).practice_id ?? null, name: null },
      therapist: t ? { id: (t as any).id, name: (t as any).name ?? null, extended_profile: (t as any).extended_profile ?? {} } : null,
      patient: pat ? { id: (pat as any).id, first_name: (pat as any).first_name ?? null, extended_profile: (pat as any).extended_profile ?? {} } : null,
    },
    error: null,
  });
}