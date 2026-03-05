import { test, expect } from "@playwright/test";
import { trackConsoleErrors, enableDemo } from "./helpers/globalChecks";

test.describe("Demo mode", () => {
  test("/?demo=true shows demo banner and scenario section", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await enableDemo(page);
    await page.goto("/?demo=true");
    await page.waitForLoadState("networkidle");

    // Amber demo banner
    const banner = page.getByText("Demo Environment");
    await expect(banner).toBeVisible();

    // Demo Scenario section visible
    await expect(page.getByText("Demo Scenario")).toBeVisible();

    // Try Demo pill shows "Demo On"
    await expect(page.getByText("Demo On")).toBeVisible();

    console.assertNoErrors();
  });

  test("Try Demo pill activates demo and redirects to manager dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click Try Demo pill
    const pill = page.getByText("Try Demo");
    await pill.click();

    // Should redirect — wait for navigation away from landing
    await page.waitForURL(/\/(dashboard|practices|patient|admin)/, { timeout: 15000 });

    // Demo banner should be present
    await expect(page.getByText("Demo Environment")).toBeVisible({ timeout: 10000 });
  });

  test("/status?demo=true loads agent status page", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await enableDemo(page);
    await page.goto("/status?demo=true");
    await page.waitForLoadState("networkidle");

    // Page header
    await expect(page.getByText("Agent Status")).toBeVisible();

    // 6 service cards
    for (const label of [
      "Briefing Service",
      "Session Prep",
      "THS Scoring",
      "Task Generation",
      "Redaction Engine",
      "Risk Classification",
    ]) {
      await expect(page.getByText(label)).toBeVisible({ timeout: 10000 });
    }

    // Pilot readiness checklist
    await expect(page.getByText("Pilot Launch Gate")).toBeVisible();

    console.assertNoErrors();
  });

  test("Exit Demo returns to landing and clears demo state", async ({ page }) => {
    await enableDemo(page);
    await page.goto("/?demo=true");
    await page.waitForLoadState("networkidle");

    // Click Exit Demo
    const exitBtn = page.getByText("Exit Demo");
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();

    // Should redirect to landing
    await page.waitForURL("/", { timeout: 10000 });

    // Banner gone
    await expect(page.getByText("Demo Environment")).not.toBeVisible();

    // Scenario section hidden
    await expect(page.getByText("Demo Scenario")).not.toBeVisible();
  });
});
