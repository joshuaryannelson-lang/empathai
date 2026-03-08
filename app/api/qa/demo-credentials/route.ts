// app/api/qa/demo-credentials/route.ts
// Returns demo credentials for QA testing — admin only.
// All credentials come from DEMO_* env vars (never real production data).
export const dynamic = "force-dynamic";

import { ok, bad } from "@/lib/route-helpers";
import { requireRole, isAuthError, logUnauthorizedAccess, getClientIp } from "@/lib/apiAuth";
import { checkRateLimitAsync } from "@/lib/rateLimit";

type Credential = {
  role: string;
  email?: string;
  password?: string;
  joinCode?: string;
};

export async function GET(request: Request) {
  // ── Auth guard: admin only ──
  const auth = await requireRole("admin");
  if (isAuthError(auth)) {
    await logUnauthorizedAccess("/api/qa/demo-credentials", null, getClientIp(request));
    return auth;
  }

  // ── Rate limit: 10 calls/hour per IP ──
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`qa:demo-creds:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ data: null, error: { message: "rate_limit_exceeded", retryAfter: retryAfter > 0 ? retryAfter : 60 } }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter > 0 ? retryAfter : 60) } },
    );
  }

  // All credentials are DEMO ONLY — sourced from DEMO_* env vars,
  // never from production tables. These are hardcoded demo accounts
  // created specifically for QA testing.
  const envMap: { role: string; emailVar: string; passwordVar?: string; joinCodeVar?: string }[] = [
    { role: "Admin", emailVar: "DEMO_ADMIN_EMAIL", passwordVar: "DEMO_ADMIN_PASSWORD" },
    { role: "Owner (Multi)", emailVar: "DEMO_OWNER_MULTI_EMAIL", passwordVar: "DEMO_OWNER_MULTI_PASSWORD" },
    { role: "Owner (Single)", emailVar: "DEMO_OWNER_SINGLE_EMAIL", passwordVar: "DEMO_OWNER_SINGLE_PASSWORD" },
    { role: "Therapist", emailVar: "DEMO_THERAPIST_EMAIL", passwordVar: "DEMO_THERAPIST_PASSWORD" },
    { role: "Patient", emailVar: "", joinCodeVar: "DEMO_PATIENT_JOIN_CODE" },
  ];

  const credentials: Credential[] = [];

  for (const entry of envMap) {
    if (entry.joinCodeVar) {
      // Patient entry — uses join code only
      const joinCode = process.env[entry.joinCodeVar];
      if (joinCode) {
        credentials.push({ role: entry.role, joinCode });
      }
    } else {
      const email = process.env[entry.emailVar];
      const password = entry.passwordVar ? process.env[entry.passwordVar] : undefined;
      if (email) {
        credentials.push({ role: entry.role, email, password: password ?? undefined });
      }
    }
  }

  if (credentials.length === 0) {
    return bad("Demo credentials not configured", 503);
  }

  return ok({ credentials });
}
