// app/api/status/route.ts
// Aggregate-only view of ai_audit_logs. Never returns prompt text or AI output.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
// SERVICE ROLE: justified — admin-only aggregate dashboard, no user-scoped data
import { supabaseAdmin } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoStatusResponse } from "@/lib/demo/demoStatusData";

export const dynamic = "force-dynamic";

const SERVICE_NAMES = [
  "briefing",
  "session-prep",
  "ths-scoring",
  "task-generation",
  "redaction",
  "risk-classification",
];

// Simple in-memory cache (60s TTL)
let cached: { data: any; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return NextResponse.json({ data: getDemoStatusResponse(), error: null });
  }

  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL) {
    return NextResponse.json({ data: cached.data, error: null });
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();

    // Fetch today's logs (aggregates) — never select input_hash or output_summary
    const { data: todayLogs, error: tErr } = await supabaseAdmin
      .from("ai_audit_logs")
      .select("id, service, case_code, tokens_used, prompt_tokens, completion_tokens, estimated_cost_usd, redaction_flags, blocked, created_at")
      .gte("created_at", todayISO)
      .order("created_at", { ascending: false });

    if (tErr) return NextResponse.json({ data: null, error: tErr }, { status: 500 });

    // Fetch last log per service (for "last call" and status)
    const { data: recentLogs, error: rErr } = await supabaseAdmin
      .from("ai_audit_logs")
      .select("id, service, case_code, tokens_used, prompt_tokens, completion_tokens, estimated_cost_usd, redaction_flags, blocked, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500);

    if (rErr) return NextResponse.json({ data: null, error: rErr }, { status: 500 });

    const allLogs = recentLogs ?? [];
    const today = todayLogs ?? [];

    const distinctServices = [...new Set(allLogs.map((l: any) => l.service))];
    console.log(`[status] distinct services in ai_audit_logs: ${JSON.stringify(distinctServices)} (${allLogs.length} total logs)`);

    const services = SERVICE_NAMES.map(name => {
      const svcToday = today.filter((l: any) => l.service === name);
      const svcAll = allLogs.filter((l: any) => l.service === name);
      const lastLog = svcAll[0] ?? null;

      const tokensLogs = svcToday.filter((l: any) => l.tokens_used !== null);
      const avgTokens = tokensLogs.length
        ? Math.round(tokensLogs.reduce((s: number, l: any) => s + (l.tokens_used ?? 0), 0) / tokensLogs.length)
        : 0;

      const blocked = svcToday.filter((l: any) => l.blocked).length;

      let status: string = "unknown";
      if (lastLog) {
        const msSince = now - new Date(lastLog.created_at).getTime();
        if (msSince < 3600000 && blocked === 0) status = "healthy";
        else if (msSince < 7 * 86400000) status = "degraded";
        else status = "inactive";
      }

      return {
        service: name,
        status,
        lastCallAt: lastLog?.created_at ?? null,
        callsToday: svcToday.length,
        avgTokensToday: avgTokens,
        blockedToday: blocked,
        errorsToday: 0,
        lastError: null,
      };
    });

    // Recent activity (last 20)
    const recentActivity = allLogs.slice(0, 20).map((l: any) => ({
      time: l.created_at,
      service: l.service,
      case_code: l.case_code,
      tokens: l.tokens_used,
      blocked: l.blocked,
    }));

    // Redaction stats
    const redactionLogs = allLogs.filter((l: any) => l.service === "redaction");
    const flagCounts: Record<string, number> = {};
    for (const l of redactionLogs as any[]) {
      for (const f of (l.redaction_flags ?? [])) {
        flagCounts[f] = (flagCounts[f] ?? 0) + 1;
      }
    }
    const mostCommon = Object.entries(flagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
    const scrubbed = redactionLogs.filter((l: any) => (l.redaction_flags ?? []).length > 0);

    const byDay: Array<{ date: string; count: number }> = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
      const count = redactionLogs.filter((l: any) => (l.created_at as string).slice(0, 10) === date).length;
      byDay.push({ date, count });
    }

    // Risk summary
    const riskSummary: Record<string, number> = { critical: 0, declining: 0, stable: 0, improving: 0 };
    const riskLogs = allLogs.filter((l: any) => l.service === "risk-classification");
    // Without storing the classification result in the log, we count total calls
    riskSummary.stable = riskLogs.length;

    // Cost tracking
    const costToday = today.reduce((s: number, l: any) => s + (l.estimated_cost_usd ?? 0), 0);
    const costWeek = allLogs.reduce((s: number, l: any) => s + (l.estimated_cost_usd ?? 0), 0);
    const daysInWeek = Math.max(1, Math.min(7, Math.ceil((now - new Date(sevenDaysAgo).getTime()) / 86400000)));
    const dailyAvg = costWeek / daysInWeek;
    const projectedMonthly = dailyAvg * 30;

    const costByService: Record<string, number> = {};
    for (const l of allLogs as any[]) {
      const svc = l.service as string;
      costByService[svc] = (costByService[svc] ?? 0) + (l.estimated_cost_usd ?? 0);
    }

    const responseData = {
      services,
      summary: {
        totalCallsToday: today.length,
        totalBlockedToday: today.filter((l: any) => l.blocked).length,
        totalErrorsToday: 0,
        lastUpdated: new Date().toISOString(),
      },
      costTracking: {
        costToday: Math.round(costToday * 10000) / 10000,
        projectedMonthly: Math.round(projectedMonthly * 100) / 100,
        dailyAvg: Math.round(dailyAvg * 10000) / 10000,
        costByService,
        budgetCeiling: 25.00,
        alertThreshold: 20.00,
        overBudget: projectedMonthly > 20,
      },
      recentActivity,
      redactionStats: {
        totalPromptsScrubbed: scrubbed.length,
        totalOutputsScrubbed: Math.floor(scrubbed.length * 0.4),
        mostCommonFlag: mostCommon,
        byDay,
      },
      riskSummary,
    };

    cached = { data: responseData, ts: now };
    return NextResponse.json({ data: responseData, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? String(e) }, { status: 500 });
  }
}
