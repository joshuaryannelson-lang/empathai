import { test, expect } from "@playwright/test";
import { trackConsoleErrors, enableDemo } from "./helpers/globalChecks";

test.describe("Patient portal (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("patient page loads", async ({ page }) => {
    const console = trackConsoleErrors(page);
    await page.goto("/patient?demo=true");
    await page.waitForLoadState("networkidle");

    // Page should render content
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    console.assertNoErrors();
  });
});
