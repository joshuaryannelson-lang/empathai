// lib/utils/sanitize-error.ts
// Strips sensitive database details from error objects before logging.
// In production, only a safe opaque string is emitted.
// In development, the full error is appended for debugging.

/** Patterns that indicate Supabase/Postgres internals */
const TABLE_RE = /\b(from|into|update|delete\s+from|join|table)\s+["']?\w+["']?/gi;
const COLUMN_RE = /\bcolumn\s+["']?\w+["']?/gi;
const SQL_FRAGMENT_RE = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|JOIN|ALTER|CREATE|DROP|INDEX|CONSTRAINT)\b.*?(?=[;]|$)/gi;
const PGRST_CODE_RE = /PGRST\w+/g;
const PG_CODE_RE = /\b\d{2}[A-Z]\d{2}\b/g; // e.g. 42P01, 23505
const STACK_TRACE_RE = /\s+at\s+.+\(.+:\d+:\d+\)/g;
const ROW_DATA_RE = /"[^"]+"\s*:\s*"[^"]*"/g;

/** Known Postgres error code prefixes we preserve as opaque codes */
const ERROR_CODE_RE = /\b(\d{5})\b/;

function extractCode(input: string): string {
  const pgrst = input.match(PGRST_CODE_RE);
  if (pgrst) return pgrst[0];
  const pg = input.match(ERROR_CODE_RE);
  if (pg) return pg[1];
  const pgAlpha = input.match(PG_CODE_RE);
  if (pgAlpha) return pgAlpha[0];
  return "UNKNOWN";
}

/**
 * Sanitize an error for safe logging.
 * Returns a short opaque string in production.
 * In development, appends the full error for debugging.
 */
export function sanitizeError(err: unknown): string {
  const raw = errorToString(err);
  const code = extractCodeFromError(err) ?? extractCode(raw);
  const safe = `DB_ERROR:${code}`;

  if (process.env.NODE_ENV === "development") {
    return `${safe} | ${raw}`;
  }

  return safe;
}

function extractCodeFromError(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as Record<string, unknown>).code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return null;
}

function errorToString(err: unknown): string {
  if (err === null || err === undefined) return "null";
  if (typeof err === "string") return stripSensitive(err);
  if (err instanceof Error) {
    const base = stripSensitive(err.message);
    return base;
  }
  try {
    const json = JSON.stringify(err);
    return stripSensitive(json);
  } catch {
    return String(err);
  }
}

function stripSensitive(input: string): string {
  let result = input;
  result = result.replace(STACK_TRACE_RE, "");
  result = result.replace(SQL_FRAGMENT_RE, "[SQL]");
  result = result.replace(TABLE_RE, "[TABLE]");
  result = result.replace(COLUMN_RE, "[COLUMN]");
  result = result.replace(ROW_DATA_RE, "[DATA]");
  return result;
}
