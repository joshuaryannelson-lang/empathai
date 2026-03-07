// app/api/qa/demo-credentials/route.ts
// Returns demo credentials from environment variables for QA testing.
export const dynamic = "force-dynamic";

import { ok, bad } from "@/lib/route-helpers";

type Credential = {
  role: string;
  email?: string;
  password?: string;
  joinCode?: string;
};

export async function GET() {
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
