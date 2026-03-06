// app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import DemoTourOverlay from "./components/DemoTourOverlay";

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
        {children}
        <DemoTourOverlay />
      </body>
    </html>
  );
}