// app/api/cases/[id]/tasks/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { createManualTask } from "@/lib/services/taskGeneration";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCaseTasks } from "@/lib/demo/demoData";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  try {
    const caseId = await getIdFromContext(ctx);
    if (!caseId) return bad("Missing case id");

    if (isDemoMode(_req.url)) return ok(getDemoCaseTasks(caseId));

    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, case_id, title, description, status, assignee, due_date, created_at, updated_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(`[tasks] GET case_id=${caseId} error=${error.message}`, error);
      return bad(error.message, 500, error);
    }
    return ok(data);
  } catch (err: any) {
    console.error("[tasks] GET unhandled error:", err);
    return bad(err?.message ?? "Internal server error", 500);
  }
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  try {
    const caseId = await getIdFromContext(ctx);
    if (!caseId) return bad("Missing case id");

    // Demo mode: block writes
    if (isDemoMode(req.url)) {
      return bad("Demo mode — changes are disabled", 403);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON body");
    }

    const trigger = body.trigger as string;

    if (trigger === "manual") {
      const task = body.task;
      if (!task?.title?.trim()) return bad("Missing task title");
      if (!task?.assignedToRole) return bad("Missing assignedToRole");

      const created = await createManualTask({
        caseId,
        title: task.title,
        description: task.description,
        assignedToRole: task.assignedToRole,
        dueDate: task.dueDate,
        therapistId: body.therapistId ?? "",
      });
      return ok(created);
    }

    return bad("Invalid trigger — must be 'manual'");
  } catch (err: any) {
    console.error("[tasks] POST unhandled error:", err);
    return bad(err?.message ?? "Internal server error", 500);
  }
}
