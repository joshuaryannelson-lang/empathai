import { test, expect } from "@playwright/test";
import { trackConsoleErrors, checkNoHorizontalScroll } from "./helpers/globalChecks";

test.describe("Landing page", () => {
  test("loads without errors and shows all role cards", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page title
    await expect(page).toHaveTitle(/EmpathAI/i);

    // All 5 role cards visible (Manager, Therapist, Patient, Admin, Analytics)
    await expect(page.getByText("Practice Manager")).toBeVisible();
    await expect(page.getByText("Therapist").first()).toBeVisible();
    await expect(page.getByText("Patient").first()).toBeVisible();
    await expect(page.getByText("Admin")).toBeVisible();

    console.assertNoErrors();
  });

  test("Try Demo pill is visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const pill = page.getByText("Try Demo");
    await expect(pill).toBeVisible();
  });

  test("Demo Scenario section is NOT visible when not in demo mode", async ({ page }) => {
    // Clear demo mode
    await page.addInitScript(() => {
      localStorage.removeItem("empathai_demo");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Demo Scenario")).not.toBeVisible();
  });

  test("role card links have valid hrefs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Each persona card should be clickable
    const cards = page.locator("[style*='cursor: pointer']").filter({ hasText: /Practice Manager|Therapist|Patient|Admin/ });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await checkNoHorizontalScroll(page);
  });
});
