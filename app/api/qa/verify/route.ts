// app/api/qa/verify/route.ts
// POST: mark a single qa_check as freshly verified (not stale)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const checkId = typeof body?.check_id === "string" ? body.check_id.trim() : "";
  const verifiedBy = typeof body?.verified_by === "string" ? body.verified_by.trim() : "";

  if (!checkId) return bad("check_id required");
  if (!verifiedBy || verifiedBy.length > 50) return bad("verified_by required (max 50 chars)");

  const { data, error } = await supabaseAdmin
    .from("qa_checks")
    .update({
      stale: false,
      last_verified_at: new Date().toISOString(),
      last_verified_by: verifiedBy,
    })
    .eq("id", checkId)
    .select("id, page_id, check_index, tester_name, status, note, checked_at, page_path, last_verified_at, last_verified_by, stale")
    .single();

  if (error) return bad(error.message, 500);
  return ok(data);
}
