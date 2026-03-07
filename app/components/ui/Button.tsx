"use client";

import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, rgba(107,130,212,0.22), rgba(107,130,212,0.08))",
    border: "1px solid rgba(107,130,212,0.35)",
    color: "#e2e8f0",
  },
  secondary: {
    background: "transparent",
    border: "1px solid #1f2533",
    color: "#9ca3af",
  },
  ghost: {
    background: "transparent",
    border: "1px solid transparent",
    color: "#6b7280",
  },
  danger: {
    background: "#1a0808",
    border: "1px solid #3d1a1a",
    color: "#f87171",
  },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: "5px 11px", fontSize: 12 },
  md: { padding: "9px 16px", fontSize: 13 },
};

export default function Button({
  variant = "secondary",
  size = "md",
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  return (
    <button
      disabled={disabled}
      style={{
        borderRadius: 9,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        transition: "all 0.15s ease",
        ...v,
        ...s,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
