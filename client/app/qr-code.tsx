"use client";

// The QR, drawn from the matrix as one SVG path.
//
// It keeps black on white even in dim mode. A scanner expects dark modules on a light field with
// a quiet margin around them; a QR that honours the night theme is a QR that does not open.

import { useMemo } from "react";

import { encodeQr } from "../lib/pure/qr.ts";

/** The four light modules of margin the standard asks for around every code. */
const QUIET = 4;

export function QrCode({ text, label }: { text: string; label: string }) {
  const matrix = useMemo(() => {
    try {
      return encodeQr(text);
    } catch {
      return null;
    }
  }, [text]);

  if (!matrix) return null;

  const side = matrix.length + QUIET * 2;
  const path = matrix
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x + QUIET} ${y + QUIET}h1v1h-1z` : "")),
    )
    .join("");

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="h-auto w-full max-w-xs"
    >
      <rect width={side} height={side} fill="#ffffff" />
      <path d={path} fill="#15302b" />
    </svg>
  );
}
