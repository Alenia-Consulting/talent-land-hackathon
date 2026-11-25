// How the sound of a place is allowed to start.
//
// Product invariant 1: there is never automatic sound. A clip plays silent, the ambience only
// plays after "Escuchar el sitio", after a warning that says how loud it is, and it comes up in a
// fade so the first instant is silence rather than a jolt.

/** The rise takes this long. Long enough to be a rise, short enough not to feel broken. */
export type Level = "quiet" | "medium" | "noisy";

/**
 * The noise level to announce before playing a place, or null when nobody said or measured it.
 *
 * Null instead of "quiet": the sheet that asks permission to play is the warning about noise, and
 * calling a place quiet without knowing would be that warning lying.
 */
export function levelOf(step: { noise_level?: string | null }): Level | null {
  const level = step.noise_level;
  return level === "quiet" || level === "medium" || level === "noisy" ? level : null;
}

export const FADE_MS = 1500;

/** Where the fade stops. Below 1 on purpose: the place should be audible, not loud. */
export const TARGET_VOLUME = 0.8;

/**
 * The volume at `elapsed` milliseconds into the fade.
 *
 * Clamped to what an audio element accepts: outside 0..1 the browser throws, and the failure
 * would land on the person at the exact moment they chose to trust the button.
 */
export function fadeVolume(elapsed: number, duration: number, target: number): number {
  if (!(elapsed > 0) || !(duration > 0)) return 0;
  const progress = Math.min(elapsed / duration, 1);
  return Math.min(Math.max(progress * target, 0), 1);
}
