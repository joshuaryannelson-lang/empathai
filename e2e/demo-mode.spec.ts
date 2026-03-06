import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/globalChecks";

test.describe("Demo page", () => {
  test("/demo loads investor page with persona cards and tour", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/demo");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("See EmpathAI")).toBeVisible();

    // Synthetic data disclaimer
    await expect(page.getByText("synthetic")).toBeVisible();

    // Three persona cards
    await expect(page.getByText("Practice Manager")).toBeVisible();
    await expect(page.getByText("Therapist")).toBeVisible();
    await expect(page.getByText("Patient")).toBeVisible();

    // Guided tour section with start button
    await expect(page.getByText("Guided Tour")).toBeVisible();
    await expect(page.getByText("Step 1")).toBeVisible();
    await expect(page.getByText("Step 5")).toBeVisible();
    await expect(page.getByRole("button", { name: /start guided tour/i })).toBeVisible();

    // Footer CTA
    await expect(page.getByText("Interested in EmpathAI")).toBeVisible();

    console.assertNoErrors();
  });

  test("/status?demo=true loads agent status page", async ({ page }) => {
    const console = trackConsoleErrors(page);
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
});
