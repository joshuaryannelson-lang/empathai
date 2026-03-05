// app/api/briefing/route.ts
// Server-side briefing endpoint. Replaces client-side prompt construction.
// All prompt building, PII redaction, and audit logging happen here.

import { NextResponse } from "next/server";
import { generateBriefing, type BriefingRole } from "@/lib/services/briefing";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoBriefing } from "@/lib/demo/demoAI";

export const dynamic = "force-dynamic";

const VALID_ROLES: BriefingRole[] = ["therapist", "manager", "network"];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { role, dataSnapshot, triggeredBy, caseCode } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { data: null, error: { message: `role must be one of: ${VALID_ROLES.join(", ")}` } },
        { status: 400 }
      );
    }

    // Demo mode: return canned response, no LLM call
    if (isDemoMode(req.url)) {
      return NextResponse.json({ data: getDemoBriefing(role), error: null });
    }

    if (!dataSnapshot || typeof dataSnapshot !== "object") {
      return NextResponse.json(
        { data: null, error: { message: "dataSnapshot is required" } },
        { status: 400 }
      );
    }

    const result = await generateBriefing({
      role,
      dataSnapshot,
      triggeredBy: triggeredBy ?? "anonymous",
      caseCode: caseCode ?? null,
    });

    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { data: null, error: { message } },
      { status: 500 }
    );
  }
}
