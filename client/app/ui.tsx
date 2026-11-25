// Shared pieces of the brand, so the panel and the public guide look like one product.
//
// Rules from the design that live here and should not be undone:
//   · a button is at least 56 px tall with an 18 px radius, and always carries text. An icon on
//     its own is allowed only in a header (close, back), never as an action in the guide;
//   · a noise level is never colour alone — bars, word and colour together, because colour alone
//     is invisible to a part of the people this product is for;
//   · surfaces are tokens, not literal colours, so dim mode needs no second component.

import Link from "next/link";
import type { ReactNode } from "react";

import { es } from "../lib/i18n/es.ts";
import { ChevronLeftIcon } from "./icons.tsx";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-tarjeta p-5 ${className}`}>{children}</div>;
}

/**
 * Where a screen's action lives: the bottom edge, always, however long the page is.
 *
 * The design rule is that the big buttons sit in the same place on every screen. On a page that
 * scrolls that has to mean the bottom of the WINDOW, not the bottom of the document, or the way
 * out of the screen is something you have to go looking for. `sticky` and not `fixed` so a short
 * page keeps it in the flow and nothing floats over content that already fits.
 *
 * `-mx-4 px-4` because every page of this app is padded by 4: the bar bleeds to both edges and
 * puts its own padding back, so the line above it spans the full width.
 */
export function ActionBar({
  note,
  children,
  className = "",
}: {
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky bottom-0 z-30 -mx-4 mt-8 border-t border-tinta/10 bg-niebla px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
    >
      {note && <div className="mb-3 text-base text-tinta/70">{note}</div>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** The counterpart at the top: where you are and the way back, kept on screen while you scroll. */
export function TopBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-5 border-b border-tinta/10 bg-niebla px-4 py-3">
      {children}
    </div>
  );
}

/**
 * The way out of a screen, as a control on the page and not the browser's back button.
 *
 * Every screen below the door carries one, in the same corner. Somebody who arrived by QR has no
 * history to go back through, and somebody who has never had to find the browser's back button
 * has no way out at all: the route out of a screen is part of the screen.
 *
 * `compact` is the icon-only form, for a header that already holds something else. It is the one
 * case this design allows an icon with no visible word, and the label is still read aloud.
 */
export function BackLink({
  href,
  label = es.home.back,
  compact = false,
}: {
  href: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={compact ? label : undefined}
      className={`inline-flex shrink-0 items-center rounded-[18px] bg-tarjeta text-lg font-bold text-tinta ${
        compact ? "h-14 w-14 justify-center" : "min-h-14 gap-2 pr-5 pl-3"
      }`}
    >
      <ChevronLeftIcon size={24} />
      {!compact && label}
    </Link>
  );
}

/** Small uppercase section label, the way the design separates blocks. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-bold tracking-widest text-pino uppercase">{children}</h2>
      {right}
    </div>
  );
}

export type ButtonVariant = "primary" | "secondary" | "dark" | "quiet";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-pino text-sobre-pino",
  secondary: "bg-tarjeta text-pino border-2 border-pino",
  // The forward action of a step-by-step run, which the design paints darker than the page.
  dark: "bg-tinta text-niebla",
  quiet: "bg-tarjeta text-tinta",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  icon,
  full = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  icon?: ReactNode;
  full?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-14 items-center justify-center gap-3 rounded-[18px] px-6 text-lg font-bold disabled:opacity-45 ${
        BUTTON_STYLES[variant]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * The round icon-only button of a screen header (close, back).
 *
 * Allowed without a visible label because it is navigation and not an action of the guide; the
 * label is required all the same, for anyone who hears the screen instead of seeing it.
 */
export function HeaderButton({
  children,
  label,
  onClick,
  className = "",
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-tarjeta text-tinta ${className}`}
    >
      {children}
    </button>
  );
}

/** A static fact: "5 pasos", "3 min andando", "Revisada el 24 nov 2026". */
export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-tarjeta px-4 py-2 text-base font-bold ${className}`}
    >
      {children}
    </span>
  );
}

/** A choice the person can turn on and off, drawn as a pill that fills when chosen. */
export function Chip({
  children,
  selected,
  onClick,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-bold ${
        selected ? "border-2 border-pino bg-salvia text-pino" : "bg-tarjeta text-tinta"
      }`}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ambar/35 text-sobre-ambar",
  needs_review: "bg-coral/20 text-sobre-coral",
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

/** Something the venue still has to fill in, in the gentle warning colour. */
export function MissingChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-ambar/35 px-3 py-1 text-base font-bold text-sobre-ambar">
      {children}
    </span>
  );
}

const NOISE_STYLES: Record<string, { chip: string; bar: string; bars: number }> = {
  quiet: { chip: "bg-salvia text-pino", bar: "bg-pino", bars: 1 },
  medium: { chip: "bg-ambar/35 text-sobre-ambar", bar: "bg-sobre-ambar", bars: 2 },
  noisy: { chip: "bg-coral/20 text-sobre-coral", bar: "bg-sobre-coral", bars: 3 },
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
