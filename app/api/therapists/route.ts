// app/api/therapists/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

/**
 * GET    /api/therapists?practice_id=...
 * POST   /api/therapists  { practice_id: string, name?: string }
 * DELETE /api/therapists  { id: string }
 *
 * Safety:
 * - DELETE refuses if the therapist still has cases assigned (returns 409)
 */

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const practiceId = searchParams.get("practice_id");

  const query = supabase
    .from("therapists")
    .select("id, name, practice_id, extended_profile")
    .order("name", { ascending: true });

  const { data, error } = practiceId ? await query.eq("practice_id", practiceId) : await query;

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(request: Request) {
  const body = await safeJson(request);
  const practiceId = typeof body?.practice_id === "string" ? body.practice_id.trim() : "";
  const rawName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!practiceId) {
    return NextResponse.json({ data: null, error: "Missing practice_id" }, { status: 400 });
  }

  const name = rawName.length ? rawName : "Unnamed therapist";

  const { data, error } = await supabase
    .from("therapists")
    .insert({ practice_id: practiceId, name })
    .select("id, name, practice_id")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function DELETE(request: Request) {
  const body = await safeJson(request);
  const id = typeof body?.id === "string" ? body.id.trim() : "";

  if (!id) return NextResponse.json({ data: null, error: "Missing id" }, { status: 400 });

  // Safety: refuse if therapist has cases assigned
  const { count, error: cErr } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("therapist_id", id);

  if (cErr) return NextResponse.json({ data: null, error: cErr }, { status: 500 });

  const caseCount = count ?? 0;
  if (caseCount > 0) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: "Refusing to delete: therapist still has assigned cases.",
          cases: caseCount,
        },
      },
      { status: 409 }
    );
  }

  const { error: dErr } = await supabase.from("therapists").delete().eq("id", id);
  if (dErr) return NextResponse.json({ data: null, error: dErr }, { status: 500 });

  return NextResponse.json({ data: { deleted: true, id }, error: null });
}