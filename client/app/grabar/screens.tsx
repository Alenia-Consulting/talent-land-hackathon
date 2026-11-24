import type { ReactNode } from "react";

import { es } from "../../lib/i18n/es.ts";
import { countByType, type RecordingAlert } from "../../lib/pure/alerts.ts";

/** Big primary button, always in the same footer slot (min 56 px tall). */
export function ActionButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const colors = {
    primary: "bg-niebla text-tinta",
    secondary: "bg-white/15 text-niebla",
    danger: "bg-coral text-white",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 flex-1 rounded-[18px] px-6 text-lg font-bold disabled:opacity-45 ${colors}`}
    >
      {children}
    </button>
  );
}

export function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export function IntroScreen() {
  return (
    <Message title={es.intro.title}>
      <p className="text-lg text-niebla/80">{es.intro.lead}</p>
      <ul className="flex flex-col gap-3 text-lg">
        {es.intro.tips.map((tip) => (
          <li key={tip} className="rounded-2xl bg-niebla/10 px-4 py-3">
            {tip}
          </li>
        ))}
      </ul>
    </Message>
  );
}

export function PermissionScreen({ starting, resumed }: { starting: boolean; resumed: boolean }) {
  return (
    <Message title={es.permisos.title}>
      <p className="text-lg text-niebla/80">{starting ? es.permisos.starting : es.permisos.lead}</p>
      {resumed && <p className="text-base text-ambar">{es.permisos.resumed}</p>}
    </Message>
  );
}

export function alertSummary(alerts: RecordingAlert[]): string {
  const counts = countByType(alerts);
  const parts = [
    counts.luz > 0 ? es.revision.darkSegments(counts.luz) : null,
    counts.movimiento > 0 ? es.revision.fastSegments(counts.movimiento) : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(", ") : es.revision.noAlerts;
}

export function ReviewScreen({
  url,
  alerts,
  notice,
  problem,
}: {
  url: string;
  alerts: RecordingAlert[];
  notice: string | null;
  /** Why this recording cannot be sent, shown here instead of on an error screen. */
  problem: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <h1 className="text-2xl font-bold">{es.revision.title}</h1>
      <video
        src={url}
        className="max-h-[55vh] w-full rounded-2xl bg-tinta object-contain"
        controls
        playsInline
      />
      {problem && (
        <div className="rounded-2xl bg-ambar/25 px-4 py-3" role="alert">
          <p className="text-lg font-bold text-ambar">{es.revision.cannotSend}</p>
          <p className="mt-1 text-base text-niebla/90">{problem}</p>
        </div>
      )}
      {notice && <p className="rounded-2xl bg-ambar/20 px-4 py-3 text-base text-ambar">{notice}</p>}
      <p className="text-base text-niebla/80">
        <span className="font-bold">{es.revision.alertsTitle}: </span>
        {alertSummary(alerts)}
      </p>
    </div>
  );
}

export function SendingScreen({ progress }: { progress: number }) {
  const percent = Math.round(progress * 100);
  return (
    <Message title={es.enviando.title}>
      <div
        className="h-4 w-full overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-white transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-lg tabular-nums">{percent}%</p>
      <p className="text-base text-niebla/70">{es.enviando.keepOpen}</p>
    </Message>
  );
}

export function DoneScreen() {
  return (
    <Message title={es.hecho.title}>
      <p className="text-lg text-niebla/80">{es.hecho.lead}</p>
    </Message>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <Message title={es.error.title}>
      <p className="text-lg text-niebla/80" role="alert">
        {message}
      </p>
    </Message>
  );
}
