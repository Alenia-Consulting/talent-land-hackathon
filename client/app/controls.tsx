"use client";

// Controls the design uses on more than one screen: switches, segmented choices, the step
// progress rail and the sheet that asks before any sound plays.
//
// None of them animates. Invariant: nothing slides, fades or blinks, because movement is exactly
// what this product exists to spare people.

import { type ReactNode, useEffect, useRef } from "react";

import { MoonIcon, SunIcon } from "./icons.tsx";
import { usePrefs } from "./prefs.tsx";

/** A setting the person turns on and off. The whole row is the target, not just the switch. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  locked = false,
  lockedIcon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  locked?: boolean;
  lockedIcon?: ReactNode;
}) {
  const text = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-lg font-bold">{label}</span>
      {hint && <span className="block text-base text-tinta/70">{hint}</span>}
    </span>
  );

  // A setting that cannot be changed is not a dead switch: it shows a padlock and says why.
  if (locked) {
    return (
      <div className="flex min-h-14 items-center gap-4 py-2">
        {text}
        <span className="text-pino">{lockedIcon}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className="flex min-h-14 w-full items-center gap-4 py-2 text-left"
    >
      {text}
      <span
        aria-hidden="true"
        className={`flex h-9 w-16 shrink-0 items-center rounded-full p-1 ${
          checked ? "justify-end bg-pino" : "justify-start bg-tinta/30"
        }`}
      >
        <span className="h-7 w-7 rounded-full bg-tarjeta" />
      </span>
    </button>
  );
}

/** One choice out of a few, side by side: text size, noise level. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  full,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (next: T) => void;
  /** Spans the width, for the two-way question the welcome asks. */
  full?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`gap-2 rounded-[18px] bg-salvia/60 p-1 ${full ? "flex" : "inline-flex"}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`min-h-12 min-w-14 rounded-[14px] px-4 text-base font-bold ${
              full ? "flex-1" : ""
            } ${selected ? "border-2 border-pino bg-tarjeta text-pino" : "text-tinta"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The rail at the top of a step-by-step run: where you are, out of how many. */
export function ProgressSegments({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 flex-1 rounded-full ${index < current ? "bg-pino" : "bg-tinta/15"}`}
        />
      ))}
    </div>
  );
}

/**
 * The sheet that rises from the bottom to ask something before it happens.
 *
 * Used for the sound warning, which is the shape of invariant 1: nothing plays until the person
 * has read what they are about to hear and said yes.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Tapping outside closes, which for this sheet means "no sound". The safe answer. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-tinta/45"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // Taller than the screen on a phone, so it scrolls inside itself. Without the cap the
        // top of the sheet — its title — was simply cut off above the viewport.
        className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-niebla p-6 pb-10"
      >
        <span aria-hidden="true" className="mx-auto mb-5 block h-1.5 w-16 rounded-full bg-tinta/20" />
        {children}
      </div>
    </div>
  );
}

/** The dim-mode switch of the design's headers: a moon, the word, and it is remembered. */
export function ThemeButton({ label }: { label: string }) {
  const { prefs, setPrefs } = usePrefs();
  const dim = prefs.theme === "tenue";
  return (
    <button
      type="button"
      aria-pressed={dim}
      onClick={() => setPrefs({ theme: dim ? "claro" : "tenue" })}
      className="inline-flex min-h-14 items-center gap-3 rounded-[18px] bg-tarjeta px-5 text-base font-bold text-tinta"
    >
      {dim ? <SunIcon size={22} /> : <MoonIcon size={22} />}
      {label}
    </button>
  );
}
