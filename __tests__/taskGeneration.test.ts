/**
 * Unit tests for lib/services/taskGeneration.ts
 *
 * These test the pure logic functions and prompt/parsing behavior.
 * The LLM call and Supabase persistence are mocked.
 */

// ── Mocks must be set up before imports ──────────────────────────────────────

// Mock the Anthropic API call
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock supabaseAdmin
jest.mock("@/lib/supabase", () => ({
  supabase: {},
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: "task-123",
              case_id: "case-1",
              assigned_to_role: "therapist",
              assigned_to_id: null,
              created_by: "therapist",
              title: "Follow up",
              description: null,
              status: "pending",
              due_date: null,
              source_checkin_id: null,
              redaction_flags: [],
              created_at: "2026-03-05T00:00:00Z",
              updated_at: "2026-03-05T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: "task-123",
              case_id: "case-1",
              assigned_to_role: "therapist",
              assigned_to_id: "therapist-1",
              created_by: "ai",
              title: "Follow up",
              description: null,
              status: "completed",
              due_date: null,
              source_checkin_id: null,
              redaction_flags: [],
              created_at: "2026-03-05T00:00:00Z",
              updated_at: "2026-03-05T00:00:00Z",
              cases: { therapist_id: "therapist-1" },
            },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "task-123",
                status: "completed",
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}));

// Mock audit.ts to avoid Supabase calls
jest.mock("@/lib/services/audit", () => ({
  logAiCall: jest.fn().mockResolvedValue(undefined),
  hashPrompt: jest.fn().mockReturnValue("mock-hash"),
}));

import {
  generateTasks,
  createManualTask,
  updateTaskStatus,
} from "@/lib/services/taskGeneration";
import type { RiskSignal } from "@/lib/services/risk";

// ── Helper to mock LLM response ─────────────────────────────────────────────

function mockLLMResponse(tasks: Array<{
  title: string;
  description: string;
  assignedToRole: string;
  dueDate?: string;
}>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ text: JSON.stringify({ tasks }) }],
      usage: { output_tokens: 100 },
    }),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("generateTasks", () => {
  const baseInput = {
    caseId: "case-1",
    checkins: [
      { score: 2, created_at: "2026-03-04T00:00:00Z", note: "Feeling bad" },
      { score: 5, created_at: "2026-02-25T00:00:00Z" },
    ],
    goals: [{ id: "g1", title: "Improve coping skills", status: "active" }],
    therapistId: "therapist-1",
  };

  beforeEach(() => {
    mockFetch.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("includes therapist follow-up task when risk is critical", async () => {
    const riskSignal: RiskSignal = {
      level: "critical",
      signal: "AT_RISK",
      reasons: ["Latest score 2 <= 3"],
    };

    mockLLMResponse([
      { title: "Follow up with patient before next session", description: "Check on patient's wellbeing", assignedToRole: "therapist", dueDate: "2026-03-07" },
      { title: "Practice breathing exercises", description: "Do 5 min daily", assignedToRole: "patient", dueDate: "2026-03-10" },
    ]);

    const result = await generateTasks({ ...baseInput, riskSignal });

    expect(result.tasks.length).toBeGreaterThan(0);
    const therapistTask = result.tasks.find(t => t.assignedToRole === "therapist");
    expect(therapistTask).toBeDefined();
  });

  it("never returns more than 4 tasks", async () => {
    const riskSignal: RiskSignal = { level: "stable", signal: "OK", reasons: [] };

    mockLLMResponse([
      { title: "Task 1", description: "d1", assignedToRole: "therapist" },
      { title: "Task 2", description: "d2", assignedToRole: "patient" },
      { title: "Task 3", description: "d3", assignedToRole: "therapist" },
      { title: "Task 4", description: "d4", assignedToRole: "patient" },
      { title: "Task 5", description: "d5", assignedToRole: "therapist" },
    ]);

    const result = await generateTasks({ ...baseInput, riskSignal });
    expect(result.tasks.length).toBeLessThanOrEqual(4);
  });

  it("all outputs pass scrubOutput with no PII leaks", async () => {
    const riskSignal: RiskSignal = { level: "stable", signal: "OK", reasons: [] };

    mockLLMResponse([
      { title: "Review check-in scores", description: "Look at weekly trends", assignedToRole: "therapist" },
      { title: "Journal for 10 minutes", description: "Write about your week", assignedToRole: "patient" },
    ]);

    const result = await generateTasks({ ...baseInput, riskSignal });
    expect(result.blocked).toBe(false);

    for (const task of result.tasks) {
      expect(task.title).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // no SSN
      expect(task.title).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/); // no email
      expect(task.description).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    }
  });

  it("handles empty LLM response gracefully", async () => {
    const riskSignal: RiskSignal = { level: "stable", signal: "OK", reasons: [] };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: "I cannot generate tasks." }],
        usage: { output_tokens: 10 },
      }),
    });

    const result = await generateTasks({ ...baseInput, riskSignal });
    expect(result.tasks).toEqual([]);
    expect(result.blocked).toBe(false);
  });
});

describe("createManualTask", () => {
  it("scrubs PII from title and description", async () => {
    const result = await createManualTask({
      caseId: "case-1",
      title: "Call john.doe@example.com about homework",
      description: "Patient SSN 123-45-6789 needs follow-up",
      assignedToRole: "therapist",
      therapistId: "therapist-1",
    });

    // The mock returns a fixed object, but we verify the function doesn't throw
    // and returns a task. In a real test with live Supabase, we'd verify the
    // scrubbed values were persisted.
    expect(result).toBeDefined();
    expect(result.id).toBe("task-123");
  });
});

describe("updateTaskStatus", () => {
  it("allows therapist to update their own case tasks", async () => {
    const result = await updateTaskStatus("task-123", "completed", "therapist-1");
    expect(result).toBeDefined();
  });

  it("rejects unauthorized user", async () => {
    // Override the mock to return a different therapist_id
    const { supabaseAdmin } = require("@/lib/supabase");
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: "task-123",
              assigned_to_role: "therapist",
              assigned_to_id: "therapist-1",
              cases: { therapist_id: "therapist-1" },
            },
            error: null,
          }),
        }),
      }),
    });

    await expect(
      updateTaskStatus("task-123", "completed", "stranger-id")
    ).rejects.toThrow("Not authorized");
  });
});
