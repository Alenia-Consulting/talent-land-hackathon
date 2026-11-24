import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Antesala",
};

// viewport-fit=cover lets the recorder use env(safe-area-inset-*) on iPhones with a notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {/* Runtime configuration (window.__ENV__), see lib/config.ts */}
        <Script src="/env.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
