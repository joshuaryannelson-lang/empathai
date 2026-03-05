// lib/demo/demoStatusData.ts
// Synthetic audit log entries for the /status dashboard in demo mode.
// Separate file so we don't modify existing demo mode files.

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60000).toISOString();
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000).toISOString();
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 86400000).toISOString();
}

export interface DemoAuditEntry {
  id: string;
  service: string;
  case_code: string | null;
  triggered_by: string;
  tokens_used: number | null;
  redaction_flags: string[];
  blocked: boolean;
  created_at: string;
  error: string | null;
}

export const demoAuditLogs: DemoAuditEntry[] = [
  // Briefing — therapist
  { id: "da-01", service: "briefing", case_code: null, triggered_by: "therapist:demo-therapist-01", tokens_used: 842, redaction_flags: [], blocked: false, created_at: minutesAgo(4), error: null },
  { id: "da-02", service: "briefing", case_code: null, triggered_by: "therapist:demo-therapist-02", tokens_used: 791, redaction_flags: [], blocked: false, created_at: minutesAgo(18), error: null },
  { id: "da-03", service: "briefing", case_code: null, triggered_by: "manager:demo-manager-01", tokens_used: 1120, redaction_flags: [], blocked: false, created_at: minutesAgo(22), error: null },
  { id: "da-04", service: "briefing", case_code: null, triggered_by: "therapist:demo-therapist-03", tokens_used: 688, redaction_flags: [], blocked: false, created_at: hoursAgo(1.5), error: null },
  { id: "da-05", service: "briefing", case_code: null, triggered_by: "network:admin", tokens_used: 1340, redaction_flags: [], blocked: false, created_at: hoursAgo(3), error: null },
  // More briefing calls spread over today
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `da-br-${i}`,
    service: "briefing",
    case_code: null,
    triggered_by: `therapist:demo-therapist-0${(i % 3) + 1}`,
    tokens_used: 650 + Math.floor(Math.random() * 500),
    redaction_flags: [] as string[],
    blocked: false,
    created_at: hoursAgo(4 + i * 0.8),
    error: null,
  })),

  // Session prep
  { id: "da-06", service: "session-prep", case_code: "demo-case-03", triggered_by: "therapist:demo-therapist-01", tokens_used: 310, redaction_flags: ["NAME"], blocked: false, created_at: minutesAgo(8), error: null },
  { id: "da-07", service: "session-prep", case_code: "demo-case-01", triggered_by: "therapist:demo-therapist-01", tokens_used: 280, redaction_flags: [], blocked: false, created_at: minutesAgo(35), error: null },
  { id: "da-08", service: "session-prep", case_code: "demo-case-05", triggered_by: "therapist:demo-therapist-02", tokens_used: 295, redaction_flags: [], blocked: false, created_at: hoursAgo(1), error: null },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `da-sp-${i}`,
    service: "session-prep",
    case_code: `demo-case-${String((i % 12) + 1).padStart(2, "0")}`,
    triggered_by: `therapist:demo-therapist-0${(i % 3) + 1}`,
    tokens_used: 240 + Math.floor(Math.random() * 150),
    redaction_flags: i % 5 === 0 ? ["NAME"] : ([] as string[]),
    blocked: false,
    created_at: hoursAgo(2 + i * 1.5),
    error: null,
  })),

  // THS scoring
  { id: "da-09", service: "ths-scoring", case_code: "demo-practice-01", triggered_by: "system:cron", tokens_used: null, redaction_flags: [], blocked: false, created_at: minutesAgo(12), error: null },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `da-ths-${i}`,
    service: "ths-scoring",
    case_code: "demo-practice-01",
    triggered_by: "system:cron",
    tokens_used: null,
    redaction_flags: [] as string[],
    blocked: false,
    created_at: hoursAgo(2 + i * 3),
    error: null,
  })),

  // Task generation
  { id: "da-10", service: "task-generation", case_code: "demo-case-03", triggered_by: "therapist:demo-therapist-01", tokens_used: 520, redaction_flags: [], blocked: false, created_at: minutesAgo(15), error: null },
  { id: "da-11", service: "task-generation", case_code: "demo-case-05", triggered_by: "therapist:demo-therapist-02", tokens_used: 480, redaction_flags: [], blocked: false, created_at: hoursAgo(2), error: null },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `da-tg-${i}`,
    service: "task-generation",
    case_code: `demo-case-${String((i % 12) + 1).padStart(2, "0")}`,
    triggered_by: `therapist:demo-therapist-0${(i % 3) + 1}`,
    tokens_used: 380 + Math.floor(Math.random() * 200),
    redaction_flags: [] as string[],
    blocked: false,
    created_at: hoursAgo(3 + i * 2),
    error: null,
  })),

  // Redaction
  { id: "da-12", service: "redaction", case_code: "demo-case-03", triggered_by: "system:pipeline", tokens_used: null, redaction_flags: ["NAME", "PHONE"], blocked: true, created_at: minutesAgo(8), error: null },
  { id: "da-13", service: "redaction", case_code: "demo-case-07", triggered_by: "system:pipeline", tokens_used: null, redaction_flags: ["NAME"], blocked: false, created_at: minutesAgo(35), error: null },
  { id: "da-14", service: "redaction", case_code: "demo-case-01", triggered_by: "system:pipeline", tokens_used: null, redaction_flags: ["EMAIL"], blocked: false, created_at: hoursAgo(1.5), error: null },
  ...Array.from({ length: 15 }, (_, i) => {
    const flags = [["NAME"], ["EMAIL"], ["PHONE"], ["NAME", "DOB"], []][i % 5];
    return {
      id: `da-rd-${i}`,
      service: "redaction",
      case_code: `demo-case-${String((i % 12) + 1).padStart(2, "0")}`,
      triggered_by: "system:pipeline",
      tokens_used: null,
      redaction_flags: flags,
      blocked: flags.length > 1,
      created_at: hoursAgo(2 + i * 1.2),
      error: null,
    };
  }),

  // Risk classification
  { id: "da-15", service: "risk-classification", case_code: "demo-case-03", triggered_by: "system:pipeline", tokens_used: null, redaction_flags: [], blocked: false, created_at: minutesAgo(5), error: null },
  { id: "da-16", service: "risk-classification", case_code: "demo-case-10", triggered_by: "system:pipeline", tokens_used: null, redaction_flags: [], blocked: false, created_at: minutesAgo(20), error: null },
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `da-rc-${i}`,
    service: "risk-classification",
    case_code: `demo-case-${String((i % 12) + 1).padStart(2, "0")}`,
    triggered_by: "system:pipeline",
    tokens_used: null,
    redaction_flags: [] as string[],
    blocked: false,
    created_at: hoursAgo(1 + i * 0.9),
    error: null,
  })),
];

// ── Helpers for the status API ────────────────────────────────────────────────

export type ServiceStatus = {
  service: string;
  status: "healthy" | "degraded" | "inactive" | "unknown";
  lastCallAt: string | null;
  callsToday: number;
  avgTokensToday: number;
  blockedToday: number;
  errorsToday: number;
  lastError: string | null;
};

export type StatusResponse = {
  services: ServiceStatus[];
  summary: {
    totalCallsToday: number;
    totalBlockedToday: number;
    totalErrorsToday: number;
    lastUpdated: string;
  };
  recentActivity: Array<{
    time: string;
    service: string;
    case_code: string | null;
    tokens: number | null;
    blocked: boolean;
  }>;
  redactionStats: {
    totalPromptsScrubbed: number;
    totalOutputsScrubbed: number;
    mostCommonFlag: string;
    byDay: Array<{ date: string; count: number }>;
  };
  riskSummary: Record<string, number>;
};

const SERVICE_NAMES = [
  "briefing",
  "session-prep",
  "ths-scoring",
  "task-generation",
  "redaction",
  "risk-classification",
];

export function getDemoStatusResponse(): StatusResponse {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const todayLogs = demoAuditLogs.filter(l => l.created_at >= todayISO);

  const services: ServiceStatus[] = SERVICE_NAMES.map(name => {
    const svcLogs = todayLogs.filter(l => l.service === name);
    const allSvcLogs = demoAuditLogs.filter(l => l.service === name);
    const lastLog = allSvcLogs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

    const tokensLogs = svcLogs.filter(l => l.tokens_used !== null);
    const avgTokens = tokensLogs.length
      ? Math.round(tokensLogs.reduce((s, l) => s + (l.tokens_used ?? 0), 0) / tokensLogs.length)
      : 0;

    const blocked = svcLogs.filter(l => l.blocked).length;
    const errors = svcLogs.filter(l => l.error !== null).length;

    let status: ServiceStatus["status"] = "unknown";
    if (lastLog) {
      const msSince = now - new Date(lastLog.created_at).getTime();
      if (msSince < 3600000 && errors === 0) status = "healthy";
      else if (msSince < 7 * 86400000) status = "degraded";
      else status = "inactive";
    }

    return {
      service: name,
      status,
      lastCallAt: lastLog?.created_at ?? null,
      callsToday: svcLogs.length,
      avgTokensToday: avgTokens,
      blockedToday: blocked,
      errorsToday: errors,
      lastError: null,
    };
  });

  const recentActivity = demoAuditLogs
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
    .map(l => ({
      time: l.created_at,
      service: l.service,
      case_code: l.case_code,
      tokens: l.tokens_used,
      blocked: l.blocked,
    }));

  // Redaction stats (last 7 days)
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  const redactionLogs = demoAuditLogs.filter(
    l => l.service === "redaction" && l.created_at >= sevenDaysAgo
  );
  const flagCounts: Record<string, number> = {};
  for (const l of redactionLogs) {
    for (const f of l.redaction_flags) {
      flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    }
  }
  const mostCommon = Object.entries(flagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NAME";
  const scrubbed = redactionLogs.filter(l => l.redaction_flags.length > 0);

  // Volume by day (last 7)
  const byDay: Array<{ date: string; count: number }> = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    const nextDate = new Date(now - (d - 1) * 86400000).toISOString().slice(0, 10);
    const count = redactionLogs.filter(l => l.created_at.slice(0, 10) >= date && l.created_at.slice(0, 10) < nextDate).length;
    byDay.push({ date, count: count || (d === 0 ? scrubbed.length : Math.floor(Math.random() * 4) + 1) });
  }

  // Risk summary
  const riskLogs = demoAuditLogs.filter(
    l => l.service === "risk-classification" && l.created_at >= sevenDaysAgo
  );
  const riskSummary: Record<string, number> = {
    critical: 2,
    declining: 3,
    stable: Math.max(0, riskLogs.length - 8),
    improving: 3,
  };

  return {
    services,
    summary: {
      totalCallsToday: todayLogs.length,
      totalBlockedToday: todayLogs.filter(l => l.blocked).length,
      totalErrorsToday: todayLogs.filter(l => l.error !== null).length,
      lastUpdated: new Date().toISOString(),
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
}
