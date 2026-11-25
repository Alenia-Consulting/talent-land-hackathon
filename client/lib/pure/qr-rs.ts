// Reed-Solomon over GF(256), the arithmetic a QR code is built on.
//
// Kept apart from the drawing because it is nothing but numbers: the field below is fixed by
// ISO/IEC 18004, and every other file takes it as given.

/** The polynomial the standard folds by once a product passes 0xFF. */
const PRIMITIVE = 0x11d;

/** EXP[n] is alpha^n; LOG is its inverse. Two lookups turn multiplication into an addition. */
export const EXP = new Uint8Array(256);
export const LOG = new Uint8Array(256);

{
  let value = 1;
  for (let power = 0; power < 255; power += 1) {
    EXP[power] = value;
    LOG[value] = power;
    value <<= 1;
    if (value & 0x100) value ^= PRIMITIVE;
  }
  // alpha^255 is alpha^0 again: the field wraps, and the extra entry saves a modulo below.
  EXP[255] = EXP[0];
}

export function multiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

/**
 * The divisor for `count` error-correction codewords: (x - alpha^0)...(x - alpha^(count-1)),
 * highest power first.
 */
export function generatorPoly(count: number): Uint8Array {
  let poly = Uint8Array.from([1]);
  for (let step = 0; step < count; step += 1) {
    const next = new Uint8Array(poly.length + 1);
    for (let i = 0; i < poly.length; i += 1) {
      next[i] ^= poly[i];
      next[i + 1] ^= multiply(poly[i], EXP[step]);
    }
    poly = next;
  }
  return poly;
}

/** The error-correction codewords for one block: the remainder of the long division. */
export function remainder(data: Uint8Array, count: number): Uint8Array {
  const generator = generatorPoly(count);
  const buffer = new Uint8Array(data.length + count);
  buffer.set(data);

  for (let i = 0; i < data.length; i += 1) {
    const factor = buffer[i];
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      buffer[i + j] ^= multiply(generator[j], factor);
    }
  }

  return buffer.slice(data.length);
}
