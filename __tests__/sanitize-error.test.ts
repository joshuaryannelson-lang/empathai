// __tests__/sanitize-error.test.ts
import { sanitizeError } from "@/lib/utils/sanitize-error";

describe("sanitizeError", () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: origEnv, writable: true });
  });

  function setProd() {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true });
  }

  function setDev() {
    Object.defineProperty(process.env, "NODE_ENV", { value: "development", writable: true });
  }

  it("returns opaque DB_ERROR string in production", () => {
    setProd();
    const result = sanitizeError(new Error("relation \"patients\" does not exist"));
    expect(result).toMatch(/^DB_ERROR:/);
    expect(result).not.toContain("patients");
  });

  it("strips table names from error messages", () => {
    setProd();
    const result = sanitizeError({ message: 'insert into "checkins" failed', code: "23505" });
    expect(result).not.toContain("checkins");
    expect(result).toContain("23505");
  });

  it("strips column names", () => {
    setProd();
    const result = sanitizeError("column email does not exist");
    expect(result).not.toContain("email");
  });

  it("strips PGRST codes but preserves them as error codes", () => {
    setProd();
    const result = sanitizeError({ message: "PGRST301: JWT expired", code: "PGRST301" });
    expect(result).toBe("DB_ERROR:PGRST301");
  });

  it("strips SQL fragments", () => {
    setProd();
    const result = sanitizeError("SELECT id, name FROM therapists WHERE practice_id = 'abc'");
    expect(result).not.toContain("therapists");
    expect(result).not.toContain("practice_id");
  });

  it("strips stack traces", () => {
    setProd();
    const err = new Error("test");
    err.stack = "Error: test\n    at Object.<anonymous> (/app/api/route.ts:10:5)";
    const result = sanitizeError(err);
    expect(result).not.toContain("/app/api/route.ts");
    expect(result).not.toContain("Object.<anonymous>");
  });

  it("strips row data patterns", () => {
    setProd();
    const result = sanitizeError('{"patient_name": "John Doe", "dob": "1990-01-01"}');
    expect(result).not.toContain("John Doe");
    expect(result).not.toContain("1990-01-01");
  });

  it("handles null/undefined", () => {
    setProd();
    expect(sanitizeError(null)).toMatch(/^DB_ERROR:/);
    expect(sanitizeError(undefined)).toMatch(/^DB_ERROR:/);
  });

  it("in development, appends full error details", () => {
    setDev();
    const result = sanitizeError({ message: "PGRST301: JWT expired", code: "PGRST301" });
    expect(result).toContain("DB_ERROR:PGRST301");
    expect(result).toContain("|");
  });

  it("handles Postgres error code 42P01", () => {
    setProd();
    const result = sanitizeError({ message: "relation does not exist", code: "42P01" });
    expect(result).toBe("DB_ERROR:42P01");
  });

  it("handles plain string errors", () => {
    setProd();
    const result = sanitizeError("something went wrong");
    expect(result).toMatch(/^DB_ERROR:/);
  });
});
