// app/api/patients/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, extended_profile")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing patient id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  // Core fields
  const coreUpdates: Record<string, string> = {};
  if (typeof body?.first_name === "string" && body.first_name.trim()) coreUpdates.first_name = body.first_name.trim();
  if (typeof body?.last_name === "string" && body.last_name.trim()) coreUpdates.last_name = body.last_name.trim();

  // Extended profile fields
  const extendedKeys = [
    "email", "phone", "date_of_birth",
    "primary_diagnosis", "secondary_diagnoses",
    "emergency_contact_name", "emergency_contact_phone",
    "insurance_provider", "clinical_notes",
    "session_notes", "activities",
  ];
  const hasExtended = extendedKeys.some((k) => k in body);

  if (Object.keys(coreUpdates).length === 0 && !hasExtended) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  let extendedProfile: Record<string, unknown> = {};
  if (hasExtended) {
    const { data: existing } = await supabase
      .from("patients")
      .select("extended_profile")
      .eq("id", id)
      .single();

    extendedProfile = (existing?.extended_profile as Record<string, unknown>) ?? {};

    for (const key of extendedKeys) {
      if (key in body) {
        if (body[key] === null || body[key] === "" || (Array.isArray(body[key]) && body[key].length === 0)) {
          delete extendedProfile[key];
        } else {
          extendedProfile[key] = body[key];
        }
      }
    }
  }

  const updates: Record<string, unknown> = { ...coreUpdates };
  if (hasExtended) updates.extended_profile = extendedProfile;

  const { data, error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", id)
    .select("id, first_name, last_name, extended_profile")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
