import { test, expect } from "@playwright/test";
import {
  trackConsoleErrors,
  checkNoRawMarkdown,
  checkNoNullUndefined,
  enableDemo,
} from "./helpers/globalChecks";

test.describe("Manager dashboard (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("loads and shows key sections", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/dashboard/manager?demo=true");
    await page.waitForLoadState("networkidle");

    // Practice name / dashboard title
    await expect(page.getByText("Practice Operations")).toBeVisible({ timeout: 10000 });

    // Stat tiles
    await expect(page.getByText("Practices")).toBeVisible();
    await expect(page.getByText("Active cases")).toBeVisible();
    await expect(page.getByText("Avg score")).toBeVisible();

    // AI Briefing card
    await expect(page.getByText("Operational Briefing")).toBeVisible();

    console.assertNoErrors();
  });

  test("AI briefing renders without raw markdown", async ({ page }) => {
    await page.goto("/dashboard/manager?demo=true");

    // Wait for AI briefing to load (skeleton disappears, text appears)
    await page.waitForSelector("text=Operational Briefing", { timeout: 10000 });

    // Wait for briefing content to appear (either parsed sections or raw text)
    // Give the word-by-word animation time to complete
    await page.waitForTimeout(3000);

    await checkNoRawMarkdown(page);
  });

  test("no null/undefined text on page", async ({ page }) => {
    await page.goto("/dashboard/manager?demo=true");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await checkNoNullUndefined(page);
  });

  test("practice snapshot shows practice cards", async ({ page }) => {
    await page.goto("/dashboard/manager?demo=true");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Practice snapshot")).toBeVisible({ timeout: 10000 });

    // At least one practice card with "Open" link
    const openLinks = page.getByText("Open →");
    await expect(openLinks.first()).toBeVisible({ timeout: 10000 });
  });
});
