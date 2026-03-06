// lib/services/taskGeneration.ts
// AI-powered and manual task generation. All prompt construction is server-side only.

import { scrubPrompt, scrubOutput } from "./redaction";
import { logAiCall, hashPrompt } from "./audit";
import { type RiskSignal } from "./risk";
import { supabaseAdmin } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CheckIn {
  id?: string;
  score: number | null;
  created_at: string;
  note?: string | null;
  notes?: string | null;
}

export interface Goal {
  id: string;
  title: string;
  status: string;
}

export interface TaskInput {
  caseId: string;
  checkins: CheckIn[];
  goals: Goal[];
  riskSignal: RiskSignal;
  therapistId: string;
  existingOpenTasks?: Array<{ title: string; status: string }>;
}

export interface GeneratedTask {
  title: string;
  description: string;
  assignedToRole: "therapist" | "patient";
  dueDate?: string;
  sourceCheckinId?: string;
  redactionFlags: string[];
}

export interface TaskGenerationResult {
  tasks: GeneratedTask[];
  blocked: boolean;
  auditId: string;
}

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

// ── Prompt builder (private) ────────────────────────────────────────────────

function buildTaskPrompt(input: TaskInput): string {
  const { checkins, goals, riskSignal, existingOpenTasks } = input;

  const recentCheckins = checkins.slice(0, 4).map((c, i) => {
    const note = c.note || c.notes || "none";
    return `${i === 0 ? "latest" : `-${i}w`}: ${c.score ?? "—"}/10, "${note}"`;
  }).join("\n");

  const goalsBlock = goals.length
    ? goals.map(g => `[${g.status}] ${g.title}`).join("\n")
    : "(no goals)";

  const existingBlock = existingOpenTasks?.length
    ? `\nExisting open tasks (DO NOT duplicate):\n${existingOpenTasks.map(t => `- ${t.title}`).join("\n")}`
    : "";

  const today = new Date().toISOString().slice(0, 10);

  return `Generate 2-4 clinical tasks as JSON. Split: therapist follow-ups + patient homework. Concrete, actionable. No names. No diagnoses. Due within 7 days of ${today}.${riskSignal.level === "critical" ? ' CRITICAL: include "Follow up with patient before next session" for therapist.' : ""}

Risk: ${riskSignal.level} (${riskSignal.signal})${riskSignal.reasons.length ? ` — ${riskSignal.reasons.join("; ")}` : ""}
Check-ins:\n${recentCheckins || "(none)"}
Goals:\n${goalsBlock}${existingBlock}

JSON only: {"tasks":[{"title":"...","description":"...","assignedToRole":"therapist"|"patient","dueDate":"YYYY-MM-DD"}]}`;
}

// ── Call Anthropic (same pattern as briefing.ts) ─────────────────────────────

async function callAnthropic(prompt: string): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const model = "claude-haiku-4-5-20251001";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Anthropic API error (${res.status})`);
  }

  const text: string = json?.content?.[0]?.text ?? "";
  const inputTokens: number = json?.usage?.input_tokens ?? 0;
  const outputTokens: number = json?.usage?.output_tokens ?? 0;
  return { text, model, inputTokens, outputTokens };
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  if (model.includes("haiku")) {
    return (inputTokens * 0.80 + outputTokens * 4.00) / 1_000_000;
  }
  return (inputTokens * 3.00 + outputTokens * 15.00) / 1_000_000;
}

// ── Parse LLM response ──────────────────────────────────────────────────────

function parseTasks(raw: string): Array<{
  title: string;
  description: string;
  assignedToRole: "therapist" | "patient";
  dueDate?: string;
}> {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    // Validate and cap at 5
    return tasks.slice(0, 5).map((t: Record<string, unknown>) => ({
      title: String(t.title ?? "").trim(),
      description: String(t.description ?? "").trim(),
      assignedToRole: t.assignedToRole === "patient" ? "patient" as const : "therapist" as const,
      dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
    })).filter((t: { title: string }) => t.title.length > 0);
  } catch {
    return [];
  }
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

export async function generateTasks(input: TaskInput): Promise<TaskGenerationResult> {
  const { caseId, checkins, therapistId } = input;

  // 1. Build prompt with scrubbed check-in text
  const rawPrompt = buildTaskPrompt(input);
  const knownNames: string[] = [];
  const redactedPrompt = scrubPrompt(rawPrompt, knownNames);

  // 2. Call LLM
  let llmText: string;
  let model = "claude-haiku-4-5-20251001";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const result = await callAnthropic(redactedPrompt.text);
    llmText = result.text;
    model = result.model;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  } catch (err) {
    const auditId = crypto.randomUUID();
    void auditId; // used for tracing
    await logAiCall({
      service: "task-generation",
      case_code: caseId,
      triggered_by: `therapist:${therapistId}`,
      input_hash: hashPrompt(redactedPrompt.text),
      output_summary: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
      model,
      redaction_flags: redactedPrompt.redactions,
      blocked: true,
    });
    throw err;
  }

  // 3. Parse response
  const rawTasks = parseTasks(llmText);

  // 4. Scrub every output field
  let anyBlocked = false;
  const allRedactions = new Set(redactedPrompt.redactions);

  const tasks: GeneratedTask[] = rawTasks.map(t => {
    const titleScrub = scrubOutput(t.title, knownNames);
    const descScrub = scrubOutput(t.description, knownNames);
    if (titleScrub.blocked || descScrub.blocked) anyBlocked = true;
    for (const r of [...titleScrub.redactions, ...descScrub.redactions]) allRedactions.add(r);

    return {
      title: titleScrub.text,
      description: descScrub.text,
      assignedToRole: t.assignedToRole,
      dueDate: clampDueDate(t.dueDate),
      sourceCheckinId: checkins[0]?.id,
      redactionFlags: [...new Set([...titleScrub.redactions, ...descScrub.redactions])],
    };
  });

  // 5. Audit log
  const auditId = crypto.randomUUID();
  await logAiCall({
    service: "task-generation",
    case_code: caseId,
    triggered_by: `therapist:${therapistId}`,
    input_hash: hashPrompt(redactedPrompt.text),
    output_summary: `Generated ${tasks.length} tasks`,
    model,
    tokens_used: outputTokens,
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    estimated_cost_usd: estimateCost(model, inputTokens, outputTokens),
    redaction_flags: Array.from(allRedactions),
    blocked: anyBlocked,
  });

  return { tasks, blocked: anyBlocked, auditId };
}

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

export async function persistGeneratedTasks(
  caseId: string,
  therapistId: string,
  tasks: GeneratedTask[],
): Promise<Task[]> {
  if (tasks.length === 0) return [];

  const rows = tasks.map(t => ({
    case_id: caseId,
    assigned_to_role: t.assignedToRole,
    assigned_to_id: t.assignedToRole === "therapist" ? therapistId : null,
    created_by: "ai" as const,
    title: t.title,
    description: t.description || null,
    status: "pending" as const,
    due_date: t.dueDate ?? null,
    source_checkin_id: t.sourceCheckinId ?? null,
    redaction_flags: t.redactionFlags,
  }));

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to persist tasks: ${error.message}`);
  return (data ?? []) as Task[];
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
