// app/api/portal/checkin/route.ts
// Patient check-in endpoint — uses case_code from JWT, not raw caseId.
// NO SERVICE ROLE KEY — uses anon key + patient JWT for RLS enforcement.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticatePatient } from "@/lib/patientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimitAsync } from "@/lib/rateLimit";
import { detectInjection, MAX_NOTE_LENGTH } from "@/lib/phi/sanitize";
import { scrubPrompt } from "@/lib/phi/scrub";

export const dynamic = "force-dynamic";

/**
 * Create a Supabase client with the patient's JWT set as the auth token.
 * This ensures RLS policies are enforced using the patient's case_code claim.
 */
function supabaseAsPatient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export async function POST(req: Request) {
  // ── Authenticate ──
  const claims = await authenticatePatient(req);
  if (!claims) {
    return NextResponse.json(
      { data: null, error: { message: "Not authenticated. Please sign in with your join code." } },
      { status: 401 }
    );
  }

  const { case_code } = claims;

  // ── Rate limiting: 10 check-ins per case_code per hour ──
  const rl = await checkRateLimitAsync(`checkin:${case_code}`, 10, 3600_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: { message: "Too many check-ins. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

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

  const { rating, notes, week_index } = body ?? {};

  // Validate rating (1-10)
  if (rating == null || typeof rating !== "number" || rating < 1 || rating > 10 || !Number.isInteger(rating)) {
    return NextResponse.json(
      { data: null, error: { message: "rating must be an integer between 1 and 10" } },
      { status: 400 }
    );
  }

  // Validate week_index (optional, positive integer)
  if (week_index !== undefined && week_index !== null) {
    if (typeof week_index !== "number" || !Number.isInteger(week_index) || week_index < 0) {
      return NextResponse.json(
        { data: null, error: { message: "week_index must be a non-negative integer" } },
        { status: 400 }
      );
    }
  }

  // Validate notes — injection detection + length limit (server-side enforcement)
  const rawNote = typeof notes === "string" ? notes.trim() : null;

  if (rawNote) {
    // Server-side length limit (GAP-19)
    if (rawNote.length > MAX_NOTE_LENGTH) {
      // Audit log (do NOT log the content itself)
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      try {
        await supabaseAdmin.from("portal_audit_log").insert({
          event: "injection_attempt",
          case_code,
          ip,
          metadata: { route: "/api/portal/checkin", field: "note", reason: "exceeds_max_length" },
        });
      } catch { /* audit failure must not break the flow */ }
      return NextResponse.json(
        { data: null, error: { message: "Note exceeds maximum length of 1000 characters." } },
        { status: 400 }
      );
    }

    // Injection detection (GAP-19)
    const injection = detectInjection(rawNote);
    if (!injection.safe) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      try {
        await supabaseAdmin.from("portal_audit_log").insert({
          event: "injection_attempt",
          case_code,
          ip,
          metadata: { route: "/api/portal/checkin", field: "note", reason: injection.reason },
        });
      } catch { /* audit failure must not break the flow */ }
      return NextResponse.json(
        { data: null, error: { message: "Note contains disallowed content." } },
        { status: 400 }
      );
    }
  }

  // Scrub PHI from note before it could reach any AI route downstream
  const noteText = rawNote ? scrubPrompt(rawNote, { field: "note", route: "/api/portal/checkin" }).text : null;

  // ── Resolve case_id from case_code (service role for this single lookup) ──
  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("cases")
    .select("id")
    .eq("case_code", case_code)
    .single();

  if (caseError || !caseRow) {
    return NextResponse.json(
      { data: null, error: { message: "Case not found for your access code." } },
      { status: 404 }
    );
  }

  // ── Insert check-in using patient-scoped client (RLS enforced) ──
  // Extract the raw bearer token to pass to the Supabase client
  const token = req.headers.get("authorization")?.slice(7) ?? "";
  const patientClient = supabaseAsPatient(token);

  const { data, error } = await patientClient
    .from("checkins")
    .insert({
      case_id: caseRow.id,
      score: rating,
      note: noteText,
      mood: body.mood ?? null,
    })
    .select("id, case_id, score, mood, created_at, note")
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: "Failed to save check-in. Please try again." } },
      { status: 403 }
    );
  }

  // ── Audit log (service role — audit writes are always admin) ──
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    await supabaseAdmin.from("portal_audit_log").insert({
      event: "checkin_submitted",
      case_code,
      ip,
      metadata: { checkin_id: data.id, score: rating },
    });
  } catch {
    // Audit failure must not break the flow
  }

  return NextResponse.json({
    data: {
      id: data.id,
      score: data.score,
      created_at: data.created_at,
    },
    error: null,
  });
}
