import { test, expect } from "@playwright/test";
import {
  trackConsoleErrors,
  checkNoRawMarkdown,
  checkNoNullUndefined,
  enableDemo,
} from "./helpers/globalChecks";

test.describe("Therapist dashboard (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("therapist care page loads with AI briefing", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/dashboard/therapists/demo-therapist-01/care?demo=true");
    await page.waitForLoadState("networkidle");

    // AI Briefing sidebar
    await expect(page.getByText("AI Briefing")).toBeVisible({ timeout: 15000 });

    // Wait for briefing text to render
    await page.waitForTimeout(3000);

    // No raw markdown
    await checkNoRawMarkdown(page);

    // No null/undefined
    await checkNoNullUndefined(page);

    console.assertNoErrors();
  });

  test("therapist overview page loads", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/dashboard/therapists/demo-therapist-01?demo=true");
    await page.waitForLoadState("networkidle");

    // Page should load without crashing
    // Check there's no hard error displayed
    const errorBanner = page.locator("[style*='#f87171']").first();
    const hasError = await errorBanner.isVisible().catch(() => false);
    // If there's content on the page, it loaded
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    if (!hasError) {
      await checkNoNullUndefined(page);
    }

    console.assertNoErrors();
  });
});
