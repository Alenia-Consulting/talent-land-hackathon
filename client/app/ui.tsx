// Shared pieces of the brand, so the panel and the public guide look like one product.
//
// Two rules from the design live here and should not be undone:
//   · a button is at least 56 px tall with an 18 px radius, and always carries text;
//   · a noise level is never colour alone — bars, word and colour together, because colour
//     alone is invisible to a part of the people this product is for.

import type { ReactNode } from "react";

import { es } from "../lib/i18n/es.ts";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-5 ${className}`}>{children}</div>;
}

/** Small uppercase section label, the way the design separates blocks. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 mb-3 text-base font-bold tracking-widest text-pino uppercase">{children}</h2>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const colors =
    variant === "primary"
      ? "bg-pino text-white"
      : "bg-white text-pino border-2 border-pino";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 rounded-[18px] px-6 text-lg font-bold disabled:opacity-45 ${colors}`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ambar/35 text-[#7a4b00]",
  needs_review: "bg-coral/20 text-[#9c3a22]",
  published: "bg-salvia text-pino",
};

export function StatusChip({ status }: { status: string }) {
  const label = es.panel.statuses[status as keyof typeof es.panel.statuses] ?? status;
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-base font-bold ${STATUS_STYLES[status] ?? "bg-salvia text-pino"}`}
    >
      {label}
    </span>
  );
}

const NOISE_STYLES: Record<string, { chip: string; bar: string; bars: number }> = {
  quiet: { chip: "bg-salvia text-pino", bar: "bg-pino", bars: 1 },
  medium: { chip: "bg-ambar/35 text-[#7a4b00]", bar: "bg-[#7a4b00]", bars: 2 },
  noisy: { chip: "bg-coral/20 text-[#9c3a22]", bar: "bg-[#9c3a22]", bars: 3 },
};

/** Bars + word + colour. Never one of the three on its own. */
export function NoiseLevel({ level, label }: { level: string; label: string }) {
  const style = NOISE_STYLES[level] ?? NOISE_STYLES.quiet;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-bold ${style.chip}`}
    >
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-1 rounded-sm ${bar <= style.bars ? style.bar : "bg-current opacity-25"}`}
            style={{ height: `${4 + bar * 3}px` }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
