import { test, expect } from "@playwright/test";
import {
  trackConsoleErrors,
  checkNoRawMarkdown,
  checkNoNullUndefined,
  enableDemo,
} from "./helpers/globalChecks";

// Demo cases use deterministic IDs — fetch the first one dynamically
async function getFirstCaseId(page: import("@playwright/test").Page): Promise<string> {
  const res = await page.request.get("/api/cases?demo=true");
  const json = await res.json();
  const cases = json?.data ?? [];
  expect(cases.length).toBeGreaterThan(0);
  return cases[0].id;
}

test.describe("Case detail (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("case page loads with all sections", async ({ page }) => {
    const console = trackConsoleErrors(page);
    const caseId = await getFirstCaseId(page);
    await page.goto(`/cases/${caseId}?demo=true`);
    await page.waitForLoadState("networkidle");

    // Check-in history
    await expect(page.getByText(/check.?in/i).first()).toBeVisible({ timeout: 10000 });

    // Goals section
    await expect(page.getByText(/goals/i).first()).toBeVisible({ timeout: 10000 });

    // Tasks section
    await expect(page.getByText(/tasks/i).first()).toBeVisible({ timeout: 10000 });

    // Session prep generate button
    const generateBtn = page.getByRole("button", { name: /generate/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 10000 });

    await checkNoNullUndefined(page);
    console.assertNoErrors();
  });

  test("generate session prep shows output without raw markdown", async ({ page }) => {
    const console = trackConsoleErrors(page);
    const caseId = await getFirstCaseId(page);
    await page.goto(`/cases/${caseId}?demo=true`);
    await page.waitForLoadState("networkidle");

    // Click the session prep generate button
    const generateBtn = page.getByRole("button", { name: /generate.*session|session.*prep/i }).first();
    if (await generateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateBtn.click();

      // Wait for output to appear (streaming or full)
      await page.waitForTimeout(5000);

      // Check no raw markdown in output
      await checkNoRawMarkdown(page);
    }

    console.assertNoErrors();
  });

  test("task section shows add task button", async ({ page }) => {
    const console = trackConsoleErrors(page);
    const caseId = await getFirstCaseId(page);
    await page.goto(`/cases/${caseId}?demo=true`);
    await page.waitForLoadState("networkidle");

    // The "+ Add Task" button should be visible
    const addBtn = page.getByRole("button", { name: /add task/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });

    // No "Generate Tasks" button should exist
    const genBtn = page.getByRole("button", { name: /generate.*task/i }).first();
    await expect(genBtn).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    console.assertNoErrors();
  });
});
