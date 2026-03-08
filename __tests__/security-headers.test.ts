/**
 * Security headers test suite (GAP-12)
 * Verifies next.config.ts security header configuration.
 */

// We test the config directly rather than making HTTP requests,
// since the headers are defined declaratively in next.config.ts.

import type { NextConfig } from "next";

let nextConfig: NextConfig;

beforeAll(async () => {
  // Dynamic import to get the config object
  const mod = await import("../next.config");
  nextConfig = mod.default;
});

describe("Security Headers (GAP-12)", () => {
  let headers: Array<{ key: string; value: string }>;

  beforeAll(async () => {
    expect(nextConfig.headers).toBeDefined();
    const headerEntries = await nextConfig.headers!();
    const catchAll = headerEntries.find(
      (entry) => entry.source === "/(.*)"
    );
    expect(catchAll).toBeDefined();
    headers = catchAll!.headers as Array<{ key: string; value: string }>;
  });

  function getHeader(name: string): string | undefined {
    return headers.find(
      (h) => h.key.toLowerCase() === name.toLowerCase()
    )?.value;
  }

  test("X-Frame-Options is DENY", () => {
    expect(getHeader("X-Frame-Options")).toBe("DENY");
  });

  test("X-Content-Type-Options is nosniff", () => {
    expect(getHeader("X-Content-Type-Options")).toBe("nosniff");
  });

  test("Referrer-Policy is strict-origin-when-cross-origin", () => {
    expect(getHeader("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  test("Permissions-Policy disables camera, microphone, geolocation", () => {
    expect(getHeader("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()"
    );
  });

  test("HSTS header present with max-age >= 31536000", () => {
    const hsts = getHeader("Strict-Transport-Security");
    expect(hsts).toBeDefined();
    const maxAgeMatch = hsts!.match(/max-age=(\d+)/);
    expect(maxAgeMatch).not.toBeNull();
    expect(Number(maxAgeMatch![1])).toBeGreaterThanOrEqual(31536000);
  });

  test("Content-Security-Policy is present", () => {
    const csp = getHeader("Content-Security-Policy");
    expect(csp).toBeDefined();
  });

  test("CSP includes frame-ancestors 'none'", () => {
    const csp = getHeader("Content-Security-Policy")!;
    const directives = csp.split(";").map((d) => d.trim());
    const frameAncestors = directives.find((d) =>
      d.startsWith("frame-ancestors")
    );
    expect(frameAncestors).toBe("frame-ancestors 'none'");
  });

  test("All 6 security headers are present", () => {
    const requiredHeaders = [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "Content-Security-Policy",
    ];
    for (const name of requiredHeaders) {
      expect(getHeader(name)).toBeDefined();
    }
  });
});
