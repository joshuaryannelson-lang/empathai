// app/api/analytics/engagement/route.ts
// Returns weekly patient engagement aggregates. PHI-safe: counts only, no identifiers.
export const dynamic = "force-dynamic";

import { ok, bad } from "@/lib/route-helpers";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoCheckins } from "@/lib/demo/demoData";

type WeekRow = {
  week: string;
  total: number;
  uniquePatients: number;
  avgMood: number | null;
  completionRate: number;
};

export async function GET(req: Request) {
  try {
    if (isDemoMode(req.url)) {
      return ok({ weeks: buildDemoWeeks() });
    }

    const { data, error } = await supabase
      .from("checkins")
      .select("id, case_id, score, created_at")
      .order("created_at", { ascending: true })
      .limit(2000);

    if (error) return bad("Failed to fetch engagement data", 500);

    if (!data || data.length === 0) {
      return ok({ weeks: [] });
    }

    const weeks = groupByWeek(data);
    return ok({ weeks });
  } catch {
    return bad("Internal server error", 500);
  }
}

function getMondayISO(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface CheckinRow {
  id: string;
  case_id: string;
  score: number | null;
  created_at: string;
}

function groupByWeek(rows: CheckinRow[]): WeekRow[] {
  const weekMap = new Map<string, { total: number; patients: Set<string>; scores: number[] }>();

  for (const row of rows) {
    const week = getMondayISO(new Date(row.created_at));
    let entry = weekMap.get(week);
    if (!entry) {
      entry = { total: 0, patients: new Set(), scores: [] };
      weekMap.set(week, entry);
    }
    entry.total++;
    entry.patients.add(row.case_id);
    if (typeof row.score === "number") entry.scores.push(row.score);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, entry]) => ({
      week,
      total: entry.total,
      uniquePatients: entry.patients.size,
      avgMood: entry.scores.length > 0
        ? Math.round((entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) * 10) / 10
        : null,
      completionRate: 0, // Cannot compute without knowing expected count
    }));
}

function buildDemoWeeks(): WeekRow[] {
  const weekMap = new Map<string, { total: number; patients: Set<string>; scores: number[] }>();

  for (const ci of demoCheckins) {
    const week = getMondayISO(new Date(ci.created_at));
    let entry = weekMap.get(week);
    if (!entry) {
      entry = { total: 0, patients: new Set(), scores: [] };
      weekMap.set(week, entry);
    }
    entry.total++;
    entry.patients.add(ci.case_id);
    if (typeof ci.score === "number") entry.scores.push(ci.score);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, entry]) => ({
      week,
      total: entry.total,
      uniquePatients: entry.patients.size,
      avgMood: entry.scores.length > 0
        ? Math.round((entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) * 10) / 10
        : null,
      completionRate: Math.round((entry.patients.size / 12) * 100),
    }));
}
