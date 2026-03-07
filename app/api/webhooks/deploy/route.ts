// app/api/webhooks/deploy/route.ts
// Vercel deploy webhook — marks specified QA pages as stale after a deploy.
// Usage: POST with { pages: ["page_id1", "page_id2"], secret: "..." }
// Set VERCEL_DEPLOY_HOOK_SECRET in environment variables.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function POST(request: Request) {
  const hookSecret = process.env.VERCEL_DEPLOY_HOOK_SECRET;
  if (!hookSecret) return bad("Deploy webhook not configured", 500);

  const body = await request.json().catch(() => ({}));

  // Validate secret
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!secret || secret !== hookSecret) {
    return bad("Invalid secret", 401);
  }

  // Validate pages array
  const pages: string[] = Array.isArray(body?.pages) ? body.pages.filter((p: unknown) => typeof p === "string" && p.trim()) : [];
  if (pages.length === 0) return bad("pages[] required (array of page_id strings)");

  // Mark each page stale
  const results: { page_id: string; updated: number }[] = [];
  for (const pageId of pages) {
    const { data, error } = await supabaseAdmin
      .from("qa_checks")
      .update({ stale: true })
      .eq("page_id", pageId.trim())
      .select("id");

    if (error) {
      return bad(`Failed to mark ${pageId} stale: ${error.message}`, 500);
    }
    results.push({ page_id: pageId, updated: data?.length ?? 0 });
  }

  return ok({ marked_stale: results });
}
