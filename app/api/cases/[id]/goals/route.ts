// app/api/cases/[id]/goals/route.ts
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 400, error);
  return ok(data);
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

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