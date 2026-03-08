"use client";

import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  borderRadius?: string | number;
}

const SHIMMER_STYLE = `
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

export default function Skeleton({
  width,
  height = 16,
  className,
  borderRadius = 12,
}: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width: width ?? "100%",
        height,
        borderRadius,
        background:
          "linear-gradient(90deg, #111420 0%, #1a1e2a 50%, #111420 100%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s ease-in-out infinite",
      }}
    />
  );
}

/** Full-page skeleton matching the dashboard layout */
export function SkeletonPage() {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "#080c12",
          padding: "40px 48px 80px",
        }}
      >
        <Skeleton width={200} height={12} />
        <div style={{ marginTop: 10 }}>
          <Skeleton width={280} height={28} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Skeleton width={180} height={14} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 36,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: "18px 22px",
                borderRadius: 12,
                border: "1px solid #1a2035",
                background: "#0d1018",
              }}
            >
              <Skeleton width={100} height={11} />
              <div style={{ marginTop: 12 }}>
                <Skeleton width={60} height={28} />
              </div>
              <div style={{ marginTop: 8 }}>
                <Skeleton width={140} height={12} />
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 36,
            borderRadius: 12,
            border: "1px solid #1a2035",
            background: "#0d1018",
            padding: "20px 22px",
          }}
        >
          <Skeleton width={160} height={14} />
          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 16, alignItems: "center" }}
              >
                <Skeleton width={80} height={14} />
                <Skeleton width={40} height={14} />
                <Skeleton width={60} height={14} />
                <Skeleton width={70} height={14} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
