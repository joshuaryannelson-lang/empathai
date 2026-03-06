// __tests__/manager-practice-assignments.test.ts
// Tests for manager-practice assignment scoping logic.
// These test the API-level filtering that mirrors RLS behavior,
// using demo data fixtures.

import {
  demoPractices,
  demoManagerAssignments,
} from "@/lib/demo/demoData";
import { DEMO_CONFIG } from "@/lib/demo/demoMode";

// ── Simulate the scoping logic used by /api/practices and /api/admin/practice-status ──

function getAssignedPracticeIds(managerId: string): string[] {
  return demoManagerAssignments
    .filter(a => a.manager_id === managerId)
    .map(a => a.practice_id);
}

function getVisiblePractices(managerId: string | null) {
  if (!managerId) {
    // Admin: all practices
    return demoPractices;
  }
  const assignedIds = getAssignedPracticeIds(managerId);
  return demoPractices.filter(p => assignedIds.includes(p.id));
}

// ═══════════════════════════════════════════════════════════════════
// SUITE 8: Manager Practice Assignments
// ═══════════════════════════════════════════════════════════════════
describe("Suite 8: Manager Practice Assignments", () => {

  test("40a. Manager sees only assigned practices (2 of 3)", () => {
    const managerId = DEMO_CONFIG.managerId; // "demo-manager-01"
    const visible = getVisiblePractices(managerId);
    expect(visible).toHaveLength(2);
    const ids = visible.map(p => p.id);
    expect(ids).toContain(DEMO_CONFIG.practiceId);   // demo-practice-01
    expect(ids).toContain("demo-practice-02");
    expect(ids).not.toContain("demo-practice-03");
  });

  test("40b. Manager cannot see unassigned practice data", () => {
    const managerId = DEMO_CONFIG.managerId;
    const assignedIds = getAssignedPracticeIds(managerId);

    // Verify demo-practice-03 is NOT in the assigned list
    expect(assignedIds).not.toContain("demo-practice-03");

    // Simulate the practice-status scoping: if managerPracticeIds is set,
    // only data for those practices should be included
    const unassignedPractice = demoPractices.find(p => p.id === "demo-practice-03");
    expect(unassignedPractice).toBeDefined();
    expect(assignedIds.includes(unassignedPractice!.id)).toBe(false);
  });

  test("40c. Admin sees all practices (no manager_id filter)", () => {
    // Admin path: managerId = null → all practices returned
    const visible = getVisiblePractices(null);
    expect(visible).toHaveLength(3);
    const ids = visible.map(p => p.id);
    expect(ids).toContain(DEMO_CONFIG.practiceId);
    expect(ids).toContain("demo-practice-02");
    expect(ids).toContain("demo-practice-03");
  });

  test("40d. Unassigned manager gets empty array", () => {
    // A manager with no assignments at all
    const visible = getVisiblePractices("non-existent-manager-id");
    expect(visible).toHaveLength(0);
    expect(visible).toEqual([]);
  });
});
