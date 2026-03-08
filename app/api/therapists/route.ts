// app/api/therapists/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoTherapists } from "@/lib/demo/demoData";
import { sanitizeError } from "@/lib/utils/sanitize-error";

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
  if (isDemoMode(request.url)) {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get("practice_id");
    const data = practiceId ? demoTherapists.filter(t => t.practice_id === practiceId) : demoTherapists;
    return NextResponse.json({ data, error: null });
  }

  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get("practice_id");

    const query = supabase
      .from("therapists")
      .select("id, name, practice_id, extended_profile")
      .order("name", { ascending: true });

    const { data, error } = practiceId ? await query.eq("practice_id", practiceId) : await query;

    if (error) {
      console.error("[/api/therapists]", sanitizeError(error));
      return NextResponse.json({ data: null, error: { message: "Internal server error" } }, { status: 500 });
    }
    return NextResponse.json({ data, error: null });
  } catch (e) {
    console.error("[/api/therapists]", sanitizeError(e));
    return NextResponse.json({ data: null, error: { message: "Internal server error" } }, { status: 500 });
  }
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

  if (error) {
    console.error("[/api/therapists] POST", sanitizeError(error));
    return NextResponse.json({ data: null, error: { message: "Internal server error" } }, { status: 500 });
  }
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

  if (cErr) {
    console.error("[/api/therapists] DELETE count check", sanitizeError(cErr));
    return NextResponse.json({ data: null, error: { message: "Internal server error" } }, { status: 500 });
  }

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
  if (dErr) {
    console.error("[/api/therapists] DELETE", sanitizeError(dErr));
    return NextResponse.json({ data: null, error: { message: "Internal server error" } }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted: true, id }, error: null });
}