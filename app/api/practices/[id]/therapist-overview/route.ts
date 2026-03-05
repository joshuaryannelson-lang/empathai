// app/api/practices/[id]/therapist-overview/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type TherapistRow = { id: string; name: string | null };
type CaseRow = { id: string; therapist_id: string | null };
type CheckinRow = { case_id: string; score: number | null };

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> } // keep Promise shape since your project is using it elsewhere
) {
  try {
    const { id: practiceId } = await ctx.params;

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start"); // expected YYYY-MM-DD (Monday bucket)

    if (!practiceId || !weekStart) {
      return NextResponse.json(
        { data: null, error: { message: "Missing practiceId or week_start" } },
        { status: 400 }
      );
    }

    // ✅ Practice existence check (your app uses "practices" in other routes)
    const practiceRes = await supabase
        .from("practice") // ✅ singular table name
        .select("id")
        .eq("id", practiceId)
        .single();

    if (practiceRes.error) {
      return NextResponse.json(
        { data: null, error: practiceRes.error },
        { status: 500 }
      );
    }

    if (!practiceRes.data) {
      return NextResponse.json(
        { data: null, error: { message: "Practice not found" } },
        { status: 404 }
      );
    }

    // 1) Therapists in practice
    const therapistsRes = await supabase
      .from("therapists")
      .select("id,name")
      .eq("practice_id", practiceId);

    if (therapistsRes.error) {
      return NextResponse.json(
        { data: null, error: therapistsRes.error },
        { status: 500 }
      );
    }

    const therapists = (therapistsRes.data ?? []) as TherapistRow[];
    if (therapists.length === 0) {
      return NextResponse.json({ data: [], error: null }, { status: 200 });
    }

    const therapistIds = therapists.map((t) => t.id);

    // 2) Cases in practice assigned to those therapists
    const casesRes = await supabase
      .from("cases")
      .select("id,therapist_id")
      .eq("practice_id", practiceId)
      .in("therapist_id", therapistIds);

    if (casesRes.error) {
      return NextResponse.json(
        { data: null, error: casesRes.error },
        { status: 500 }
      );
    }

    const cases = (casesRes.data ?? []) as CaseRow[];

    // Build therapist -> caseIds map
    const caseMap: Record<string, string[]> = {};
    for (const t of therapists) caseMap[t.id] = [];

    for (const c of cases) {
      if (c.therapist_id && caseMap[c.therapist_id]) {
        caseMap[c.therapist_id].push(c.id);
      }
    }

    // 3) Checkins for the selected week bucket (use week_start, NOT created_at)
    const allCaseIds = cases.map((c) => c.id);
    let checkins: CheckinRow[] = [];

    if (allCaseIds.length > 0) {
      const checkinsRes = await supabase
        .from("checkins")
        .select("case_id,score")
        .eq("week_start", weekStart)
        .in("case_id", allCaseIds);

      if (checkinsRes.error) {
        return NextResponse.json(
          { data: null, error: checkinsRes.error },
          { status: 500 }
        );
      }

      checkins = (checkinsRes.data ?? []) as CheckinRow[];
    }

    // Pre-index checkins by case
    const checkinsByCase: Record<string, number[]> = {};
    for (const ci of checkins) {
      if (!ci.case_id) continue;
      if (!checkinsByCase[ci.case_id]) checkinsByCase[ci.case_id] = [];
      if (typeof ci.score === "number") checkinsByCase[ci.case_id].push(ci.score);
    }

    const result = therapists.map((t) => {
      const caseIds = caseMap[t.id] ?? [];

      // all scores across all checkins for therapist this week
      const scores: number[] = [];
      const casesWithAnyCheckin = new Set<string>();

      // per-case min score for at-risk calculation (prevents double counting)
      const minScoreByCase: Record<string, number> = {};

      for (const caseId of caseIds) {
        const arr = checkinsByCase[caseId] ?? [];
        if (arr.length > 0) {
          casesWithAnyCheckin.add(caseId);
          for (const s of arr) scores.push(s);

          const min = Math.min(...arr);
          minScoreByCase[caseId] =
            minScoreByCase[caseId] === undefined
              ? min
              : Math.min(minScoreByCase[caseId], min);
        }
      }

      const avg =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      const missingCheckins = caseIds.filter((id) => !casesWithAnyCheckin.has(id)).length;

      const atRiskPatients = Object.values(minScoreByCase).filter((min) => min <= 3).length;

      return {
        therapist_id: t.id,
        therapist_name: t.name ?? "Unnamed therapist",
        active_cases: caseIds.length,
        avg_checkin_score: avg === null ? null : Math.round(avg * 10) / 10,
        missing_checkins: missingCheckins,
        at_risk_patients: atRiskPatients,
      };
    });

    return NextResponse.json({ data: result, error: null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: { message: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}