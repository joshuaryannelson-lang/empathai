// app/api/checkins/seed/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function addDaysISO(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/**
 * POST /api/checkins/seed
 * body: {
 *   case_ids: string[],
 *   week_start: string, // YYYY-MM-DD (Monday)
 *   per_case?: number,  // default 1
 *   min_score?: number, // default 1
 *   max_score?: number  // default 10
 * }
 */
export async function POST(request: Request) {
  const body = await safeJson(request);

  const caseIds: string[] = Array.isArray(body?.case_ids) ? body.case_ids : [];
  const weekStart: string = typeof body?.week_start === "string" ? body.week_start : "";
  const perCase = typeof body?.per_case === "number" ? body.per_case : 1;
  const minScore = typeof body?.min_score === "number" ? body.min_score : 1;
  const maxScore = typeof body?.max_score === "number" ? body.max_score : 10;

  if (!caseIds.length) {
    return NextResponse.json({ data: null, error: "Missing case_ids" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ data: null, error: "Invalid week_start" }, { status: 400 });
  }

  const weekEndISO = addDaysISO(weekStart, 7);

  const inserts: any[] = [];
  for (const caseId of caseIds) {
    for (let i = 0; i < perCase; i++) {
      const dayOffset = randInt(0, 6);
      const created_at = addDaysISO(weekStart, dayOffset);
      // keep it within the window
      const createdISO = new Date(created_at);
      if (createdISO >= new Date(weekEndISO)) continue;

      inserts.push({
        case_id: caseId,
        score: randInt(minScore, maxScore),
        created_at: createdISO.toISOString(),
      });
    }
  }

  const { data, error } = await supabase.from("checkins").insert(inserts).select("case_id, score, created_at");
  if (error) return NextResponse.json({ data: null, error }, { status: 500 });

  return NextResponse.json({ data, error: null }, { status: 201 });
}