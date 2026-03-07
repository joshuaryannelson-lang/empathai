// app/api/portal/profile/route.ts
// Patient profile setup — accepts preferred_name, pronouns, timezone.
// Marks has_completed_profile = true on success (including skip).
// No PHI logged — audit records patient_id and action only.

import { NextResponse } from "next/server";
import { authenticatePatient } from "@/lib/patientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
const VALID_PRONOUNS = ["he/him", "she/her", "they/them", "prefer not to say", "other"];

function containsIdentifier(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

export async function GET(req: Request) {
  const claims = await authenticatePatient(req);
  if (!claims) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const { data: caseRow } = await supabaseAdmin
    .from("cases")
    .select("patient_id")
    .eq("case_code", claims.case_code)
    .single();

  if (!caseRow?.patient_id) {
    return NextResponse.json({ has_completed_profile: false });
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("has_completed_profile")
    .eq("id", caseRow.patient_id)
    .single();

  return NextResponse.json({
    has_completed_profile: patient?.has_completed_profile ?? false,
  });
}

export async function POST(req: Request) {
  // Authenticate via patient JWT
  const claims = await authenticatePatient(req);
  if (!claims) {
    return NextResponse.json(
      { error: "Not authenticated. Please sign in with your join code." },
      { status: 401 }
    );
  }

  const { case_code } = claims;

  // Resolve patient_id from case_code
  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("cases")
    .select("patient_id")
    .eq("case_code", case_code)
    .single();

  if (caseError || !caseRow?.patient_id) {
    return NextResponse.json(
      { error: "Case not found for your access code." },
      { status: 404 }
    );
  }

  const patientId = caseRow.patient_id;

  // Parse body (empty body = skip)
  let body: Record<string, unknown>;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const preferredName = typeof body.preferred_name === "string"
    ? body.preferred_name.trim().slice(0, 50)
    : null;

  const pronouns = typeof body.pronouns === "string" && VALID_PRONOUNS.includes(body.pronouns)
    ? body.pronouns
    : null;

  const timezone = typeof body.timezone === "string" && body.timezone.length <= 100
    ? body.timezone.trim()
    : null;

  // Block identifier patterns in preferred_name
  if (preferredName && containsIdentifier(preferredName)) {
    return NextResponse.json(
      { error: "Please use a first name only — no email addresses or phone numbers." },
      { status: 400 }
    );
  }

  // Build update payload
  const updates: Record<string, unknown> = {
    has_completed_profile: true,
  };
  if (preferredName) updates.preferred_name = preferredName;
  if (pronouns) updates.pronouns = pronouns;
  if (timezone) updates.timezone = timezone;

  const { error: updateError } = await supabaseAdmin
    .from("patients")
    .update(updates)
    .eq("id", patientId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }

  // Audit log — no PHI, only patient_id and action
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    await supabaseAdmin.from("portal_audit_log").insert({
      event: "profile_setup_complete",
      case_code,
      ip,
      metadata: { patient_id: patientId },
    });
  } catch {
    // Audit failure must not break the flow
  }

  const res = NextResponse.json({ success: true });
  // Set cookie so middleware can gate without DB call
  res.cookies.set("portal_profile_complete", "1", {
    path: "/portal",
    sameSite: "lax",
    maxAge: 86400 * 365, // 1 year — cleared on sign out
  });
  return res;
}
