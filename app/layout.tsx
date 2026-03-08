// app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import DemoTourOverlay from "./components/DemoTourOverlay";
import { Suspense } from "react";
import DemoStorageGuard from "./components/DemoStorageGuard";

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
        <Suspense><DemoStorageGuard /></Suspense>
      </body>
    </html>
  );
}