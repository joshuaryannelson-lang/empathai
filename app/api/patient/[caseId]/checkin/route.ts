/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
// SERVICE ROLE: justified — patient-facing unauthenticated check-in flow
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await ctx.params;
  if (!caseId) {
    return NextResponse.json({ data: null, error: { message: "case id required" } }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ data: null, error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const { score, mood, note } = body ?? {};

  if (score == null || typeof score !== "number" || score < 1 || score > 10) {
    return NextResponse.json(
      { data: null, error: { message: "score must be a number between 1 and 10" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("checkins")
    .insert({ case_id: caseId, score, mood: mood ?? null, note: note ?? null })
    .select("id, case_id, score, mood, created_at, note")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
