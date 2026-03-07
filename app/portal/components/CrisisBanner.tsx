"use client";

import { useMemo } from "react";

const CRISIS_PATTERNS = [
  /\b(sui[c]id[ea]l?|kill\s*(my|him|her|them)?self|end\s*(my\s*life|it\s*all|things)|don[''\u2019]?t\s*want\s*to\s*(live|be\s*alive|be\s*here|go\s*on)|(?:hurt|harm)(?:ing)?\s*(my|him|her|them)?self|self[\s-]?harm)\b/i,
  /\b(want\s*to\s*die(\b\s*$|\s*[.!?,;]|\s+myself)|want\s*to\s*hurt\s*myself|better\s*off\s*dead|no\s*(point|reason)\s*(to|in)\s*(live|living|go\s*on)|can[''\u2019]?t\s*go\s*on(\b\s*$|\s*[.!?,;]|\s+(anymore|like\s*this|living)))/im,
  /\b(i[''\u2019]?m\s+not\s+safe|i\s+don[''\u2019]?t\s+feel\s+safe|i\s+feel\s+unsafe|i\s+am\s+not\s+safe)\b/i,
];

/** Returns true if text contains crisis-related language */
export function detectCrisisLanguage(text: string): boolean {
  if (!text || text.length < 5) return false;
  return CRISIS_PATTERNS.some(p => p.test(text));
}

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
