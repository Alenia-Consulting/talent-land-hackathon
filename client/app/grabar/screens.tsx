import type { ReactNode } from "react";

import { es } from "../../lib/i18n/es.ts";
import { ProgressSegments } from "../controls.tsx";
import { DocumentIcon, PeopleIcon, SunIcon, WalkIcon } from "../icons.tsx";
import { Card } from "../ui.tsx";

/**
 * Big primary button, always in the same footer slot (min 56 px tall).
 *
 * Two tones, because the recorder has two kinds of screen: the camera ones are dark, and over a
 * live preview the action has to be the lightest thing on screen; every other screen is light
 * like the rest of the product, and there the action is the brand green.
 */
export function ActionButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  tone = "light",
  waitMs,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  tone?: "light" | "dark";
  /** Locked for this long, filling into its colour. Not `disabled`: that would fade it to 45 %. */
  waitMs?: number;
}) {
  const colors =
    tone === "dark"
      ? {
          primary: "bg-niebla text-tinta",
          secondary: "bg-white/15 text-niebla",
          danger: "bg-coral text-white",
        }[variant]
      : {
          primary: "bg-pino text-sobre-pino",
          secondary: "bg-tarjeta text-pino border-2 border-pino",
          danger: "bg-coral text-white",
        }[variant];
  return (
    <button
      type="button"
      onClick={waitMs ? undefined : onClick}
      disabled={disabled}
      aria-disabled={waitMs ? true : undefined}
      style={waitMs ? { animationDuration: `${waitMs}ms` } : undefined}
      className={`min-h-14 flex-1 rounded-[18px] px-6 text-lg font-bold disabled:opacity-45 ${colors} ${waitMs ? "parar-espera" : ""}`}
    >
      {children}
    </button>
  );
}

export function Message({
  title,
  step,
  children,
}: {
  title: string;
  /** "Paso 1 de 3": where this screen sits in the three the design numbers. */
  step?: { label: string; current: number };
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      {step && (
        <div>
          <p className="mb-2 text-center text-lg font-bold">{step.label}</p>
          <ProgressSegments total={3} current={step.current} />
        </div>
      )}
      <h1 className="text-4xl font-extrabold">{title}</h1>
      {children}
    </div>
  );
}

const TIP_ICONS: Record<string, ReactNode> = {
  luz: <SunIcon size={26} />,
  gente: <PeopleIcon size={26} />,
  andar: <WalkIcon size={26} />,
  cartel: <DocumentIcon size={26} />,
};

export function IntroScreen() {
  return (
    <Message title={es.intro.title} step={{ label: es.intro.step, current: 1 }}>
      <p className="text-xl text-tinta/70">{es.intro.lead}</p>
      <ul className="grid gap-3">
        {es.intro.tips.map((tip) => (
          <li key={tip.title}>
            <Card className="flex items-start gap-4">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                  tip.icon === "luz" ? "bg-ambar/35 text-sobre-ambar" : "bg-salvia text-pino"
                }`}
              >
                {TIP_ICONS[tip.icon]}
              </span>
              {/* The body is a size down from the page text on purpose: these are four cards to
                  skim before recording, not the easy-read text of the guide itself. */}
              <span className="min-w-0">
                <span className="block text-lg font-bold">{tip.title}</span>
                <span className="mt-0.5 block text-base leading-snug text-tinta/70">
                  {tip.body}
                </span>
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </Message>
  );
}

export function PermissionScreen({ starting, resumed }: { starting: boolean; resumed: boolean }) {
  return (
    <Message title={es.permisos.title} step={{ label: es.intro.step, current: 1 }}>
      <p className="text-xl text-tinta/70">{starting ? es.permisos.starting : es.permisos.lead}</p>
      {resumed && (
        <p className="rounded-2xl bg-ambar/35 px-4 py-3 text-sobre-ambar">{es.permisos.resumed}</p>
      )}
    </Message>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <Message title={es.error.title}>
      <p className="text-xl text-tinta/80" role="alert">
        {message}
      </p>
    </Message>
  );
}
