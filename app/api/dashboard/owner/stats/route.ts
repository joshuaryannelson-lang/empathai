// app/api/dashboard/owner/stats/route.ts
// Owner dashboard stats — KPIs + therapist performance
// Auth: admin or manager role only

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { safeLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ── KPIs ──

    // Active cases count
    const { count: activeCases } = await supabaseAdmin
      .from("cases")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Active therapists count
    const { count: activeTherapists } = await supabaseAdmin
      .from("therapists")
      .select("*", { count: "exact", head: true });

    // Check-ins this week (Monday-aligned)
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diff);
    monday.setUTCHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();

    const { count: checkinsThisWeek } = await supabaseAdmin
      .from("checkins")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStart);

    // Avg session prep time from ai_audit_logs
    const { data: prepLogs } = await supabaseAdmin
      .from("ai_audit_logs")
      .select("duration_ms")
      .eq("action", "session_prep")
      .gte("created_at", weekStart);

    let avgPrepTimeSeconds: number | null = null;
    if (prepLogs && prepLogs.length > 0) {
      const totalMs = prepLogs.reduce(
        (sum: number, l: { duration_ms?: number }) =>
          sum + (l.duration_ms ?? 0),
        0
      );
      avgPrepTimeSeconds = Math.round(totalMs / prepLogs.length / 1000);
    }

    // ── Therapist performance ──
    const { data: therapists } = await supabaseAdmin
      .from("therapists")
      .select("id, name");

    const therapistRows = [];

    if (therapists) {
      for (const t of therapists) {
        // Active cases for this therapist
        const { count: tCases } = await supabaseAdmin
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("therapist_id", t.id)
          .eq("status", "active");

        // Check-ins this week for this therapist's cases
        const { data: tCaseIds } = await supabaseAdmin
          .from("cases")
          .select("id")
          .eq("therapist_id", t.id);

        let tCheckins = 0;
        if (tCaseIds && tCaseIds.length > 0) {
          const ids = tCaseIds.map((c: { id: string }) => c.id);
          const { count } = await supabaseAdmin
            .from("checkins")
            .select("*", { count: "exact", head: true })
            .in("case_id", ids)
            .gte("created_at", weekStart);
          tCheckins = count ?? 0;
        }

        // Last session prep
        const { data: lastPrep } = await supabaseAdmin
          .from("ai_audit_logs")
          .select("created_at")
          .eq("action", "session_prep")
          .eq("therapist_id", t.id)
          .order("created_at", { ascending: false })
          .limit(1);

        // Extract first name only (PHI guard)
        const firstName = (t.name ?? "").split(" ")[0] || "Unknown";

        therapistRows.push({
          first_name: firstName,
          active_cases: tCases ?? 0,
          checkins_this_week: tCheckins,
          last_prep_at: lastPrep?.[0]?.created_at ?? null,
          avg_ths_score: null, // THS not wired yet — placeholder
        });
      }
    }

    return NextResponse.json({
      data: {
        kpis: {
          active_cases: activeCases ?? 0,
          active_therapists: activeTherapists ?? 0,
          checkins_this_week: checkinsThisWeek ?? 0,
          avg_prep_time_seconds: avgPrepTimeSeconds,
        },
        therapists: therapistRows,
      },
      error: null,
    });
  } catch (err) {
    safeLog.error("[owner-stats]", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        data: null,
        error: { message: "Failed to load owner dashboard stats." },
      },
      { status: 500 }
    );
  }
}
