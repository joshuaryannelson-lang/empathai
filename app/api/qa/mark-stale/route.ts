// app/api/qa/mark-stale/route.ts
// POST: mark all qa_checks for a given page_id as stale
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const pageId = typeof body?.page_id === "string" ? body.page_id.trim() : "";
  if (!pageId) return bad("page_id required");

  const { data, error } = await supabaseAdmin
    .from("qa_checks")
    .update({ stale: true })
    .eq("page_id", pageId)
    .select("id");

  if (error) return bad(error.message, 500);
  return ok({ updated: data?.length ?? 0 });
}
