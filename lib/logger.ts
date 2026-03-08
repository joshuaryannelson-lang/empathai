// lib/logger.ts
// Safe logging wrapper that strips PHI patterns before output.
// In production, suppresses debug logs entirely.

const CASE_CODE_RE = /EMP-[A-Z0-9]{4,}/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
const JOIN_CODE_CONTEXT_RE = /join\s*code[^a-z]*?([A-Z0-9]{6,8})/gi;

// Keys that indicate check-in data blobs (PHI-adjacent)
const CHECKIN_KEYS = new Set(["mood", "notes", "responses"]);

function isCheckinBlob(val: unknown): boolean {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const keys = Object.keys(val as Record<string, unknown>);
  return keys.some((k) => CHECKIN_KEYS.has(k));
}

function redactString(input: string): string {
  let result = input;
  result = result.replace(CASE_CODE_RE, "[CASE_CODE]");
  result = result.replace(EMAIL_RE, "[EMAIL]");
  result = result.replace(PHONE_RE, "[PHONE]");
  result = result.replace(JOIN_CODE_CONTEXT_RE, (match) =>
    match.replace(/[A-Z0-9]{6,8}/, "[JOIN_CODE]")
  );
  return result;
}

function redactValue(val: unknown): unknown {
  if (typeof val === "string") return redactString(val);
  if (Array.isArray(val)) return val.map(redactValue);
  if (val && typeof val === "object") {
    if (isCheckinBlob(val)) return "[CHECKIN_DATA]";
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = redactValue(v);
    }
    return out;
  }
  return val;
}

function formatArgs(message: string, data?: Record<string, unknown>): string {
  const safeMsg = redactString(message);
  if (!data) return safeMsg;
  const safeData = redactValue(data) as Record<string, unknown>;
  return `${safeMsg} ${JSON.stringify(safeData)}`;
}

const isProduction = () => process.env.NODE_ENV === "production";

export const safeLog = {
  /** Info-level log. Suppressed in production. */
  info(message: string, data?: Record<string, unknown>): void {
    if (isProduction()) return;
    console.log(formatArgs(message, data));
  },

  /** Warning-level log. Always emitted but redacted. */
  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(formatArgs(message, data));
  },

  /** Error-level log. Always emitted but redacted. */
  error(message: string, data?: Record<string, unknown>): void {
    console.error(formatArgs(message, data));
  },
};
