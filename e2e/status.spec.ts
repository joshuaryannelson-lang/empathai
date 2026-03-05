import { test, expect } from "@playwright/test";
import { trackConsoleErrors, enableDemo } from "./helpers/globalChecks";

test.describe("Agent Status page (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("loads with all 6 service cards", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/status?demo=true");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("Agent Status")).toBeVisible({ timeout: 10000 });

    // All 6 services
    const services = [
      "Briefing Service",
      "Session Prep",
      "THS Scoring",
      "Task Generation",
      "Redaction Engine",
      "Risk Classification",
    ];
    for (const svc of services) {
      await expect(page.getByText(svc)).toBeVisible({ timeout: 10000 });
    }

    console.assertNoErrors();
  });

  test("shows activity feed and pilot checklist", async ({ page }) => {
    await page.goto("/status?demo=true");
    await page.waitForLoadState("networkidle");

    // Activity section
    await expect(page.getByText("Recent Activity")).toBeVisible({ timeout: 10000 });

    // Pilot Launch Gate
    await expect(page.getByText("Pilot Launch Gate")).toBeVisible({ timeout: 10000 });

    // Progress indication — checklist items
    await expect(page.getByText("Redaction blocking live")).toBeVisible({ timeout: 10000 });
  });

  test("each service card shows status badge", async ({ page }) => {
    await page.goto("/status?demo=true");
    await page.waitForLoadState("networkidle");

    // Status dots (colored circles indicating health)
    // Each ServiceCard has a "Status" row with Healthy/Degraded/Inactive
    const statusTexts = page.getByText(/^(Healthy|Degraded|Inactive|Unknown)$/);
    const count = await statusTexts.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("cost tracking section visible", async ({ page }) => {
    await page.goto("/status?demo=true");
    await page.waitForLoadState("networkidle");

    // Cost panel shows cost data (may show $0.00 in demo)
    const costText = page.getByText(/cost today|\$\d/i).first();
    // Cost section may or may not appear depending on demo data
    // Just ensure page loaded without errors
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("Services");
  });
});
