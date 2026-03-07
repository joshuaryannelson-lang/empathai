// app/api/webhooks/deploy/route.ts
// Vercel deploy webhook — marks passing QA checks as stale after a deploy.
// Accepts secret via Authorization header or body.secret field.
// Set DEPLOY_WEBHOOK_SECRET in environment variables.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}
function bad(msg: string, status = 400) {
  return NextResponse.json({ data: null, error: { message: msg } }, { status });
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const hookSecret = process.env.DEPLOY_WEBHOOK_SECRET;
  if (!hookSecret) return bad("Deploy webhook not configured", 500);

  const body = await request.json().catch(() => ({}));

  // Accept secret from Authorization header or body field
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : typeof body?.secret === "string"
      ? body.secret
      : "";

  if (!providedSecret || !constantTimeEqual(providedSecret, hookSecret)) {
    return bad("Invalid secret", 401);
  }

  // Optional pages filter
  const pages: string[] | null = Array.isArray(body?.pages)
    ? body.pages.filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
    : null;

  const hasPages = pages !== null && pages.length > 0;
  const now = new Date().toISOString();

  // Count total passing checks (for skipped count)
  let totalPassQuery = supabaseAdmin
    .from("qa_checks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pass");

  if (hasPages) {
    totalPassQuery = totalPassQuery.in("page_id", pages);
  }

  const { count: totalPassCount } = await totalPassQuery;

  // Mark passing checks as stale
  let updateQuery = supabaseAdmin
    .from("qa_checks")
    .update({ stale: true, stale_since: now })
    .eq("status", "pass");

  if (hasPages) {
    updateQuery = updateQuery.in("page_id", pages);
  }

  const { data, error } = await updateQuery.select("id");

  if (error) {
    return bad(`Failed to mark checks stale: ${error.message}`, 500);
  }

  const markedStale = data?.length ?? 0;
  const skipped = (totalPassCount ?? 0) - markedStale;

  return ok({ marked_stale: markedStale, skipped: Math.max(0, skipped) });
}
