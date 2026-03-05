// app/api/tasks/route.ts
// Single-query endpoint for fetching all tasks (replaces N+1 client-side fetching)
import { supabase } from "@/lib/supabase";
import { bad, ok } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoTasks } from "@/lib/demo/demoData";

export async function GET(req: Request) {
  if (isDemoMode(req.url)) {
    return ok(demoTasks);
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("id, case_id, assigned_to_role, assigned_to_id, created_by, title, description, status, due_date, source_checkin_id, redaction_flags, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return bad(error.message, 500, error);
  return ok(data);
}
