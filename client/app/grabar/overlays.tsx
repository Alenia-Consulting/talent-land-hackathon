import type { Ref } from "react";

import { es } from "../../lib/i18n/es.ts";
import type { AlertType } from "../../lib/pure/alerts.ts";

export const formatClock = (totalSec: number): string => {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Inline rear-camera preview. `playsInline` keeps iOS from opening it full screen. */
export function CameraPreview({ stream, videoRef }: { stream: MediaStream | null; videoRef: Ref<HTMLVideoElement> }) {
  return (
    <video
      ref={(element) => {
        if (typeof videoRef === "function") videoRef(element);
        else if (videoRef) videoRef.current = element;
        if (element && element.srcObject !== stream) {
          element.srcObject = stream;
          element.play().catch(() => {});
        }
      }}
      className="absolute inset-0 h-full w-full object-cover"
      playsInline
      muted
      autoPlay
    />
  );
}

/** Fixed, calm warnings over the preview: they fade, never blink. */
export function WarningStack({ active }: { active: Record<AlertType, boolean> }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {(["luz", "movimiento"] as const).map((type) => (
        <p
          key={type}
          className={`rounded-full bg-ambar px-4 py-2 text-base font-bold text-tinta transition-opacity duration-500 ${
            active[type] ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!active[type]}
        >
          {es.alerts[type]}
        </p>
      ))}
    </div>
  );
}

/**
 * The top bar while recording: elapsed time, how much is left, and the ceiling.
 *
 * The design puts the clock in a pill at the edge rather than across the middle, so it never
 * sits over what the person is filming.
 */
export function RecordingBar({
  remainingSec,
  maxSec,
}: {
  remainingSec: number;
  maxSec: number;
}) {
  const elapsed = Math.max(0, maxSec - remainingSec);
  return (
    <div
      className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6"
      aria-label={es.grabando.remaining}
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-tinta/80 px-4 py-2">
        <span className="size-3 rounded-full bg-coral" aria-hidden />
        <span className="text-xl font-bold tabular-nums">{formatClock(elapsed)}</span>
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-niebla/30" aria-hidden>
        <span
          className="block h-full rounded-full bg-niebla"
          style={{ width: `${maxSec > 0 ? Math.min(100, (elapsed / maxSec) * 100) : 0}%` }}
        />
      </span>
      <span className="rounded-full bg-tinta/80 px-4 py-2 text-base font-bold">
        {es.grabando.max}
      </span>
    </div>
  );
}

/** What to do at the next part, said before arriving instead of after. */
export function CoachCard({ nextPart }: { nextPart: string | null }) {
  return (
    <div className="absolute inset-x-4 top-20 rounded-3xl bg-niebla/95 p-4 text-tinta">
      {nextPart ? (
        <>
          <p className="text-lg font-bold">{es.grabando.nextPart(nextPart)}</p>
          <p className="mt-1 text-base text-tinta/70">{es.grabando.nextHint}</p>
        </>
      ) : (
        <p className="text-lg font-bold">{es.grabando.allDone}</p>
      )}
    </div>
  );
}

/** Where the walk is up to: one dot per part, ticked as each is marked. */
export function StepRail({ parts, done }: { parts: { title: string }[]; done: number }) {
  return (
    <div className="absolute inset-x-0 bottom-4 flex items-start justify-center gap-1 px-3">
      {parts.map((part, index) => {
        const complete = index < done;
        const current = index === done;
        return (
          <div key={part.title + index} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                complete
                  ? "border-[#8fd9c0] bg-[#8fd9c0] text-tinta"
                  : current
                    ? "border-niebla bg-niebla text-tinta"
                    : "border-niebla/50"
              }`}
            >
              {complete ? "✓" : ""}
            </span>
            <span
              className={`w-full truncate text-center text-sm ${current ? "font-bold" : "text-niebla/70"}`}
            >
              {part.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type DebugValues = {
  luminance: number | null;
  gyroDps: number | null;
  frameDiff: number | null;
  motionSource: string;
  motionPermission: string;
  mimeType: string | null;
  resolution: string;
};

const fixed = (value: number | null) => (value === null ? "–" : value.toFixed(1));

export function DebugPanel({ values }: { values: DebugValues }) {
  return (
    <dl className="pointer-events-none absolute bottom-2 left-2 rounded bg-tinta/80 p-2 font-mono text-xs leading-5">
      <dt className="sr-only">{es.debug.title}</dt>
      <dd>luz: {fixed(values.luminance)}</dd>
      <dd>giro: {fixed(values.gyroDps)} °/s</dd>
      <dd>dif. frames: {fixed(values.frameDiff)}</dd>
      <dd>
        movimiento: {values.motionSource} ({values.motionPermission})
      </dd>
      <dd>mime: {values.mimeType ?? "–"}</dd>
      <dd>cámara: {values.resolution}</dd>
    </dl>
  );
}
