// app/api/admin/practice-status/route.ts
// Aggregated practice health data for the /admin/status page.
// Returns check-in rates, average ratings, cases needing attention,
// therapist activity, and 4-week trend data. Never returns patient-level
// identifiable data — aggregates only.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return ok(buildDemoData());
  }

  // Optional practice_id scoping
  const { searchParams } = new URL(request.url);
  const rawPracticeId = searchParams.get("practice_id");
  const practiceId = rawPracticeId && UUID_RE.test(rawPracticeId) ? rawPracticeId : null;

  // Optional manager_id — scope to assigned practices only
  const rawManagerId = searchParams.get("manager_id");
  const managerId = rawManagerId && UUID_RE.test(rawManagerId) ? rawManagerId : null;
  let managerPracticeIds: string[] | null = null;
  if (managerId) {
    const { data: assignments, error: aErr } = await supabase
      .from("manager_practice_assignments")
      .select("practice_id")
      .eq("manager_id", managerId);
    if (aErr) return bad(aErr.message);
    managerPracticeIds = (assignments ?? []).map((a: { practice_id: string }) => a.practice_id);
    if (managerPracticeIds.length === 0) {
      return ok(buildEmptyData());
    }
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
    // Scope by practice_id (single) or managerPracticeIds (multi)
    let casesQuery = supabase.from("cases").select("id, case_code, therapist_id, practice_id, status, created_at");
    let therapistsQuery = supabase.from("therapists").select("id, name, practice_id");
    if (practiceId) {
      // If manager_id is set, verify practiceId is in their assignments
      if (managerPracticeIds && !managerPracticeIds.includes(practiceId)) {
        return bad("Practice not assigned to manager", 403);
      }
      casesQuery = casesQuery.eq("practice_id", practiceId);
      therapistsQuery = therapistsQuery.eq("practice_id", practiceId);
    } else if (managerPracticeIds) {
      casesQuery = casesQuery.in("practice_id", managerPracticeIds);
      therapistsQuery = therapistsQuery.in("practice_id", managerPracticeIds);
    }

    const [casesRes, checkinsRes, therapistsRes, auditRes, practicesRes, aiAuditRes] = await Promise.all([
      casesQuery,
      supabase.from("checkins").select("case_id, score, created_at").gte("created_at", fourWeeksAgoISO),
      therapistsQuery,
      // SERVICE ROLE: portal_audit_log has RLS admin-only — anon client returns 0 rows
      supabaseAdmin.from("portal_audit_log").select("event, case_code, created_at").gte("created_at", thisWeekISO).order("created_at", { ascending: false }).limit(50),
      supabase.from("practice").select("id, name"),
      // Fetch session-prep activity from ai_audit_logs for the activity feed
      supabaseAdmin.from("ai_audit_logs").select("service, case_code, created_at").in("service", ["session-prep"]).gte("created_at", thisWeekISO).order("created_at", { ascending: false }).limit(20),
    ]);

    if (casesRes.error) return bad(casesRes.error.message);
    if (checkinsRes.error) return bad(checkinsRes.error.message);
    if (therapistsRes.error) return bad(therapistsRes.error.message);
    // audit log is optional — don't fail if table missing
    const auditLogs = auditRes.data ?? [];
    const aiAuditLogs = aiAuditRes.data ?? [];

    const cases = casesRes.data ?? [];
    const therapists = therapistsRes.data ?? [];

    // Build practice name lookup
    const practiceNameById: Record<string, string> = {};
    for (const p of (practicesRes.data ?? []) as any[]) {
      if (p.id && p.name) practiceNameById[p.id] = p.name;
    }

    // Map case_id → case record
    const caseById: Record<string, any> = {};
    for (const c of cases) caseById[c.id] = c;

    // Filter checkins to only scoped cases (important when practice_id is set)
    const scopedCaseIds = new Set(cases.map((c: any) => c.id));
    const allCheckins = (checkinsRes.data ?? []).filter((ci: any) => scopedCaseIds.has(ci.case_id));

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
        practiceName: practiceNameById[t.practice_id] ?? null,
        casesAssigned: therapistCases.length,
        checkinsThisWeek: therapistCheckins.length,
        sessionRatings: null as number | null, // GA Prep — not available yet
        lastActivity,
      };
    }).sort((a: any, b: any) => b.checkinsThisWeek - a.checkinsThisWeek);

    // ── Activity feed ──
    // If scoped to a practice, filter audit logs to only events for that practice's cases
    const scopedCaseCodes = new Set(cases.map((c: any) => c.case_code).filter(Boolean));
    const scopedAuditLogs = (practiceId || managerPracticeIds)
      ? auditLogs.filter((a: any) => !a.case_code || scopedCaseCodes.has(a.case_code))
      : auditLogs;

    const crisisEvents = scopedAuditLogs.filter((a: any) => a.event === "crisis_detected");
    const joinEvents = scopedAuditLogs.filter((a: any) => a.event === "join_code_redeemed");
    const checkinEvents = scopedAuditLogs.filter((a: any) => a.event === "checkin_submitted");

    // join_code_failed: only show if >3 from same IP in an hour (we don't have IP grouping here,
    // so we show if total failures this week > 5 as a heuristic)
    const failedJoinEvents = scopedAuditLogs.filter((a: any) => a.event === "join_code_failed");
    const showJoinFailure = failedJoinEvents.length > 5;

    // Helper to resolve practice name from an audit log event's case_code
    function practiceNameForAudit(event: any): string | null {
      if (!event.case_code) return null;
      const c = cases.find((cs: any) => cs.case_code === event.case_code);
      if (!c) return null;
      return practiceNameById[(c as any).practice_id] ?? null;
    }

    const activityFeed: Array<{ type: string; message: string; time: string; practiceName?: string | null }> = [];

    if (crisisEvents.length > 0) {
      activityFeed.push({
        type: "crisis",
        message: "A patient indicated they may be struggling this week. The 988 Lifeline was surfaced to them in the portal. If you have not already, consider checking in with their therapist.",
        time: crisisEvents[0].created_at,
        practiceName: practiceNameForAudit(crisisEvents[0]),
      });
    }

    for (const e of joinEvents.slice(0, 5)) {
      activityFeed.push({ type: "join", message: "A new patient joined the portal", time: e.created_at, practiceName: practiceNameForAudit(e) });
    }
    for (const e of checkinEvents.slice(0, 5)) {
      activityFeed.push({ type: "checkin", message: "A patient completed their weekly check-in", time: e.created_at, practiceName: practiceNameForAudit(e) });
    }
    // Session-prep events from ai_audit_logs
    const scopedAiLogs = (practiceId || managerPracticeIds)
      ? aiAuditLogs.filter((a: any) => !a.case_code || scopedCaseIds.has(a.case_code))
      : aiAuditLogs;
    for (const e of scopedAiLogs.slice(0, 5)) {
      activityFeed.push({ type: "checkin", message: "Session prep generated for an upcoming appointment", time: e.created_at, practiceName: null });
    }
    if (showJoinFailure) {
      activityFeed.push({ type: "unusual", message: "Unusual join attempt activity detected", time: failedJoinEvents[0].created_at, practiceName: practiceNameForAudit(failedJoinEvents[0]) });
    }

    // Sort by time, limit to 10
    activityFeed.sort((a, b) => b.time.localeCompare(a.time));
    console.log(`[practice-status] activity feed: ${activityFeed.length} items (portal_audit=${auditLogs.length}, ai_audit=${aiAuditLogs.length})`);
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

// ── Empty data (zero-assignment manager) ──
function buildEmptyData() {
  return {
    checkinRate: { numerator: 0, denominator: 0, rate: null },
    avgRating: { value: null, delta: null },
    needsAttention: { count: 0 },
    practiceHealthScore: { value: null, confidence: null, partialNote: null },
    therapistActivity: [],
    activityFeed: [],
    hasMoreActivity: false,
    trends: [],
  };
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
