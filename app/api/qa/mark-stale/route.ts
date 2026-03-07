// app/api/qa/mark-stale/route.ts
// POST: mark all qa_checks for a given page_path as stale
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const pagePath = typeof body?.page_path === "string" ? body.page_path.trim() : "";
  if (!pagePath) return bad("page_path required");

  const { data, error } = await supabaseAdmin
    .from("qa_checks")
    .update({ stale: true })
    .eq("page_path", pagePath)
    .select("id");

  if (error) return bad(error.message, 500);
  return ok({ updated: data?.length ?? 0 });
}
