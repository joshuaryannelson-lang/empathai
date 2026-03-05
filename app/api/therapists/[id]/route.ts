import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("therapists")
    .select("id, name, practice_id, extended_profile")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ data: null, error }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing therapist id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  // Core fields
  const coreUpdates: Record<string, string> = {};
  if (typeof body?.name === "string" && body.name.trim()) coreUpdates.name = body.name.trim();
  if (typeof body?.practice_id === "string" && body.practice_id.trim()) coreUpdates.practice_id = body.practice_id.trim();

  // Extended profile fields — read current, merge, write back
  const extendedKeys = ["email", "phone", "license_type", "license_state", "license_number", "license_expiry", "certifications", "therapy_modalities", "specializations", "training_notes", "bio"];
  const hasExtended = extendedKeys.some((k) => k in body);

  if (Object.keys(coreUpdates).length === 0 && !hasExtended) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Merge extended profile if any extended fields were sent
  let extendedProfile: Record<string, unknown> = {};
  if (hasExtended) {
    const { data: existing } = await supabase
      .from("therapists")
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
    .from("therapists")
    .update(updates)
    .eq("id", id)
    .select("id, name, practice_id, extended_profile")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
