// app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, DM_Mono, Sora } from "next/font/google";
import "./globals.css";
import DemoTourOverlay from "./components/DemoTourOverlay";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "empathAI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${sora.variable}`}>
      <body>
        {children}
        <DemoTourOverlay />
      </body>
    </html>
  );
}
