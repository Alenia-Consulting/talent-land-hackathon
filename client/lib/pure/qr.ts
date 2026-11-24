// A QR code, drawn here instead of installed.
//
// Byte mode, error-correction level M, versions 1 to 10: enough for any link this product makes
// and small enough that the squares stay big on a printed sign. Everything below is fixed by
// ISO/IEC 18004 — the tables are the standard's, not choices.

import { remainder } from "./qr-rs.ts";

/** Per version (1-indexed): error codewords per block, and the data codewords of each block. */
const LEVEL_M: { ecc: number; groups: [number, number][] }[] = [
  { ecc: 10, groups: [[1, 16]] },
  { ecc: 16, groups: [[1, 28]] },
  { ecc: 26, groups: [[1, 44]] },
  { ecc: 18, groups: [[2, 32]] },
  { ecc: 24, groups: [[2, 43]] },
  { ecc: 16, groups: [[4, 27]] },
  { ecc: 18, groups: [[4, 31]] },
  { ecc: 22, groups: [[2, 38], [2, 39]] },
  { ecc: 22, groups: [[3, 36], [2, 37]] },
  { ecc: 26, groups: [[4, 43], [1, 44]] },
];

/** Where the alignment squares sit, per version. Version 1 has none. */
const ALIGNMENT: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
  [6, 28, 50],
];

/** The data codewords of every block of a version, group 1 first, in interleaving order. */
export function blocksOf(version: number): number[] {
  return LEVEL_M[version - 1].groups.flatMap(([count, length]) =>
    Array.from({ length: count }, () => length),
  );
}

const sizeOf = (version: number) => version * 4 + 17;
const countBitsOf = (version: number) => (version < 10 ? 8 : 16);

/** How many bytes of payload a version holds, once the mode and the length have taken theirs. */
function capacityOf(version: number): number {
  const data = blocksOf(version).reduce((total, length) => total + length, 0);
  return Math.floor((data * 8 - 4 - countBitsOf(version)) / 8);
}

/** Which modules are the code's own furniture, and so never carry data. */
export function functionModules(version: number): boolean[][] {
  const size = sizeOf(version);
  const map: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserve = (row: number, col: number) => {
    if (row >= 0 && row < size && col >= 0 && col < size) map[row][col] = true;
  };

  // Each finder together with its separator: an 8 by 8 block in three of the four corners.
  for (const [row, col] of [[0, 0], [0, size - 8], [size - 8, 0]]) {
    for (let dy = 0; dy < 8; dy += 1) {
      for (let dx = 0; dx < 8; dx += 1) reserve(row + dy, col + dx);
    }
  }

  // The two timing lines, corner to corner.
  for (let i = 0; i < size; i += 1) {
    reserve(6, i);
    reserve(i, 6);
  }

  // The format strip beside the top-left finder, and its second copy split across the other two.
  for (let i = 0; i < 9; i += 1) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    reserve(8, size - 1 - i);
    reserve(size - 1 - i, 8);
  }

  const centres = ALIGNMENT[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      const nearFinder =
        (row === centres[0] && col === centres[0]) ||
        (row === centres[0] && col === centres[centres.length - 1]) ||
        (row === centres[centres.length - 1] && col === centres[0]);
      if (nearFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) reserve(row + dy, col + dx);
      }
    }
  }

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      reserve(b, a);
      reserve(a, b);
    }
  }

  return map;
}

/** The bitstream: mode, length, the bytes themselves, then the standard's padding. */
function bitstream(bytes: Uint8Array, version: number): Uint8Array {
  const total = blocksOf(version).reduce((sum, length) => sum + length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i -= 1) {
      if ((value >> i) & 1) out[at >> 3] |= 0x80 >> (at & 7);
      at += 1;
    }
  };

  push(0b0100, 4);
  push(bytes.length, countBitsOf(version));
  for (const byte of bytes) push(byte, 8);
  // Terminator, then whole bytes of the two pad codewords the standard names.
  at = Math.min(at + 4, total * 8);
  at = Math.ceil(at / 8) * 8;
  for (let pad = at >> 3; pad < total; pad += 1) {
    out[pad] = (pad - (at >> 3)) % 2 === 0 ? 0xec : 0x11;
  }
  return out;
}

/** Blocks are written a byte at a time, round robin, data first and then the error codewords. */
function interleave(data: Uint8Array, version: number): Uint8Array {
  const lengths = blocksOf(version);
  const eccLength = LEVEL_M[version - 1].ecc;
  const blocks: { data: Uint8Array; ecc: Uint8Array }[] = [];
  let offset = 0;
  for (const length of lengths) {
    const block = data.slice(offset, offset + length);
    offset += length;
    blocks.push({ data: block, ecc: remainder(block, eccLength) });
  }

  const out: number[] = [];
  for (let i = 0; i < Math.max(...lengths); i += 1) {
    for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  }
  for (let i = 0; i < eccLength; i += 1) {
    for (const block of blocks) out.push(block.ecc[i]);
  }
  return Uint8Array.from(out);
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(c / 3) + Math.floor(r / 2)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The furniture: finders, separators, timing, alignment, and the one module always kept dark. */
function drawFunctionPatterns(matrix: boolean[][], version: number): void {
  const size = matrix.length;
  const set = (row: number, col: number, dark: boolean) => {
    if (row >= 0 && row < size && col >= 0 && col < size) matrix[row][col] = dark;
  };

  // The timing lines run corner to corner first; the finders then cover the ends of them, which
  // is why the edge of a finder is solid and not striped.
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  for (const [row, col] of [[3, 3], [3, size - 4], [size - 4, 3]]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        set(row + dy, col + dx, ring !== 2 && ring !== 4);
      }
    }
  }

  const centres = ALIGNMENT[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      const nearFinder =
        (row === centres[0] && col === centres[0]) ||
        (row === centres[0] && col === centres[centres.length - 1]) ||
        (row === centres[centres.length - 1] && col === centres[0]);
      if (nearFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(row + dy, col + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  set(size - 8, 8, true);

  if (version >= 7) {
    let rest = version;
    for (let i = 0; i < 12; i += 1) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
    const bits = (version << 12) | rest;
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(b, a, dark);
      set(a, b, dark);
    }
  }
}

/** The 15 format bits, twice, so a code survives losing one corner. */
function drawFormat(matrix: boolean[][], mask: number): void {
  const size = matrix.length;
  let rest = mask; // Level M is 0b00, so the five data bits are the mask alone.
  for (let i = 0; i < 10; i += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  const bits = ((mask << 10) | rest) ^ 0x5412;
  const bit = (i: number) => ((bits >> i) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) matrix[i][8] = bit(i);
  matrix[7][8] = bit(6);
  matrix[8][8] = bit(7);
  matrix[8][7] = bit(8);
  for (let i = 9; i < 15; i += 1) matrix[8][14 - i] = bit(i);

  for (let i = 0; i < 8; i += 1) matrix[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i += 1) matrix[size - 15 + i][8] = bit(i);
  matrix[size - 8][8] = true;
}

/** The standard's four penalties. The mask that scores lowest is the one a scanner reads best. */
function penalty(matrix: boolean[][]): number {
  const size = matrix.length;
  let score = 0;

  const runs = (at: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i += 1) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        if (at(i, j) === at(i, j - 1)) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
      // 1011101 with four light modules on either side, in both directions.
      for (let j = 0; j + 10 < size; j += 1) {
        const window = Array.from({ length: 11 }, (_, k) => at(i, j + k));
        const key = window.map((dark) => (dark ? "1" : "0")).join("");
        if (key === "10111010000" || key === "00001011101") score += 40;
      }
    }
  };
  runs((i, j) => matrix[i][j]);
  runs((i, j) => matrix[j][i]);

  for (let row = 0; row + 1 < size; row += 1) {
    for (let col = 0; col + 1 < size; col += 1) {
      const first = matrix[row][col];
      if (
        matrix[row][col + 1] === first &&
        matrix[row + 1][col] === first &&
        matrix[row + 1][col + 1] === first
      ) {
        score += 3;
      }
    }
  }

  const dark = matrix.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/**
 * The code for `text`, as rows of modules: true is dark. No quiet zone — whoever draws it adds
 * the four light modules of margin the standard asks for.
 */
export function encodeQr(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = LEVEL_M.findIndex((_, index) => bytes.length <= capacityOf(index + 1)) + 1;
  if (version === 0) {
    throw new Error("El texto es demasiado largo para un código QR de este tamaño.");
  }

  const size = sizeOf(version);
  const codewords = interleave(bitstream(bytes, version), version);
  const reserved = functionModules(version);
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  drawFunctionPatterns(matrix, version);

  // Up one pair of columns, down the next, skipping the vertical timing line at column 6.
  let at = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        const row = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
        if (reserved[row][col]) continue;
        if (at < codewords.length * 8) {
          matrix[row][col] = ((codewords[at >> 3] >> (7 - (at & 7))) & 1) === 1;
        }
        at += 1;
      }
    }
  }

  let best: boolean[][] = matrix;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = matrix.map((row, i) =>
      row.map((dark, j) => (reserved[i][j] ? dark : dark !== MASKS[mask](i, j))),
    );
    drawFormat(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
