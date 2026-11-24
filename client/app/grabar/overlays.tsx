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
          className={`rounded-full bg-amber-500/90 px-4 py-2 text-base font-medium text-black transition-opacity duration-500 ${
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

export function RecordingClock({ remainingSec }: { remainingSec: number }) {
  return (
    <div
      className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]"
      aria-label={es.grabando.remaining}
    >
      <span className="size-3 rounded-full bg-red-500" aria-hidden />
      <span className="text-2xl font-semibold tabular-nums">{formatClock(remainingSec)}</span>
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
    <dl className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 p-2 font-mono text-xs leading-5">
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
