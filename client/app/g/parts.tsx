// Small pieces shared by the screens of the public guide.

import Link from "next/link";
import type { ReactNode } from "react";

import type { Guide, Step } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { NoiseLevel } from "../ui.tsx";

const t = es.publica;

/** A link that looks like the brand button: 56 px tall, 18 px radius, always with text. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const colors =
    variant === "primary" ? "bg-pino text-white" : "bg-white text-pino border-2 border-pino";
  return (
    <Link
      href={href}
      className={`flex min-h-14 items-center justify-center rounded-[18px] px-6 text-lg font-bold ${colors}`}
    >
      {children}
    </Link>
  );
}

export function guideHref(slug: string, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams({ slug });
  for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
  return `/g?${params.toString()}`;
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-coral/15 p-4 text-[#9c3a22]">
      {children}
    </p>
  );
}

/** The noise level of a step, or nothing when it was not measured. */
export function StepNoise({ step }: { step: Step }) {
  if (!step.noise_level) return null;
  return (
    <NoiseLevel level={step.noise_level} label={t.noise[step.noise_level as keyof typeof t.noise]} />
  );
}

export function reviewedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return t.reviewedAt(
    date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
  );
}

/** Header with the venue and the review date, which is always visible (product invariant 7). */
export function GuideHeader({ guide }: { guide: Guide }) {
  const reviewed = reviewedOn(guide.reviewed_at);
  return (
    <header>
      <h1 className="text-4xl font-extrabold">{guide.venue_name}</h1>
      <p className="mt-1 text-xl text-tinta/70">{guide.title}</p>
      {reviewed && (
        <p className="mt-3 inline-block rounded-full bg-salvia px-4 py-2 text-base font-bold text-pino">
          {reviewed}
        </p>
      )}
    </header>
  );
}

/** Whether the step has sound worth offering. */
export function hasSound(step: Step): boolean {
  return Boolean(step.clip_url) && step.sound_available;
}
