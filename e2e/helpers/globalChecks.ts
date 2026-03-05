import { Page, expect } from "@playwright/test";

/**
 * Collect console errors during a test.
 * Call at the start of each test to attach a listener.
 * Returns a function to assert no errors were logged.
 */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known noisy errors from Next.js dev mode / hot reload
      if (text.includes("Fast Refresh") || text.includes("webpack")) return;
      errors.push(text);
    }
  });
  return {
    assertNoErrors() {
      expect(errors, `Console errors found: ${errors.join("\n")}`).toHaveLength(0);
    },
  };
}

/** Assert page does not show literal markdown heading markers (e.g. "# ") as visible text. */
export async function checkNoRawMarkdown(page: Page) {
  // Get all visible text content from the body
  const bodyText = await page.locator("body").innerText();
  const lines = bodyText.split("\n");
  const rawMarkdownLines = lines.filter(
    (line) => /^#{1,3}\s/.test(line.trim())
  );
  expect(
    rawMarkdownLines,
    `Found raw markdown heading(s): ${rawMarkdownLines.join(" | ")}`
  ).toHaveLength(0);
}

/** Assert page does not contain literal "undefined" or "null" as visible standalone text. */
export async function checkNoNullUndefined(page: Page) {
  // Check for standalone "undefined" or "null" text nodes (not inside code/pre/script)
  const badTexts = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (["script", "style", "code", "pre", "noscript"].includes(tag))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    const found: string[] = [];
    while (walker.nextNode()) {
      const text = (walker.currentNode.textContent ?? "").trim();
      if (text === "undefined" || text === "null") {
        found.push(`"${text}" in <${walker.currentNode.parentElement?.tagName}>`);
      }
    }
    return found;
  });
  expect(
    badTexts,
    `Found literal null/undefined text: ${badTexts.join(", ")}`
  ).toHaveLength(0);
}

/** Assert no horizontal scroll on the page. */
export async function checkNoHorizontalScroll(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth;
  });
  expect(hasOverflow, "Page has horizontal scroll overflow").toBe(false);
}

/** Enable demo mode via localStorage before navigating. */
export async function enableDemo(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("empathai_demo", "true");
  });
}
