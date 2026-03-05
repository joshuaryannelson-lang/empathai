/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ data: null, error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const { first_name, last_name, dob } = body ?? {};
  if (!first_name || !last_name || !dob) {
    return NextResponse.json(
      { data: null, error: { message: "first_name, last_name, and dob are required" } },
      { status: 400 }
    );
  }

  // Fetch patients matching first + last name (case-insensitive)
  const { data: patients, error } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, last_name, extended_profile")
    .ilike("first_name", first_name.trim())
    .ilike("last_name", last_name.trim());

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });

  // Filter by DOB stored in extended_profile.date_of_birth
  const match = (patients ?? []).find((p) => {
    const stored = (p.extended_profile as any)?.date_of_birth;
    return stored === dob;
  });

  if (!match) {
    return NextResponse.json(
      { data: null, error: { message: "No patient found with those details. Please double-check your name and date of birth." } },
      { status: 404 }
    );
  }

  // Find their most recent case
  const { data: caseRow, error: caseErr } = await supabaseAdmin
    .from("cases")
    .select("id, title, status")
    .eq("patient_id", match.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (caseErr || !caseRow) {
    return NextResponse.json(
      { data: null, error: { message: "No active case found for this patient." } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      patient_id: match.id,
      patient_name: `${match.first_name} ${match.last_name}`.trim(),
      case_id: caseRow.id,
    },
    error: null,
  });
}
