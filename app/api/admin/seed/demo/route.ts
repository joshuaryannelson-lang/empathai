// app/api/admin/seed/demo/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireRole, isAuthError, logUnauthorizedAccess, getClientIp } from "@/lib/apiAuth";

function toMondayISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Deterministic pseudo-random (so repeated calls produce stable data)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Realistic score distribution: mostly 5–9, ~15% low (2–4)
function realisticScore(rng: () => number): number {
  const r = rng();
  if (r < 0.08) return 2;
  if (r < 0.18) return 3;
  if (r < 0.30) return 4;
  if (r < 0.48) return 5;
  if (r < 0.65) return 6;
  if (r < 0.80) return 7;
  if (r < 0.90) return 8;
  return 9;
}

/**
 * POST /api/admin/seed/demo
 * Seeds realistic check-in data for all practices for the current week.
 * Idempotent: upserts based on (case_id, week_start).
 *
 * Optional body: { week_start?: "YYYY-MM-DD" }
 */
export async function POST(req: Request) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) {
    await logUnauthorizedAccess("/api/admin/seed/demo", null, getClientIp(req));
    return auth;
  }

  try {
    let weekStart: string;
    try {
      const body = await req.json();
      weekStart = body?.week_start ?? "";
    } catch {
      weekStart = "";
    }
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      weekStart = toMondayISO(new Date().toISOString().slice(0, 10));
    } else {
      weekStart = toMondayISO(weekStart);
    }

    // 1) Get all cases (active)
    const { data: cases, error: cErr } = await supabase
      .from("cases")
      .select("id, practice_id, therapist_id");

    if (cErr) return NextResponse.json({ data: null, error: cErr }, { status: 500 });
    if (!cases?.length) {
      return NextResponse.json({ data: { seeded: 0, week_start: weekStart, message: "No cases found to seed." }, error: null });
    }

    // 2) Check which cases already have a check-in this week
    const caseIds = cases.map(c => c.id);
    const { data: existing } = await supabase
      .from("checkins")
      .select("case_id")
      .eq("week_start", weekStart)
      .in("case_id", caseIds);

    const alreadySeeded = new Set((existing ?? []).map(e => e.case_id));
    const toSeed = cases.filter(c => !alreadySeeded.has(c.id));

    if (toSeed.length === 0) {
      return NextResponse.json({
        data: { seeded: 0, skipped: cases.length, week_start: weekStart, message: "All cases already have check-ins this week." },
        error: null,
      });
    }

    // 3) Generate check-ins
    const inserts: any[] = [];
    for (const c of toSeed) {
      const rng = mulberry32(hashStr(`${c.id}-${weekStart}`));
      inserts.push({
        case_id: c.id,
        score: realisticScore(rng),
        week_start: weekStart,
        created_at: new Date(`${weekStart}T09:00:00.000Z`).toISOString(),
      });
    }

    const { data: inserted, error: iErr } = await supabase
      .from("checkins")
      .insert(inserts)
      .select("case_id, score");

    if (iErr) return NextResponse.json({ data: null, error: iErr }, { status: 500 });

    return NextResponse.json({
      data: {
        seeded: inserted?.length ?? 0,
        skipped: alreadySeeded.size,
        week_start: weekStart,
        message: `Seeded ${inserted?.length ?? 0} check-ins for week of ${weekStart}.`,
      },
      error: null,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: { message: e?.message ?? String(e) } }, { status: 500 });
  }
}
