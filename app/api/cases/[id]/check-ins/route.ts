// app/api/cases/[id]/checkins/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { toMondayISO } from "@/lib/week";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: caseId } = await ctx.params;

    if (!caseId) {
      return NextResponse.json({ data: null, error: "Missing case id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const weekStartRaw = body.week_start;
    const score = body.score;
    const notes = body.notes ?? null;

    if (!weekStartRaw) {
      return NextResponse.json({ data: null, error: "Missing week_start" }, { status: 400 });
    }

    if (score !== undefined && score !== null) {
      if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 10) {
        return NextResponse.json({ data: null, error: "score must be an integer between 1 and 10" }, { status: 400 });
      }
    }

    const weekStart = toMondayISO(String(weekStartRaw));

    const { data, error } = await supabaseAdmin
      .from("checkins")
      .insert({
        case_id: caseId,
        week_start: weekStart,
        score: score ?? null,
        notes,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 400 });
    }

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: { message: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: caseId } = await ctx.params;

    if (!caseId) {
      return NextResponse.json({ data: null, error: "Missing case id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("checkins")
      .select("*")
      .eq("case_id", caseId)
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 400 });
    }

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: { message: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}