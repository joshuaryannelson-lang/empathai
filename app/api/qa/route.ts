// app/api/qa/route.ts
// GET: all check results, POST: submit a check result, DELETE: remove a result
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function GET() {
  const { data, error } = await supabase
    .from("qa_checks")
    .select("id, page_id, check_index, tester_name, status, note, checked_at")
    .order("checked_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const pageId = typeof body?.page_id === "string" ? body.page_id.trim() : "";
  const checkIndex = typeof body?.check_index === "number" ? body.check_index : -1;
  const testerName = typeof body?.tester_name === "string" ? body.tester_name.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const note = typeof body?.note === "string" ? body.note.trim() || null : null;

  if (!pageId) return bad("page_id required");
  if (checkIndex < 0) return bad("check_index required");
  if (!testerName || testerName.length > 50) return bad("tester_name required (max 50 chars)");
  if (!["pass", "fail", "skip"].includes(status)) return bad("status must be pass, fail, or skip");

  // Upsert: one result per check per tester
  const { data, error } = await supabase
    .from("qa_checks")
    .upsert(
      { page_id: pageId, check_index: checkIndex, tester_name: testerName, status, note },
      { onConflict: "page_id,check_index,tester_name" }
    )
    .select("id, page_id, check_index, tester_name, status, note, checked_at")
    .single();

  if (error) return bad(error.message, 500);
  return ok(data, 201);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);

  const pageId = searchParams.get("page_id")?.trim() ?? "";
  const checkIndex = Number(searchParams.get("check_index") ?? "-1");
  const testerName = searchParams.get("tester_name")?.trim() ?? "";

  if (!pageId) return bad("page_id required");
  if (checkIndex < 0 || !Number.isInteger(checkIndex)) return bad("check_index required");
  if (!testerName) return bad("tester_name required");

  const { error } = await supabase
    .from("qa_checks")
    .delete()
    .eq("page_id", pageId)
    .eq("check_index", checkIndex)
    .eq("tester_name", testerName);

  if (error) return bad(error.message, 500);
  return ok(null);
}
