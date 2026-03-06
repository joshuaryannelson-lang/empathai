// app/admin/status/components/PracticeSelector.tsx
// Practice selector dropdown for multi-practice managers.
// Hidden when practices.length <= 1.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Practice = { id: string; name: string };

export function PracticeSelector({
  practices,
  selectedId,
  onChange,
  allLabel = "All practices",
}: {
  practices: Practice[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  allLabel?: string;
}) {
  // ALL hooks first — before any conditional returns
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options: Array<{ id: string | null; name: string }> = [
    { id: null, name: allLabel },
    ...practices.map((p) => ({ id: p.id, name: p.name })),
  ];

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setFocusIdx(0);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < options.length) {
          onChange(options[focusIdx].id);
          setOpen(false);
        }
      }
    },
    [open, focusIdx, options, onChange],
  );

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusIdx < 0) return;
    const el = listRef.current?.children[focusIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [focusIdx, open]);

  // Hidden for single-practice managers — AFTER all hooks
  if (practices.length <= 1) return null;

  const selectedLabel = selectedId
    ? practices.find((p) => p.id === selectedId)?.name ?? allLabel
    : allLabel;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setFocusIdx(-1); }}
        onKeyDown={handleKeyDown}
        className="practice-selector-trigger"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          cursor: "pointer",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "#e2e8f0",
          whiteSpace: "nowrap",
          transition: "border-color 0.15s ease",
        }}
      >
        {/* Dot */}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: selectedId ? "#fff" : "#00c8a0",
            boxShadow: selectedId ? "none" : "0 0 6px #00c8a0",
            flexShrink: 0,
          }}
        />
        {selectedLabel}
        {/* Chevron */}
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginLeft: 2 }}>
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-activedescendant={focusIdx >= 0 ? `ps-opt-${focusIdx}` : undefined}
          onKeyDown={handleKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 100,
            minWidth: 220,
            maxHeight: 240,
            overflowY: "auto",
            background: "#0d1018",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: "4px 0",
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.id === selectedId;
            const isFocused = i === focusIdx;
            return (
              <div
                key={opt.id ?? "__all"}
                id={`ps-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                onMouseEnter={() => setFocusIdx(i)}
                style={{
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  color: isSelected ? "#00c8a0" : isFocused ? "#e2e8f0" : "#9ca3af",
                  background: isFocused ? "rgba(255,255,255,0.05)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.1s ease, color 0.1s ease",
                }}
              >
                <span>{opt.name}</span>
                {isSelected && (
                  <span style={{ color: "#00c8a0", fontSize: 14, flexShrink: 0, marginLeft: 12 }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .practice-selector-trigger:hover {
          border-color: rgba(255,255,255,0.15) !important;
        }
        .practice-selector-trigger:focus-visible {
          outline: 2px solid rgba(56,189,248,0.5);
          outline-offset: 2px;
        }
        @media (max-width: 640px) {
          .practice-selector-trigger { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
