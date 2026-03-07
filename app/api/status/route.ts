// app/api/status/route.ts
// Component-based health status endpoint. Returns status for each system component.
// Public endpoint — response is NOT wrapped in { data, error } envelope.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
// SERVICE ROLE: justified — aggregate audit log query, no user-scoped data
import { supabaseAdmin } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoStatusResponse } from "@/lib/demo/demoStatusData";

export const dynamic = "force-dynamic";

type ItemStatus = "operational" | "degraded" | "down" | "unknown";
type OverallStatus = "operational" | "degraded" | "outage" | "unknown";

interface StatusItem {
  name: string;
  status: ItemStatus;
}

interface StatusComponent {
  id: string;
  name: string;
  description: string;
  status: ItemStatus;
  uptime: number | null;
  items: StatusItem[];
}

interface StatusResponse {
  overall: OverallStatus;
  last_checked: string;
  components: StatusComponent[];
  error?: string;
}

// In-memory cache (60s TTL)
let cached: { data: StatusResponse; ts: number } | null = null;
const CACHE_TTL = 60_000;

// AI service name mappings
const AI_SERVICE_MAP: Record<string, string[]> = {
  "Session Prep Model": ["session-prep", "briefing"],
  "Redaction Engine": ["redaction"],
  "Risk Signals": ["risk-classification"],
};

const MIN_VOLUME = 10;

function deriveItemStatus(errorRate: number): ItemStatus {
  if (errorRate < 0.05) return "operational";
  if (errorRate <= 0.20) return "degraded";
  return "down";
}

function worstStatus(statuses: ItemStatus[]): ItemStatus {
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.includes("unknown")) return "unknown";
  return "operational";
}

function deriveOverall(components: StatusComponent[]): OverallStatus {
  if (components.some(c => c.status === "down")) return "outage";
  if (components.some(c => c.status === "degraded")) return "degraded";
  return "operational";
}

function makeStaticComponent(
  id: string,
  name: string,
  description: string,
  itemNames: string[],
): StatusComponent {
  return {
    id,
    name,
    description,
    status: "operational",
    uptime: 100,
    items: itemNames.map(n => ({ name: n, status: "operational" as ItemStatus })),
  };
}

export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return NextResponse.json(getDemoStatusResponse());
  }

  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: todayLogs, error: tErr } = await supabaseAdmin
      .from("ai_audit_logs")
      .select("id, service, error, created_at")
      .gte("created_at", todayISO);

    if (tErr) throw new Error(tErr.message);

    const logs = todayLogs ?? [];

    // Derive AI Services component from audit logs
    const aiItems: StatusItem[] = [];
    const aiUptimes: number[] = [];

    for (const [itemName, serviceKeys] of Object.entries(AI_SERVICE_MAP)) {
      const matching = logs.filter((l: any) => serviceKeys.includes(l.service));
      const total = matching.length;

      if (total < MIN_VOLUME) {
        aiItems.push({ name: itemName, status: "operational" });
        // Don't add to aiUptimes — insufficient data
      } else {
        const errors = matching.filter((l: any) => l.error === true).length;
        const errorRate = errors / total;
        const status = deriveItemStatus(errorRate);
        const uptime = Math.round((1 - errorRate) * 10000) / 100;
        aiItems.push({ name: itemName, status });
        aiUptimes.push(uptime);
      }
    }

    const aiUptime = aiUptimes.length > 0
      ? Math.round(aiUptimes.reduce((a, b) => a + b, 0) / aiUptimes.length * 100) / 100
      : null;

    const aiComponent: StatusComponent = {
      id: "ai-services",
      name: "AI Services",
      description: "Underlying AI service health",
      status: worstStatus(aiItems.map(i => i.status)),
      uptime: aiUptime,
      items: aiItems,
    };

    // Static components (will be wired to real checks in a future sprint)
    const components: StatusComponent[] = [
      makeStaticComponent(
        "patient-portal",
        "Patient Portal",
        "Patient-facing join, check-in, history, and goals",
        ["Join Code & Onboarding", "Weekly Check-In", "Check-In History", "Goals"],
      ),
      makeStaticComponent(
        "session-prep",
        "Session Prep",
        "AI-generated pre-session briefings for therapists",
        ["AI Generation", "PHI Redaction", "Review Gate"],
      ),
      makeStaticComponent(
        "therapist-views",
        "Therapist Views",
        "Case management and session tools for therapists",
        ["Case List", "Case Detail", "Session Prep Card"],
      ),
      makeStaticComponent(
        "practice-dashboard",
        "Practice Dashboard",
        "Practice health and activity monitoring for managers",
        ["Practice Status", "Health Score", "Activity Feed"],
      ),
      makeStaticComponent(
        "authentication",
        "Authentication",
        "Role selection and portal access",
        ["Role Selector", "Portal Auth (Join Code)", "Admin Access"],
      ),
      aiComponent,
    ];

    const response: StatusResponse = {
      overall: deriveOverall(components),
      last_checked: new Date().toISOString(),
      components,
    };

    cached = { data: response, ts: now };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({
      overall: "unknown",
      components: [],
      last_checked: new Date().toISOString(),
      error: "Status check failed",
    } satisfies StatusResponse, { status: 200 });
  }
}
