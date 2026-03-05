// app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import DemoBanner from "./demo/DemoBanner";

export const metadata: Metadata = {
  title: "empathAI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}