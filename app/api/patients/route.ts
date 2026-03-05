// app/api/patients/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const first_name = typeof body?.first_name === "string" ? body.first_name.trim() : "";
  const last_name = typeof body?.last_name === "string" ? body.last_name.trim() : "";
  if (!first_name && !last_name) {
    return NextResponse.json({ data: null, error: "first_name or last_name is required" }, { status: 400 });
  }

  const extended_profile: Record<string, string> = {};
  if (typeof body?.date_of_birth === "string" && body.date_of_birth) extended_profile.date_of_birth = body.date_of_birth;
  if (typeof body?.email === "string" && body.email) extended_profile.email = body.email;
  if (typeof body?.phone === "string" && body.phone) extended_profile.phone = body.phone;

  const practice_id = typeof body?.practice_id === "string" && body.practice_id ? body.practice_id : null;
  const therapist_id = typeof body?.therapist_id === "string" && body.therapist_id ? body.therapist_id : null;

  const { data, error } = await supabase
    .from("patients")
    .insert({
      first_name: first_name || null,
      last_name: last_name || null,
      ...(Object.keys(extended_profile).length > 0 ? { extended_profile } : {}),
    })
    .select("id, first_name, last_name")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });

  // If a practice was selected, create a case for the patient.
  if (practice_id) {
    // Resolve program_id from an existing case in this practice
    const { data: existingCase } = await supabase
      .from("cases")
      .select("program_id")
      .eq("practice_id", practice_id)
      .not("program_id", "is", null)
      .limit(1)
      .single();

    const program_id = existingCase?.program_id ?? null;
    if (program_id) {
      await supabase.from("cases").insert({
        patient_id: data.id,
        practice_id,
        program_id,
        therapist_id: therapist_id,
        status: "active",
        title: "Case",
      });
    }
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}

/**
 * GET /api/patients
 * Returns all patients joined with their most recent case (practice, therapist, status).
 */
export async function GET() {
  // Load all patients
  const { data: patients, error: patientsErr } = await supabase
    .from("patients")
    .select("id, first_name, last_name, extended_profile")
    .order("last_name", { ascending: true });

  if (patientsErr) return NextResponse.json({ data: null, error: patientsErr }, { status: 500 });

  const patientIds = (patients ?? []).map((p) => p.id).filter(Boolean) as string[];

  // Load most recent case per patient (for practice/therapist/status context)
  const { data: cases } = await supabase
    .from("cases")
    .select("id, patient_id, practice_id, therapist_id, status, created_at")
    .in("patient_id", patientIds.length ? patientIds : [""])
    .order("created_at", { ascending: false });

  // Build most-recent-case map per patient
  const caseMap = new Map<string, typeof cases extends (infer T)[] | null ? T : never>();
  for (const c of cases ?? []) {
    if (c.patient_id && !caseMap.has(c.patient_id)) caseMap.set(c.patient_id, c);
  }

  const practiceIds = [...new Set([...caseMap.values()].map((c) => c.practice_id).filter(Boolean))] as string[];
  const therapistIds = [...new Set([...caseMap.values()].map((c) => c.therapist_id).filter(Boolean))] as string[];

  const [{ data: practices }, { data: therapists }] = await Promise.all([
    practiceIds.length
      ? supabase.from("practice").select("id, name").in("id", practiceIds)
      : Promise.resolve({ data: [] }),
    therapistIds.length
      ? supabase.from("therapists").select("id, name").in("id", therapistIds)
      : Promise.resolve({ data: [] }),
  ]);

  const practiceMap = new Map((practices ?? []).map((p) => [p.id, p]));
  const therapistMap = new Map((therapists ?? []).map((t) => [t.id, t]));

  const rows = (patients ?? []).map((patient) => {
    const c = caseMap.get(patient.id);
    const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || null;
    return {
      id: patient.id,
      name,
      case_id: c?.id ?? null,
      practice_id: c?.practice_id ?? null,
      practice_name: c ? (practiceMap.get(c.practice_id)?.name ?? null) : null,
      therapist_id: c?.therapist_id ?? null,
      therapist_name: c ? (therapistMap.get(c.therapist_id ?? "")?.name ?? null) : null,
      status: c?.status ?? "active",
      extended_profile: patient.extended_profile ?? {},
    };
  });

  return NextResponse.json({ data: rows, error: null });
}
