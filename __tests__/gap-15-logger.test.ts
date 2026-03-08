// __tests__/gap-15-logger.test.ts
// GAP-15: Verify safeLog strips PHI patterns before output.

import { safeLog } from "@/lib/logger";

describe("safeLog PHI redaction", () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("redacts case codes (EMP-XXXX)", () => {
    safeLog.warn("Processing case EMP-AB1234");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CASE_CODE]")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.not.stringContaining("EMP-AB1234")
    );
  });

  test("redacts email addresses", () => {
    safeLog.error("User email: patient@example.com failed");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[EMAIL]")
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.not.stringContaining("patient@example.com")
    );
  });

  test("redacts phone numbers", () => {
    safeLog.warn("Contact at 555-123-4567 unreachable");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[PHONE]")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.not.stringContaining("555-123-4567")
    );
  });

  test("redacts join codes in context", () => {
    safeLog.warn("Invalid join code ABC12345 submitted");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[JOIN_CODE]")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.not.stringContaining("ABC12345")
    );
  });

  test("redacts case codes in structured data", () => {
    safeLog.warn("Event occurred", { case_code: "EMP-XY9999", event: "test" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CASE_CODE]")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.not.stringContaining("EMP-XY9999")
    );
  });

  test("redacts check-in data blobs", () => {
    safeLog.warn("Check-in data", { blob: { mood: "sad", notes: "feeling bad", responses: [] } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CHECKIN_DATA]")
    );
  });

  test("info() is suppressed in production", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      safeLog.info("Should not appear");
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test("warn() still emits in production", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      safeLog.warn("Should appear");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
