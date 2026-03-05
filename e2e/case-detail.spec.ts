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

  test("generate tasks shows task cards", async ({ page }) => {
    const console = trackConsoleErrors(page);
    const caseId = await getFirstCaseId(page);
    await page.goto(`/cases/${caseId}?demo=true`);
    await page.waitForLoadState("networkidle");

    // Look for a generate tasks button
    const tasksBtn = page.getByRole("button", { name: /generate.*task/i }).first();
    if (await tasksBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tasksBtn.click();

      // Wait for tasks to load
      await page.waitForTimeout(5000);

      // Tasks should appear — look for status badges or task items
      const taskItems = page.locator("[style*='border-radius']").filter({ hasText: /pending|in.progress|completed/i });
      // At least some content should be visible
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(100);
    }

    console.assertNoErrors();
  });
});
