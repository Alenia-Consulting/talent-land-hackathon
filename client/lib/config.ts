// Browser configuration read at runtime, so the same image works in every environment.
//
// The container writes /env.js at startup (docker/frontend/entrypoint.sh) from its NEXT_PUBLIC_*
// environment variables (Kubernetes ConfigMap / docker compose); the root layout loads it before
// the app. With `npm run dev`, client/.env.local (NEXT_PUBLIC_*) is used instead.
// Everything here reaches the browser: never put secrets in NEXT_PUBLIC_* variables.

export type RuntimeEnv = Partial<Record<`NEXT_PUBLIC_${string}`, string>>;

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

function runtimeEnv(): RuntimeEnv {
  return (typeof window !== "undefined" && window.__ENV__) || {};
}

/** Base URL of the REST API, without trailing slash. Defaults to /api (proxied by nginx). */
export function apiUrl(): string {
  const url = runtimeEnv().NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || "/api";
  return url.replace(/\/+$/, "");
}

/**
 * Recording limits. Tune them on site with `/grabar?debug=1`, which shows the live values these
 * thresholds are compared against.
 */
export const RECORDING = {
  maxDurationSec: 120,
  videoBitsPerSecond: 2_500_000,
  /** getUserMedia video constraints (rear camera, 720p, 30 fps). */
  video: { width: 1280, height: 720, frameRate: 30 },
  /** Monitoring canvas: the current frame is drawn at this size every `sampleIntervalMs`. */
  sampleIntervalMs: 500,
  canvas: { width: 64, height: 36 },
  /** Mean luminance (0–255). Alert below `threshold` for `onMs`; clears above `threshold + margin` for `offMs`. */
  light: { threshold: 60, margin: 10, onMs: 1500, offMs: 1000 },
  /** Rotation speed in °/s. Alert above `threshold` for `onMs`; clears below `threshold - margin` for `offMs`. */
  gyro: { threshold: 60, margin: 10, onMs: 1000, offMs: 1000 },
  /** Fallback without sensors: mean absolute luma difference (0–255) between frames `sampleIntervalMs` apart. */
  frameDiff: { threshold: 30, margin: 8, onMs: 1000, offMs: 1000 },
} as const;
