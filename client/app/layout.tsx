import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Antesala",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/* Runtime configuration (window.__ENV__), see lib/config.ts */}
        <Script src="/env.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
