// app/api/admin/practice-status/route.ts
// Aggregated practice health data for the /admin/status page.
// Returns check-in rates, average ratings, cases needing attention,
// therapist activity, and 4-week trend data. Never returns patient-level
// identifiable data — aggregates only.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";

export const dynamic = "force-dynamic";

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - ((day + 6) % 7));
  return x;
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function ok(data: any) { return NextResponse.json({ data, error: null }); }
function bad(msg: string, status = 500) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return ok(buildDemoData());
  }

  try {
    const now = new Date();
    const thisWeekStart = startOfWeekMonday(now);
    const thisWeekISO = thisWeekStart.toISOString();

    // 4 weeks back for trend data
    const fourWeeksAgo = new Date(thisWeekStart);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 21); // 3 more weeks back
    const fourWeeksAgoISO = fourWeeksAgo.toISOString();

    // Last week for comparison
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekISO = lastWeekStart.toISOString();

    // ── Fetch core data ──
    const [casesRes, checkinsRes, therapistsRes, auditRes] = await Promise.all([
      supabase.from("cases").select("id, case_code, therapist_id, status, created_at"),
      supabase.from("checkins").select("case_id, score, created_at").gte("created_at", fourWeeksAgoISO),
      supabase.from("therapists").select("id, name, practice_id"),
      supabase.from("portal_audit_log").select("event, case_code, created_at").gte("created_at", thisWeekISO).order("created_at", { ascending: false }).limit(50),
    ]);

    if (casesRes.error) return bad(casesRes.error.message);
    if (checkinsRes.error) return bad(checkinsRes.error.message);
    if (therapistsRes.error) return bad(therapistsRes.error.message);
    // audit log is optional — don't fail if table missing
    const auditLogs = auditRes.data ?? [];

    const cases = casesRes.data ?? [];
    const allCheckins = checkinsRes.data ?? [];
    const therapists = therapistsRes.data ?? [];

    // Map case_id → case record
    const caseById: Record<string, any> = {};
    for (const c of cases) caseById[c.id] = c;

    // ── This week's check-ins ──
    const thisWeekCheckins = allCheckins.filter((ci: any) => ci.created_at >= thisWeekISO);
    const lastWeekCheckins = allCheckins.filter((ci: any) => ci.created_at >= lastWeekISO && ci.created_at < thisWeekISO);

    // Active cases = cases with at least 1 check-in ever (from our 4-week window,
    // or just all non-archived cases for simplicity)
    const activeCases = cases.filter((c: any) => !c.status || c.status === "active");

    // Distinct case_ids checked in this week
    const checkedInCaseIds = new Set(thisWeekCheckins.map((ci: any) => ci.case_id));

    // ── Card 1: Weekly check-in rate ──
    const checkinNumerator = checkedInCaseIds.size;
    const checkinDenominator = activeCases.length;
    const checkinRate = checkinDenominator > 0 ? checkinNumerator / checkinDenominator : null;

    // ── Card 2: Average wellbeing rating ──
    const thisWeekScores = thisWeekCheckins.map((ci: any) => ci.score).filter((s: any) => typeof s === "number");
    const lastWeekScores = lastWeekCheckins.map((ci: any) => ci.score).filter((s: any) => typeof s === "number");
    const avgRating = thisWeekScores.length > 0 ? thisWeekScores.reduce((a: number, b: number) => a + b, 0) / thisWeekScores.length : null;
    const lastWeekAvg = lastWeekScores.length > 0 ? lastWeekScores.reduce((a: number, b: number) => a + b, 0) / lastWeekScores.length : null;
    const ratingDelta = avgRating !== null && lastWeekAvg !== null ? avgRating - lastWeekAvg : null;

    // ── Card 3: Cases needing attention ──
    // rating ≤ 4 this week OR dropped ≥ 3 points vs last week
    const lastWeekByCaseId: Record<string, number[]> = {};
    for (const ci of lastWeekCheckins as any[]) {
      if (typeof ci.score === "number") {
        (lastWeekByCaseId[ci.case_id] ??= []).push(ci.score);
      }
    }
    const thisWeekByCaseId: Record<string, number[]> = {};
    for (const ci of thisWeekCheckins as any[]) {
      if (typeof ci.score === "number") {
        (thisWeekByCaseId[ci.case_id] ??= []).push(ci.score);
      }
    }
    let needsAttentionCount = 0;
    for (const [caseId, scores] of Object.entries(thisWeekByCaseId)) {
      const avgThisWeek = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avgThisWeek <= 4) { needsAttentionCount++; continue; }
      const lastScores = lastWeekByCaseId[caseId];
      if (lastScores) {
        const avgLastWeek = lastScores.reduce((a, b) => a + b, 0) / lastScores.length;
        if (avgLastWeek - avgThisWeek >= 3) { needsAttentionCount++; }
      }
    }

    // ── Card 4: Practice Health Score (THS) ──
    // Try to fetch THS scores — gracefully handle missing table
    let avgTHS: number | null = null;
    let thsConfidence: "high" | "medium" | "low" | null = null;
    let thsPartialNote: string | null = null;
    try {
      const { data: thsData } = await supabase
        .from("ths_scores")
        .select("score, confidence")
        .gte("created_at", thisWeekISO);
      if (thsData && thsData.length > 0) {
        const scores = thsData.map((t: any) => t.score).filter((s: any) => typeof s === "number");
        avgTHS = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
        const confidences = thsData.map((t: any) => t.confidence);
        thsConfidence = confidences.includes("low") ? "low" : confidences.includes("medium") ? "medium" : "high";
      }
    } catch {
      // Table doesn't exist yet — use wellbeing-only fallback
    }
    if (avgTHS === null && avgRating !== null) {
      // W-component only fallback: THS ≈ wellbeing average
      avgTHS = avgRating;
      thsConfidence = "low";
      thsPartialNote = "Full score available after therapist ratings are submitted";
    }

    // ── Therapist activity summary ──
    const therapistActivity = therapists.map((t: any) => {
      const therapistCases = cases.filter((c: any) => c.therapist_id === t.id);
      const therapistCaseIds = new Set(therapistCases.map((c: any) => c.id));
      const therapistCheckins = thisWeekCheckins.filter((ci: any) => therapistCaseIds.has(ci.case_id));

      // Find most recent activity across their cases
      const relevantAudit = auditLogs.filter((a: any) => {
        const caseForCode = cases.find((c: any) => c.case_code === a.case_code);
        return caseForCode && therapistCaseIds.has(caseForCode.id);
      });
      const lastActivity = therapistCheckins.length > 0
        ? therapistCheckins.reduce((latest: any, ci: any) => ci.created_at > latest ? ci.created_at : latest, "")
        : relevantAudit.length > 0
          ? relevantAudit[0].created_at
          : null;

      // Name formatting: first name + last initial
      const nameParts = (t.name ?? "Unknown").split(" ");
      const displayName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
        : nameParts[0];

      return {
        id: t.id,
        name: displayName,
        casesAssigned: therapistCases.length,
        checkinsThisWeek: therapistCheckins.length,
        sessionRatings: null as number | null, // GA Prep — not available yet
        lastActivity,
      };
    }).sort((a: any, b: any) => b.checkinsThisWeek - a.checkinsThisWeek);

    // ── Activity feed ──
    const crisisEvents = auditLogs.filter((a: any) => a.event === "crisis_detected");
    const joinEvents = auditLogs.filter((a: any) => a.event === "join_code_redeemed");
    const checkinEvents = auditLogs.filter((a: any) => a.event === "checkin_submitted");

    // join_code_failed: only show if >3 from same IP in an hour (we don't have IP grouping here,
    // so we show if total failures this week > 5 as a heuristic)
    const failedJoinEvents = auditLogs.filter((a: any) => a.event === "join_code_failed");
    const showJoinFailure = failedJoinEvents.length > 5;

    const activityFeed: Array<{ type: string; message: string; time: string }> = [];

    if (crisisEvents.length > 0) {
      activityFeed.push({
        type: "crisis",
        message: "A patient indicated they may be struggling this week. The 988 Lifeline was surfaced to them in the portal. If you have not already, consider checking in with their therapist.",
        time: crisisEvents[0].created_at,
      });
    }

    for (const e of joinEvents.slice(0, 5)) {
      activityFeed.push({ type: "join", message: "A new patient joined the portal", time: e.created_at });
    }
    for (const e of checkinEvents.slice(0, 5)) {
      activityFeed.push({ type: "checkin", message: "A patient completed their weekly check-in", time: e.created_at });
    }
    if (showJoinFailure) {
      activityFeed.push({ type: "unusual", message: "Unusual join attempt activity detected", time: failedJoinEvents[0].created_at });
    }

    // Sort by time, limit to 10
    activityFeed.sort((a, b) => b.time.localeCompare(a.time));
    const feedItems = activityFeed.slice(0, 10);
    const hasMoreActivity = activityFeed.length > 10;

    // ── Trend data (last 4 weeks) ──
    const weeks: Array<{ weekStart: string; checkinRate: number | null; avgRating: number | null }> = [];
    for (let w = 3; w >= 0; w--) {
      const wStart = new Date(thisWeekStart);
      wStart.setDate(wStart.getDate() - w * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 7);
      const wStartISO = wStart.toISOString();
      const wEndISO = wEnd.toISOString();

      const wCheckins = allCheckins.filter((ci: any) => ci.created_at >= wStartISO && ci.created_at < wEndISO);
      const wCaseIds = new Set(wCheckins.map((ci: any) => ci.case_id));
      const wScores = wCheckins.map((ci: any) => ci.score).filter((s: any) => typeof s === "number");

      weeks.push({
        weekStart: toISO(wStart),
        checkinRate: activeCases.length > 0 ? wCaseIds.size / activeCases.length : null,
        avgRating: wScores.length > 0 ? wScores.reduce((a: number, b: number) => a + b, 0) / wScores.length : null,
      });
    }

    return ok({
      checkinRate: {
        numerator: checkinNumerator,
        denominator: checkinDenominator,
        rate: checkinRate,
      },
      avgRating: {
        value: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
        delta: ratingDelta !== null ? Math.round(ratingDelta * 10) / 10 : null,
      },
      needsAttention: {
        count: needsAttentionCount,
      },
      practiceHealthScore: {
        value: avgTHS !== null ? Math.round(avgTHS * 10) / 10 : null,
        confidence: thsConfidence,
        partialNote: thsPartialNote,
      },
      therapistActivity,
      activityFeed: feedItems,
      hasMoreActivity,
      trends: weeks,
    });
  } catch (e: any) {
    return bad(e?.message ?? "Failed to compute practice status");
  }
}

// ── Demo data ──
function buildDemoData() {
  return {
    checkinRate: { numerator: 18, denominator: 24, rate: 0.75 },
    avgRating: { value: 6.8, delta: 0.3 },
    needsAttention: { count: 2 },
    practiceHealthScore: { value: 6.8, confidence: "low" as const, partialNote: "Full score available after therapist ratings are submitted" },
    therapistActivity: [
      { id: "t1", name: "Sarah K.", casesAssigned: 8, checkinsThisWeek: 6, sessionRatings: null, lastActivity: new Date(Date.now() - 3600000).toISOString() },
      { id: "t2", name: "Marcus R.", casesAssigned: 10, checkinsThisWeek: 8, sessionRatings: null, lastActivity: new Date(Date.now() - 7200000).toISOString() },
      { id: "t3", name: "Emily W.", casesAssigned: 6, checkinsThisWeek: 4, sessionRatings: null, lastActivity: new Date(Date.now() - 86400000).toISOString() },
    ],
    activityFeed: [
      { type: "checkin", message: "A patient completed their weekly check-in", time: new Date(Date.now() - 1800000).toISOString() },
      { type: "join", message: "A new patient joined the portal", time: new Date(Date.now() - 3600000).toISOString() },
      { type: "checkin", message: "A patient completed their weekly check-in", time: new Date(Date.now() - 7200000).toISOString() },
    ],
    hasMoreActivity: false,
    trends: [
      { weekStart: "2026-02-09", checkinRate: 0.58, avgRating: 6.2 },
      { weekStart: "2026-02-16", checkinRate: 0.63, avgRating: 6.4 },
      { weekStart: "2026-02-23", checkinRate: 0.71, avgRating: 6.6 },
      { weekStart: "2026-03-02", checkinRate: 0.75, avgRating: 6.8 },
    ],
  };
}
