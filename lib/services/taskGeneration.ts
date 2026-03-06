// lib/services/taskGeneration.ts
// Manual task management. AI task generation has been removed.

import { scrubPrompt } from "./redaction";
import { supabaseAdmin } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in_progress" | "completed" | "dismissed";

export interface Task {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualTaskInput {
  caseId: string;
  title: string;
  description?: string;
  assignedToRole: "therapist" | "patient";
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

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert([{
      case_id: input.caseId,
      title: titleScrub.text,
      description: descScrub?.text ?? null,
      status: "pending",
      assignee: input.assignedToRole,
      due_date: input.dueDate ? clampDueDate(input.dueDate) : null,
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

  // Validate: the therapist owns the case
  const caseData = (task as Record<string, unknown>).cases as Record<string, unknown> | undefined;
  const isTherapist = caseData?.therapist_id === userId;

  if (!isTherapist) {
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
