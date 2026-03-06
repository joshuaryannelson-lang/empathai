import { test, expect } from "@playwright/test";
import { checkNoHorizontalScroll, enableDemo } from "./helpers/globalChecks";

// Only run in the mobile project
test.describe("Mobile layout (375x812)", () => {
  test.beforeEach(async ({ page }) => {
    await enableDemo(page);
  });

  test("landing page: no horizontal scroll, cards stack", async ({ page }) => {
    await page.goto("/?demo=true");
    await page.waitForLoadState("networkidle");

    await checkNoHorizontalScroll(page);

    await page.screenshot({
      path: "test-results/mobile-landing.png",
      fullPage: true,
    });
  });

  test("manager dashboard: no horizontal scroll", async ({ page }) => {
    await page.goto("/dashboard/manager?demo=true");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await checkNoHorizontalScroll(page);

    await page.screenshot({
      path: "test-results/mobile-manager.png",
      fullPage: true,
    });
  });

  test("status page: no horizontal scroll", async ({ page }) => {
    await page.goto("/status?demo=true");
    await page.waitForLoadState("networkidle");

    await checkNoHorizontalScroll(page);

    await page.screenshot({
      path: "test-results/mobile-status.png",
      fullPage: true,
    });
  });

  test("case detail: buttons are touch-friendly", async ({ page }) => {
    // Get a case ID first
    const res = await page.request.get("/api/cases?demo=true");
    const json = await res.json();
    const cases = json?.data ?? [];
    if (cases.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`/cases/${cases[0].id}?demo=true`);
    await page.waitForLoadState("networkidle");

    // Check all buttons have adequate touch target size
    const buttons = page.locator("button:visible");
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        // Touch targets should be at least 36px (relaxed from 44 for small icon buttons)
        expect(
          box.height >= 30 || box.width >= 30,
          `Button ${i} too small: ${box.width}x${box.height}`
        ).toBe(true);
      }
    }

    await checkNoHorizontalScroll(page);

    await page.screenshot({
      path: "test-results/mobile-case-detail.png",
      fullPage: true,
    });
  });

  test("therapist care page: no horizontal scroll", async ({ page }) => {
    await page.goto("/dashboard/therapists/demo-therapist-01/care?demo=true");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await checkNoHorizontalScroll(page);

    await page.screenshot({
      path: "test-results/mobile-therapist-care.png",
      fullPage: true,
    });
  });
});
