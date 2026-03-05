// app/api/admin/stats/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoCases, demoTherapists, demoCheckins } from "@/lib/demo/demoData";

export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return NextResponse.json({
      data: {
        practices: 1,
        therapists: demoTherapists.length,
        cases: demoCases.length,
        checkins: demoCheckins.length,
        unassigned_cases: 0,
      },
      error: null,
    });
  }

  // If your table names differ, adjust them here.
  const [p, t, c, ci] = await Promise.all([
    supabase.from("practice").select("id", { count: "exact", head: true }),
    supabase.from("therapists").select("id", { count: "exact", head: true }),
    supabase.from("cases").select("id, therapist_id", { count: "exact" }),
    supabase.from("checkins").select("id", { count: "exact", head: true }),
  ]);

  if (p.error) return NextResponse.json({ data: null, error: p.error }, { status: 500 });
  if (t.error) return NextResponse.json({ data: null, error: t.error }, { status: 500 });
  if (c.error) return NextResponse.json({ data: null, error: c.error }, { status: 500 });
  if (ci.error) return NextResponse.json({ data: null, error: ci.error }, { status: 500 });

  const cases = c.data ?? [];
  const unassigned = cases.reduce((sum, row: any) => sum + (row.therapist_id ? 0 : 1), 0);

  return NextResponse.json({
    data: {
      practices: p.count ?? 0,
      therapists: t.count ?? 0,
      cases: c.count ?? cases.length ?? 0,
      checkins: ci.count ?? 0,
      unassigned_cases: unassigned,
    },
    error: null,
  });
}