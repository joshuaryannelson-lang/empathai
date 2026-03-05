// app/api/ths/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { toMondayISO } from "@/lib/week";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const caseId = searchParams.get("case_id") ?? "";
    const rawWeekStart = searchParams.get("week_start") ?? "";

    if (!caseId) {
      return NextResponse.json(
        { data: null, error: { message: "case_id is required" } },
        { status: 400 }
      );
    }

    if (!rawWeekStart) {
      return NextResponse.json(
        { data: null, error: { message: "week_start is required" } },
        { status: 400 }
      );
    }

    // Normalize whatever user gives (03/03) into Monday bucket (03/02)
    const weekStart = toMondayISO(rawWeekStart);

    // Pull checkin for that Monday bucket
    const { data: checkin, error: checkinErr } = await supabaseAdmin
      .from("checkins")
      .select("score")
      .eq("case_id", caseId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (checkinErr) {
      return NextResponse.json(
        { data: null, error: checkinErr },
        { status: 400 }
      );
    }

    // Count active goals
    const { count: activeGoalsCount, error: goalsErr } = await supabaseAdmin
      .from("goals")
      .select("*", { count: "exact", head: true })
      .eq("case_id", caseId)
      .eq("status", "active");

    if (goalsErr) {
      return NextResponse.json(
        { data: null, error: goalsErr },
        { status: 400 }
      );
    }

    const payload = {
      case_id: caseId,
      week_start: weekStart,
      score: checkin?.score ?? null,
      drivers: {
        checkin_score: checkin?.score ?? null,
        active_goals_count: activeGoalsCount ?? 0,
      },
    };

    return NextResponse.json({ data: payload, error: null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: { message: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}