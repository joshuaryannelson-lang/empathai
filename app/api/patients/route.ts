// app/api/patients/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoPatients } from "@/lib/demo/demoData";
import { requireRole, isAuthError } from "@/lib/apiAuth";
import { bad } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const PHI_KEYS = new Set(["email", "phone", "date_of_birth"]);
function stripPhi(ep: unknown): Record<string, unknown> {
  if (!ep || typeof ep !== "object") return {};
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ep as Record<string, unknown>)) {
    if (!PHI_KEYS.has(k)) clean[k] = v;
  }
  return clean;
}

// PII fields that must be rejected in POST body (GAP-34)
const REJECTED_PII_FIELDS = ["last_name", "dob", "date_of_birth", "email", "phone"];

export async function POST(request: Request) {
  // ── Auth guard: admin, manager, or therapist only (GAP-34) ──
  const auth = await requireRole("admin", "manager", "therapist");
  if (isAuthError(auth)) return auth;

  if (isDemoMode(request.url)) {
    return NextResponse.json({ data: null, error: "Demo mode — changes are disabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  // Reject any PII fields in the request body (GAP-34)
  if (body && typeof body === "object") {
    for (const field of REJECTED_PII_FIELDS) {
      if (field in body && body[field] !== undefined && body[field] !== null && body[field] !== "") {
        return bad(`pii_field_rejected`, 422);
      }
    }
  }

  const first_name = typeof body?.first_name === "string" ? body.first_name.trim() : "";
  if (!first_name) {
    return NextResponse.json({ data: null, error: "first_name is required" }, { status: 400 });
  }

  const extended_profile: Record<string, string> = {};
  // PHI fields (email, phone, date_of_birth) removed — GAP-06

  const practice_id = typeof body?.practice_id === "string" && body.practice_id ? body.practice_id : null;
  const therapist_id = typeof body?.therapist_id === "string" && body.therapist_id ? body.therapist_id : null;

  const { data, error } = await supabase
    .from("patients")
    .insert({
      first_name: first_name || null,
      ...(Object.keys(extended_profile).length > 0 ? { extended_profile } : {}),
    })
    .select("id, first_name")
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
export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return NextResponse.json({
      data: demoPatients.map(p => ({
        id: p.id,
        first_name: p.first_name,
        case_id: null,
        practice_id: null,
        practice_name: null,
        therapist_id: null,
        therapist_name: null,
        status: "active",
        extended_profile: {},
      })),
      error: null,
    });
  }

  // Load all patients
  const { data: patients, error: patientsErr } = await supabase
    .from("patients")
    .select("id, first_name, extended_profile")
    .order("first_name", { ascending: true });

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
    return {
      id: patient.id,
      first_name: patient.first_name ?? null,
      case_id: c?.id ?? null,
      practice_id: c?.practice_id ?? null,
      practice_name: c ? (practiceMap.get(c.practice_id)?.name ?? null) : null,
      therapist_id: c?.therapist_id ?? null,
      therapist_name: c ? (therapistMap.get(c.therapist_id ?? "")?.name ?? null) : null,
      status: c?.status ?? "active",
      extended_profile: stripPhi(patient.extended_profile),
    };
  });

  return NextResponse.json({ data: rows, error: null });
}
