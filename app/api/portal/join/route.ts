// app/api/portal/join/route.ts
// Join code redemption endpoint — replaces name+DOB patient identification.
// Rate-limited: max 5 attempts per IP per hour.
// On success: returns a signed JWT scoped to the patient's case_code.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
// SERVICE ROLE: justified — join code redemption is unauthenticated by definition.
// The service role is used ONLY to:
//   1. Look up the join code
//   2. Mark it redeemed
//   3. Record rate-limit attempts
//   4. Write audit log
// The returned JWT is scoped to case_code only (no admin access).
import { supabaseAdmin } from "@/lib/supabase";
import { mintPatientJWT } from "@/lib/patientAuth";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS_PER_HOUR = 5;

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: Request) {
  const ip = getClientIP(req);

  // ── Parse body ──
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code || code.length < 4) {
    return NextResponse.json(
      { data: null, error: { message: "Join code is required" } },
      { status: 400 }
    );
  }

  // ── Rate limiting ──
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: attemptCount } = await supabaseAdmin
    .from("join_code_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("attempted_at", oneHourAgo);

  if ((attemptCount ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    await logAudit("join_code_rate_limited", null, ip, { code_prefix: code.slice(0, 4) });
    return NextResponse.json(
      { data: null, error: { message: "Too many attempts, contact your therapist." } },
      { status: 429 }
    );
  }

  // Record this attempt
  await supabaseAdmin
    .from("join_code_attempts")
    .insert({ ip });

  // ── Look up join code ──
  // expires_at can be NULL (no expiry) or a future timestamp — both are valid.
  const { data: joinCode, error: lookupError } = await supabaseAdmin
    .from("join_codes")
    .select("id, code, case_code, expires_at, redeemed_at, is_test")
    .eq("code", code)
    .is("redeemed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  console.log(`[join] code="${code}" found=${!!joinCode} error=${lookupError?.message ?? "none"} expires_at=${joinCode?.expires_at ?? "null"} redeemed_at=${joinCode?.redeemed_at ?? "null"}`);

  try {
    console.log("[join] entering post-lookup block");

    if (lookupError || !joinCode) {
      // Distinguish expired vs not-found for better UX
      const { data: anyMatch } = await supabaseAdmin
        .from("join_codes")
        .select("id, expires_at, redeemed_at")
        .eq("code", code)
        .maybeSingle();

      let message = "Code not found.";
      if (anyMatch) {
        if (anyMatch.redeemed_at) {
          message = "This code has already been used.";
        } else if (anyMatch.expires_at && new Date(anyMatch.expires_at) <= new Date()) {
          message = "This code has expired.";
        }
      }

      await logAudit("join_code_failed", null, ip, { code_prefix: code.slice(0, 4), reason: message });
      return NextResponse.json(
        { data: null, error: { message } },
        { status: 404 }
      );
    }

    // ── Mark code as redeemed ──
    const { error: redeemError } = await supabaseAdmin
      .from("join_codes")
      .update({
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", joinCode.id)
      .is("redeemed_at", null); // Double-check not already redeemed (race condition guard)

    if (redeemError) {
      console.error(`[join] redeem update failed for id=${joinCode.id}:`, redeemError.message);
      return NextResponse.json(
        { data: null, error: { message: "Failed to redeem join code." } },
        { status: 500 }
      );
    }

    // ── Mint patient JWT ──
    console.log("[join] minting JWT for case_code=", joinCode.case_code);
    let token: string;
    try {
      token = await mintPatientJWT(joinCode.case_code);
    } catch (e: any) {
      console.error(`[join] JWT mint failed for case_code=${joinCode.case_code}:`, e?.message ?? e);
      return NextResponse.json(
        { data: null, error: { message: "Authentication service error." } },
        { status: 500 }
      );
    }
    console.log("[join] JWT minted successfully");

    // ── Auto-reset test codes so they can be reused ──
    if (joinCode.is_test) {
      await supabaseAdmin
        .from("join_codes")
        .update({ redeemed_at: null })
        .eq("id", joinCode.id);
      console.log(`[join] auto-reset test code="${code}" for reuse`);
    }

    // ── Audit log ──
    await logAudit("join_code_redeemed", joinCode.case_code, ip, {
      join_code_id: joinCode.id,
    });

    const response = {
      data: {
        token,
        case_code: joinCode.case_code,
      },
      error: null,
    };
    console.log("[join] returning success response for case_code=", joinCode.case_code);
    return NextResponse.json(response);
  } catch (e: any) {
    console.error(`[join] unexpected error after lookup for code=${code}:`, e?.message ?? e, e?.stack);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error." } },
      { status: 500 }
    );
  }
}

// ── Helpers ──

async function logAudit(
  event: string,
  caseCode: string | null,
  ip: string,
  metadata: Record<string, any> = {}
) {
  try {
    await supabaseAdmin.from("portal_audit_log").insert({
      event,
      case_code: caseCode,
      ip,
      metadata,
    });
  } catch {
    // Audit failures must not break the flow
  }
}
