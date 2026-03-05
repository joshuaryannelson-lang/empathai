// app/api/cases/[id]/tasks/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { classifyRisk } from "@/lib/services/risk";
import {
  generateTasks,
  persistGeneratedTasks,
  createManualTask,
  type CheckIn,
  type Goal,
} from "@/lib/services/taskGeneration";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCaseTasks } from "@/lib/demo/demoData";
import { getDemoTasks as getDemoAITasks } from "@/lib/demo/demoAI";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  if (isDemoMode(_req.url)) return ok(getDemoCaseTasks(caseId));

  const { data, error } = await supabase
    .from("tasks")
    .select("id, case_id, assigned_to_role, assigned_to_id, created_by, title, description, status, due_date, source_checkin_id, redaction_flags, created_at, updated_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return bad(error.message, 500, error);
  return ok(data);
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  // Demo mode: return canned tasks for AI trigger, block manual
  if (isDemoMode(req.url)) {
    const body: any = await req.json().catch(() => ({}));
    if (body.trigger === "ai") {
      const result = getDemoAITasks(caseId);
      const tasks = result.tasks.map((t, i) => ({
        id: `demo-gen-${caseId}-${i}`,
        case_id: caseId,
        assigned_to_role: t.assignedToRole,
        assigned_to_id: null,
        created_by: "ai",
        title: t.title,
        description: t.description,
        status: "pending",
        due_date: t.dueDate ?? null,
        source_checkin_id: t.sourceCheckinId ?? null,
        redaction_flags: t.redactionFlags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return ok({ tasks, blocked: result.blocked, auditId: result.auditId });
    }
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

    try {
      const created = await createManualTask({
        caseId,
        title: task.title,
        description: task.description,
        assignedToRole: task.assignedToRole,
        assignedToId: task.assignedToId,
        dueDate: task.dueDate,
        therapistId: body.therapistId ?? "",
      });
      return ok(created);
    } catch (err: any) {
      return bad(err?.message ?? "Failed to create task", 500);
    }
  }

  if (trigger === "ai") {
    const therapistId = body.therapistId as string;
    if (!therapistId) return bad("Missing therapistId for AI generation");

    try {
      // Fetch checkins for this case
      const { data: checkins } = await supabase
        .from("checkins")
        .select("id, score, created_at, note, notes")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch active goals only (filter completed before sending to AI)
      const { data: goals } = await supabase
        .from("goals")
        .select("id, title, status")
        .eq("case_id", caseId)
        .in("status", ["active", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch existing open tasks so AI avoids duplicates
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("title, status")
        .eq("case_id", caseId)
        .in("status", ["pending", "in_progress"])
        .limit(20);

      const checkinList: CheckIn[] = (checkins ?? []).map((c: any) => ({
        id: c.id,
        score: c.score,
        created_at: c.created_at,
        note: c.note,
        notes: c.notes,
      }));

      const goalList: Goal[] = (goals ?? []).map((g: any) => ({
        id: g.id,
        title: g.title,
        status: g.status,
      }));

      const riskSignal = classifyRisk(checkinList);

      const result = await generateTasks({
        caseId,
        checkins: checkinList,
        goals: goalList,
        riskSignal,
        therapistId,
        existingOpenTasks: (existingTasks ?? []).map((t: any) => ({ title: t.title, status: t.status })),
      });

      // Persist to DB
      const persisted = await persistGeneratedTasks(caseId, therapistId, result.tasks);

      return ok({
        tasks: persisted,
        blocked: result.blocked,
        auditId: result.auditId,
      });
    } catch (err: any) {
      return bad(err?.message ?? "Task generation failed", 500);
    }
  }

  return bad("Invalid trigger — must be 'ai' or 'manual'");
}
