// app/api/cases/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCase } from "@/lib/demo/demoData";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const id = await getIdFromContext(ctx);
  if (!id) return bad("Missing case id");

  if (isDemoMode(_req.url)) {
    const c = getDemoCase(id);
    if (!c) return bad("Case not found", 404);
    return ok(c);
  }

  const { data, error } = await supabase.from("cases").select("*").eq("id", id).single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}

export async function PATCH(req: Request, ctx: RouteContextWithId) {
  if (isDemoMode(req.url)) return bad("Demo mode — changes are disabled", 403);

  const id = await getIdFromContext(ctx);
  if (!id) return bad("Missing case id");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const patch: Record<string, any> = {};
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.status !== undefined) patch.status = String(body.status).trim();
  if (body.practice_id !== undefined) patch.practice_id = body.practice_id || null;
  if (body.therapist_id !== undefined) patch.therapist_id = body.therapist_id || null;

  if (Object.keys(patch).length === 0) {
    return bad("No fields to update (send title, status, practice_id, and/or therapist_id)");
  }

  const { data, error } = await supabase
    .from("cases")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}

export async function DELETE(_req: Request, ctx: RouteContextWithId) {
  if (isDemoMode(_req.url)) return bad("Demo mode — changes are disabled", 403);

  const id = await getIdFromContext(ctx);
  if (!id) return bad("Missing case id");

  const { data, error } = await supabase.from("cases").delete().eq("id", id).select().single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}