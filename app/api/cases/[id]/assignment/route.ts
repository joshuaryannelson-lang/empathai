// app/api/cases/[id]/assign/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { data: null, error: { message: "Missing case id" } },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const therapist_id = body?.therapist_id;

  if (!therapist_id) {
    return NextResponse.json(
      { data: null, error: { message: "Missing therapist_id" } },
      { status: 400 }
    );
  }

  // NOTE: If your table is named "cases" instead of "case", change it below.
  const { data, error } = await supabaseAdmin
    .from("cases")
    .update({ therapist_id })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ data: null, error }, { status: 400 });
  }

  return NextResponse.json({ data, error: null });
}