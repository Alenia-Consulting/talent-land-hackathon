// Volume ramp for "Escuchar el sitio": the sound never starts at full volume.
//
// Pure on purpose, so the shape of the ramp is tested without a browser.

export const FADE_MS = 2000;
export const TARGET_VOLUME = 0.8;

/** Volume `elapsedMs` after the person asked for sound. Linear from 0 to `target` over `fadeMs`. */
export function fadeVolume(
  elapsedMs: number,
  target: number = TARGET_VOLUME,
  fadeMs: number = FADE_MS,
): number {
  if (!(elapsedMs > 0)) return 0;
  if (elapsedMs >= fadeMs) return target;
  return (elapsedMs / fadeMs) * target;
}
