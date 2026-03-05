// app/api/tasks/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { updateTaskStatus, type TaskStatus } from "@/lib/services/taskGeneration";
import { isDemoMode } from "@/lib/demo/demoMode";

const VALID_STATUSES: TaskStatus[] = ["pending", "in_progress", "completed", "dismissed"];

export async function PATCH(req: Request, ctx: RouteContextWithId) {
  if (isDemoMode(req.url)) return bad("Demo mode — changes are disabled", 403);

  const taskId = await getIdFromContext(ctx);
  if (!taskId) return bad("Missing task id");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const status = body.status as TaskStatus;
  const userId = body.userId as string;

  if (!status || !VALID_STATUSES.includes(status)) {
    return bad(`Invalid status — must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (!userId) return bad("Missing userId");

  try {
    const updated = await updateTaskStatus(taskId, status, userId);
    return ok(updated);
  } catch (err: any) {
    const message = err?.message ?? "Failed to update task";
    const statusCode = message.includes("Not authorized") ? 403 : 500;
    return bad(message, statusCode);
  }
}
