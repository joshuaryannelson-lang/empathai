// app/api/portal/join/generate/route.ts
// Therapist/admin endpoint to generate a join code for a patient's case.
// The join code maps to a case_code — never exposes patient PII.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Generate a human-friendly 8-character join code.
 * Format: XXXX-XXXX (alphanumeric, no ambiguous chars like 0/O, 1/I/L).
 */
function generateJoinCode(): string {
  const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0,O,1,I,L
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function POST(req: Request) {
  // This endpoint requires therapist/admin auth.
  // In production, verify via Supabase auth header.
  // For now, accept case_code in body (therapist-facing endpoint).

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const caseCode = typeof body?.case_code === "string" ? body.case_code.trim() : "";
  if (!caseCode) {
    return NextResponse.json(
      { data: null, error: { message: "case_code is required" } },
      { status: 400 }
    );
  }

  // Verify case exists
  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("cases")
    .select("id, case_code")
    .eq("case_code", caseCode)
    .single();

  if (caseError || !caseRow) {
    return NextResponse.json(
      { data: null, error: { message: "Case not found" } },
      { status: 404 }
    );
  }

  // Invalidate any existing active join codes for this case
  await supabaseAdmin
    .from("join_codes")
    .update({ expires_at: new Date().toISOString() })
    .eq("case_code", caseCode)
    .is("redeemed_at", null);

  // Generate new join code
  const code = generateJoinCode();

  const { data: joinCode, error: insertError } = await supabaseAdmin
    .from("join_codes")
    .insert({
      code,
      case_code: caseCode,
      created_by: "00000000-0000-0000-0000-000000000000", // placeholder until real auth
      expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    })
    .select("id, code, expires_at")
    .single();

  if (insertError) {
    return NextResponse.json(
      { data: null, error: { message: "Failed to generate join code" } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      code: joinCode.code,
      expires_at: joinCode.expires_at,
      // Never return case_code, case_id, or patient info in this response
    },
    error: null,
  });
}
