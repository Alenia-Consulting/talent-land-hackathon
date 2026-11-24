import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";

// Brand typefaces (Marca v1). A plain @import in the CSS is dropped by the production build, and
// next/font also keeps the visitor's browser from calling Google on every page.
const titulo = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-titulo-loaded",
});

const texto = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-texto-loaded",
});

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
    <html lang="es" className={`${titulo.variable} ${texto.variable}`}>
      <body>
        {/* Runtime configuration (window.__ENV__), see lib/config.ts */}
        <Script src="/env.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
