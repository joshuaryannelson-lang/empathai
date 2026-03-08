// app/api/portal/profile/route.ts
// Patient profile setup — accepts preferred_name, pronouns, timezone.
// Marks has_completed_profile = true on success (including skip).
// No PHI logged — audit records patient_id and action only.
//
// GAP-17: Uses patient-scoped Supabase client (anon key + patient JWT)
// so that RLS enforces patients can only update their own row.
// supabaseAdmin is only used for audit logging (no patient RLS policy on that table).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticatePatient, extractPatientToken } from "@/lib/patientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
const VALID_PRONOUNS = ["he/him", "she/her", "they/them", "prefer not to say", "other"];

function containsIdentifier(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

/** Create a Supabase client scoped to the patient's JWT for RLS enforcement. */
function createPatientClient(patientJwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${patientJwt}` },
      },
    }
  );
}

export async function GET(req: Request) {
  const claims = await authenticatePatient(req);
  if (!claims) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const token = extractPatientToken(req)!;
  const db = createPatientClient(token);

  // RLS on cases table allows patient to SELECT their own case via case_code
  const { data: caseRow } = await db
    .from("cases")
    .select("patient_id")
    .eq("case_code", claims.case_code)
    .single();

  if (!caseRow?.patient_id) {
    return NextResponse.json({ has_completed_profile: false });
  }

  // RLS on patients table allows patient to SELECT their own row via case_code
  const { data: patient } = await db
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

  const token = extractPatientToken(req)!;
  const db = createPatientClient(token);
  const { case_code } = claims;

  // Resolve patient_id from case_code (RLS-scoped)
  const { data: caseRow, error: caseError } = await db
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

  // Update via patient-scoped client — RLS enforces patient can only update own row
  const { data: updated, error: updateError } = await db
    .from("patients")
    .update(updates)
    .eq("id", patientId)
    .select("id");

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }

  if (!updated || updated.length === 0) {
    console.error("[profile-setup] 0 rows updated for patient_id:", patientId);
    return NextResponse.json(
      { error: "Patient record not found. Please contact your care team." },
      { status: 404 }
    );
  }

  // Audit log — uses supabaseAdmin (patients have no RLS on audit table)
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
