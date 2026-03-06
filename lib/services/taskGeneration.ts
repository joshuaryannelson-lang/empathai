// lib/services/taskGeneration.ts
// Manual task management. AI task generation has been removed.

import { scrubPrompt } from "./redaction";
import { supabaseAdmin } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in_progress" | "completed" | "dismissed";

export interface Task {
  id: string;
  case_id: string;
  assigned_to_role: "therapist" | "patient";
  assigned_to_id: string | null;
  created_by: "ai" | "therapist" | "system";
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  source_checkin_id: string | null;
  redaction_flags: string[];
  created_at: string;
  updated_at: string;
}

export interface ManualTaskInput {
  caseId: string;
  title: string;
  description?: string;
  assignedToRole: "therapist" | "patient";
  assignedToId?: string;
  dueDate?: string;
  therapistId: string;
}

// ── Max due date (7 days out) ────────────────────────────────────────────────

function clampDueDate(dueDate?: string): string | undefined {
  if (!dueDate) return undefined;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  const max = maxDate.toISOString().slice(0, 10);
  return dueDate > max ? max : dueDate;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createManualTask(input: ManualTaskInput): Promise<Task> {
  const titleScrub = scrubPrompt(input.title);
  const descScrub = input.description ? scrubPrompt(input.description) : null;
  const redactionFlags = [
    ...titleScrub.redactions,
    ...(descScrub?.redactions ?? []),
  ];

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert([{
      case_id: input.caseId,
      assigned_to_role: input.assignedToRole,
      assigned_to_id: input.assignedToId ?? null,
      created_by: "therapist",
      title: titleScrub.text,
      description: descScrub?.text ?? null,
      status: "pending",
      due_date: input.dueDate ? clampDueDate(input.dueDate) : null,
      redaction_flags: redactionFlags,
    }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return data as Task;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  userId: string,
): Promise<Task> {
  // Fetch the task first to validate permissions
  const { data: task, error: fetchError } = await supabaseAdmin
    .from("tasks")
    .select("*, cases!inner(therapist_id)")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) throw new Error("Task not found");

  // Validate: either the therapist owns the case, or the patient is assigned
  const isTherapist = (task as Record<string, unknown>).cases &&
    ((task as Record<string, unknown>).cases as Record<string, unknown>).therapist_id === userId;
  const isAssignedPatient = task.assigned_to_role === "patient" && task.assigned_to_id === userId;

  if (!isTherapist && !isAssignedPatient) {
    throw new Error("Not authorized to update this task");
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update task: ${updateError.message}`);
  return updated as Task;
}
