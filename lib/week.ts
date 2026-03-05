// lib/week.ts

export function assertYYYYMMDD(dateStr: string) {
  // Very small guardrail: "2026-03-03"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${dateStr}`);
  }
}

/**
 * Given any YYYY-MM-DD, returns the Monday bucket (YYYY-MM-DD).
 * Uses UTC to avoid timezone surprises.
 */
export function toMondayISO(dateStr: string): string {
  assertYYYYMMDD(dateStr);

  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);

  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diffToMonday = (day + 6) % 7; // Monday => 0
  d.setUTCDate(d.getUTCDate() - diffToMonday);

  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}