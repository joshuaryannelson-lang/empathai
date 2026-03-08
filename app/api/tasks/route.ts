// app/api/tasks/route.ts
// Single-query endpoint for fetching all tasks (replaces N+1 client-side fetching)
import { supabaseAdmin } from "@/lib/supabase";
import { bad, ok } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoTasks } from "@/lib/demo/demoData";
import { sanitizeError } from "@/lib/utils/sanitize-error";

export async function GET(req: Request) {
  try {
    if (isDemoMode(req.url)) {
      return ok(demoTasks);
    }

    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, case_id, title, description, status, assignee, due_date, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[tasks] GET all", sanitizeError(error));
      return bad("Internal server error", 500);
    }
    return ok(data);
  } catch (err: any) {
    console.error("[tasks] GET all", sanitizeError(err));
    return bad(err?.message ?? "Internal server error", 500);
  }
}
