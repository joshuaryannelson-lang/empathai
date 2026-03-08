"use client";

import { useMemo } from "react";
import { detectCrisisLanguage } from "@/lib/crisis-detection";

export { detectCrisisLanguage } from "@/lib/crisis-detection";

type Props = {
  visible: boolean;
};

export default function CrisisBanner({ visible }: Props) {
  if (!visible) return null;

  return (
    <div style={{
      padding: "14px 18px",
      borderRadius: 12,
      background: "rgba(248,113,113,0.08)",
      border: "1px solid rgba(248,113,113,0.3)",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>&#9888;&#65039;</span>
        <div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#f87171",
            marginBottom: 6,
          }}>
            If you are in crisis or having thoughts of suicide
          </div>
          <div style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.6,
          }}>
            Please contact the{" "}
            <strong style={{ color: "#f87171" }}>988 Suicide &amp; Crisis Lifeline</strong>{" "}
            by calling or texting <strong style={{ color: "#f87171" }}>988</strong>.
            You can also chat at{" "}
            <a
              href="https://988lifeline.org/chat/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#f87171", textDecoration: "underline" }}
            >
              988lifeline.org/chat
            </a>.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook to detect crisis language in a text value */
export function useCrisisDetection(text: string): boolean {
  return useMemo(() => detectCrisisLanguage(text), [text]);
}
