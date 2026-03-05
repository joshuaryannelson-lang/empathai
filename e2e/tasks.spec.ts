import { test, expect } from "@playwright/test";
import {
  trackConsoleErrors,
  checkNoNullUndefined,
  enableDemo,
} from "./helpers/globalChecks";

test.describe("Tasks page (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("loads task list with filter controls", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/tasks?demo=true");
    await page.waitForLoadState("networkidle");

    // Wait for loading to finish
    await page.waitForTimeout(3000);

    // Page should have content
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    // Filter controls (select dropdowns)
    const selects = page.locator("select");
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(1);

    await checkNoNullUndefined(page);
    console.assertNoErrors();
  });
});
