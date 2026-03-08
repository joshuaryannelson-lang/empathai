"use client";

import { useEffect, useState } from "react";

type WeekData = {
  week: string;
  total: number;
  uniquePatients: number;
  avgMood: number | null;
  completionRate: number;
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      border: "1px solid #1a2035",
      borderRadius: 14,
      padding: "16px 18px",
      background: "#0d1018",
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: "#f1f5f9" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniLineChart({ data, width = 480, height = 180 }: { data: WeekData[]; width?: number; height?: number }) {
  if (data.length < 2) return null;

  const values = data.map(d => d.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padX = 40;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * chartW;
    const y = padY + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillD = `M${padX},${padY + chartH} ${pathD.replace("M", "L")} L${pts[pts.length - 1].x.toFixed(1)},${padY + chartH}Z`;

  // Y-axis labels
  const yLabels = [min, Math.round((min + max) / 2), max];

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b82d4" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6b82d4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v, i) => {
        const y = padY + chartH - ((v - min) / range) * chartH;
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
            <text x={padX - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={10} fontFamily="var(--font-dm-mono), monospace">{v}</text>
          </g>
        );
      })}

      {/* X-axis labels (show first, middle, last) */}
      {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
        <text key={i} x={pts[i].x} y={height - 4} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="var(--font-dm-mono), monospace">
          {data[i].week.slice(5)}
        </text>
      ))}

      {/* Fill area */}
      <path d={fillD} fill="url(#engagementFill)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#6b82d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#6b82d4" />
          <circle cx={p.x} cy={p.y} r="7" fill="#6b82d4" opacity="0.15" />
        </g>
      ))}
    </svg>
  );
}

function SkeletonBlock({ h = 180 }: { h?: number }) {
  return (
    <div style={{
      height: h,
      borderRadius: 14,
      background: "rgba(255,255,255,0.04)",
      animation: "skeleton-shimmer 2s infinite linear",
      backgroundSize: "200% 100%",
      backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
    }} />
  );
}

export default function EngagementModule() {
  const [weeks, setWeeks] = useState<WeekData[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/analytics/engagement");
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setWeeks(json.data?.weeks ?? []);
      } catch {
        if (!cancelled) setWeeks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <SkeletonBlock h={80} />
          <SkeletonBlock h={80} />
          <SkeletonBlock h={80} />
        </div>
        <SkeletonBlock h={200} />
      </div>
    );
  }

  if (!weeks || weeks.length < 2) {
    return (
      <div style={{
        border: "1px solid #1a2035",
        borderRadius: 14,
        padding: "40px 24px",
        background: "#0d1018",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>No check-in data yet</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Engagement trends will appear here once patients have submitted check-ins across at least 2 weeks.
        </div>
      </div>
    );
  }

  // Compute stats
  const totalCheckins = weeks.reduce((s, w) => s + w.total, 0);
  const avgWeekly = Math.round(totalCheckins / weeks.length);
  const highestWeek = weeks.reduce((best, w) => w.total > best.total ? w : best, weeks[0]);
  const avgMoods = weeks.map(w => w.avgMood).filter((m): m is number => m !== null);
  const overallAvgMood = avgMoods.length > 0
    ? (avgMoods.reduce((a, b) => a + b, 0) / avgMoods.length).toFixed(1)
    : "—";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard label="Avg weekly check-ins" value={String(avgWeekly)} sub={`${weeks.length} weeks tracked`} />
        <StatCard label="Highest week" value={String(highestWeek.total)} sub={highestWeek.week.slice(5)} />
        <StatCard label="Avg mood score" value={overallAvgMood} sub="across all weeks" />
      </div>

      {/* Chart */}
      <div style={{
        border: "1px solid #1a2035",
        borderRadius: 14,
        padding: "20px 16px 12px",
        background: "#0d1018",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 12, paddingLeft: 4 }}>
          Check-ins per week
        </div>
        <MiniLineChart data={weeks} />
      </div>
    </div>
  );
}
