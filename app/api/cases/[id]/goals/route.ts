// app/api/cases/[id]/goals/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCaseGoals } from "@/lib/demo/demoData";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  if (isDemoMode(_req.url)) return ok(getDemoCaseGoals(caseId));

  const { data, error } = await supabase
    .from("goals")
    .select("id, case_id, title, status, target_date, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return bad(error.message, 400, error);
  return ok(data);
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  if (isDemoMode(req.url)) {
    // Demo mode: create locally
    const body: any = await req.json().catch(() => ({}));
    return ok({
      id: `demo-goal-${Date.now()}`,
      case_id: caseId,
      title: body.title ?? "",
      status: body.status ?? "active",
      target_date: body.target_date ?? null,
      created_at: new Date().toISOString(),
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const title = String(body.title ?? "").trim();
  const status = String(body.status ?? "active").trim();
  const target_date = body.target_date ? String(body.target_date).trim() : null;

  if (!title) return bad("Missing title");

  const { data, error } = await supabase
    .from("goals")
    .insert([{ case_id: caseId, title, status, target_date }])
    .select()
    .single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}

export async function PATCH(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  if (isDemoMode(req.url)) return ok({ success: true });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const goalId = body.goalId;
  if (!goalId) return bad("Missing goalId");

  const patch: Record<string, any> = {};
  if (body.status !== undefined) patch.status = String(body.status).trim();
  if (body.title !== undefined) patch.title = String(body.title).trim();

  if (Object.keys(patch).length === 0) return bad("No fields to update");

  const { data, error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", goalId)
    .eq("case_id", caseId)
    .select()
    .single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}