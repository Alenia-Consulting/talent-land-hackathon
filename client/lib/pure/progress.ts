// The bar on the sending screen.
//
// The upload is measured in bytes, but most of the wait comes after it: POST /guides/{id}/video
// answers 200 only once the server has blurred the faces, cut the clips and measured the noise.
// That part reports nothing until it ends, so it is estimated, slowing down as it goes, and only
// the 200 takes the bar to 100 %. A bar stuck at 100 % while the server is still working reads
// as "it froze", which is the one thing this screen must not say.

/** Share of the bar the upload fills. The rest is the server's work. */
export const UPLOAD_SHARE = 0.3;

/** The estimate never passes this: only the 200 takes the bar to 100 %. */
export const ESTIMATE_CAP = 0.95;

/** How long the 100 % stays on screen before the done screen, so it is seen and not skipped. */
export const DONE_HOLD_MS = 1000;

/** Rough server time for a recording: the time constant of the estimate, not a promise. */
export function expectedProcessingMs(durationSec: number): number {
  return Math.max(30_000, durationSec * 1000);
}

/**
 * 0–1 for the bar. `uploaded` is the fraction of bytes sent; `processingMs` is how long the server
 * has been working since the last byte left, or null while still uploading.
 */
export function sendingProgress(
  uploaded: number,
  processingMs: number | null,
  durationSec: number,
): number {
  if (processingMs === null) return UPLOAD_SHARE * Math.min(Math.max(uploaded, 0), 1);
  const share = 1 - Math.exp(-Math.max(processingMs, 0) / expectedProcessingMs(durationSec));
  return UPLOAD_SHARE + (ESTIMATE_CAP - UPLOAD_SHARE) * share;
}
