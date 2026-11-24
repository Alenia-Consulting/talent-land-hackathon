import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";
import { PrefsProvider, THEME_SCRIPT } from "./prefs.tsx";

// Brand typefaces (Marca v1). A plain @import in the CSS is dropped by the production build, and
// next/font also keeps the visitor's browser from calling Google on every page.
const titulo = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-titulo-loaded",
});

// Atkinson Hyperlegible Next: drawn so that letters that usually blur into each other stay
// distinct. Variable, so the weights the design uses cost one file.
const texto = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-texto-loaded",
});

export const metadata: Metadata = {
  title: "Antesala",
  description: "Que ninguna visita sea la primera.",
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
      <head>
        {/* Before the first paint, so dim mode never flashes white. See app/prefs.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* Runtime configuration (window.__ENV__), see lib/config.ts */}
        <Script src="/env.js" strategy="beforeInteractive" />
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
