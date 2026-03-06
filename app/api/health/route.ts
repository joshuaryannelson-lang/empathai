// app/api/health/route.ts
// Lightweight health check endpoint for uptime monitoring.
// Returns 200 with service status. No auth required.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check Supabase connectivity
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error("SUPABASE_URL not set");
    const res = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      signal: AbortSignal.timeout(5000),
    });
    checks.supabase = res.ok ? "ok" : `error:${res.status}`;
  } catch (e: unknown) {
    checks.supabase = `error:${e instanceof Error ? e.message : "unknown"}`;
  }

  // Check Anthropic API key presence (don't call the API — just verify config)
  checks.anthropic_key = process.env.ANTHROPIC_API_KEY ? "configured" : "missing";

  // Check PATIENT_JWT_SECRET presence (required for patient portal auth)
  checks.patient_jwt = (process.env.PATIENT_JWT_SECRET || process.env.SUPABASE_JWT_SECRET) ? "configured" : "missing";

  const allOk = checks.supabase === "ok" && checks.anthropic_key === "configured";

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
