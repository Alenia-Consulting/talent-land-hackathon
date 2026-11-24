// Pure pixel math for the 64×36 monitoring canvas (RGBA, as returned by getImageData).

/** Per-pixel luma (0.299R + 0.587G + 0.114B), 0–255. */
export function lumaFrame(rgba: ArrayLike<number>): Float32Array {
  const pixels = Math.floor(rgba.length / 4);
  const luma = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    luma[i] = 0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!;
  }
  return luma;
}

export function average(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i]!;
  return sum / values.length;
}

/** Mean luminance (0–255) of an RGBA frame. */
export function meanLuminance(rgba: ArrayLike<number>): number {
  return average(lumaFrame(rgba));
}

/** Mean absolute difference between two luma frames of the same size (0–255). */
export function meanAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / length;
}

/** Rotation speed in °/s from DeviceMotionEvent.rotationRate; null when the sensor has no data. */
export function rotationMagnitude(
  rate: { alpha: number | null; beta: number | null; gamma: number | null } | null | undefined,
): number | null {
  if (!rate || rate.alpha === null || rate.beta === null || rate.gamma === null) return null;
  return Math.hypot(rate.alpha, rate.beta, rate.gamma);
}
