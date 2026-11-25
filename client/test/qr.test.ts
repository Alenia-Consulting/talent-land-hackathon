import assert from "node:assert/strict";
import { test } from "node:test";

import { blocksOf, encodeQr, functionModules } from "../lib/pure/qr.ts";

/**
 * Reads a finished code back out: format bits, mask, zigzag, interleaving and all.
 *
 * It is here rather than in the app because nothing in the product needs to read a QR. It is the
 * check that the drawing is a real code and not a convincing pattern of squares, and it fails if
 * any stage disagrees with the standard — a scanner would simply see nothing.
 */
function decode(matrix: boolean[][]): string {
  const size = matrix.length;
  const version = (size - 17) / 4;

  let format = 0;
  const copy: [number, number][] = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8],
    [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ];
  copy.forEach(([row, col], bit) => {
    if (matrix[row][col]) format |= 1 << bit;
  });
  const data = (format ^ 0x5412) >>> 10;
  assert.equal(data >>> 3, 0, "error correction level M");
  const mask = data & 7;

  const reserved = functionModules(version);
  const masked = (row: number, col: number): boolean => {
    const inverted = [
      (row + col) % 2 === 0,
      row % 2 === 0,
      col % 3 === 0,
      (row + col) % 3 === 0,
      (Math.floor(col / 3) + Math.floor(row / 2)) % 2 === 0,
      ((row * col) % 2) + ((row * col) % 3) === 0,
      (((row * col) % 2) + ((row * col) % 3)) % 2 === 0,
      ((((row + col) % 2) + ((row * col) % 3)) % 2) === 0,
    ][mask];
    return matrix[row][col] !== inverted;
  };

  const bits: boolean[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vertical : vertical;
        if (!reserved[row][col]) bits.push(masked(row, col));
      }
    }
  }

  const codewords: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ? 1 : 0);
    codewords.push(byte);
  }

  // Undo the interleaving: the codewords were read block by block, one byte at a time.
  const blocks = blocksOf(version);
  const lengths = blocks.map((length) => length);
  const restored: number[][] = lengths.map(() => []);
  let at = 0;
  for (let i = 0; i < Math.max(...lengths); i += 1) {
    for (let b = 0; b < lengths.length; b += 1) {
      if (i < lengths[b]) restored[b].push(codewords[at++]);
    }
  }
  const stream = restored.flat();

  const countBits = version < 10 ? 8 : 16;
  let cursor = 0;
  const read = (count: number): number => {
    let value = 0;
    for (let i = 0; i < count; i += 1) {
      const bit = (stream[(cursor >> 3) % stream.length] >> (7 - (cursor & 7))) & 1;
      value = (value << 1) | bit;
      cursor += 1;
    }
    return value;
  };
  assert.equal(read(4), 0b0100, "byte mode");
  const length = read(countBits);
  const bytes: number[] = [];
  for (let i = 0; i < length; i += 1) bytes.push(read(8));
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

test("the matrix is the size the version calls for", () => {
  assert.equal(encodeQr("hola").length, 21); // version 1
  assert.equal(encodeQr("x".repeat(40)).length, 29); // version 3
});

test("it grows to the smallest version the text fits in", () => {
  assert.equal(encodeQr("x".repeat(14)).length, 21);
  assert.equal(encodeQr("x".repeat(15)).length, 25);
});

test("the three finder patterns are where a scanner looks for them", () => {
  const matrix = encodeQr("hola");
  const size = matrix.length;
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const ring = Math.max(Math.abs(row - 3), Math.abs(col - 3));
        assert.equal(matrix[top + row][left + col], ring !== 2, `${top + row},${left + col}`);
      }
    }
  }
});

test("the timing patterns alternate between the finders", () => {
  const matrix = encodeQr("hola");
  for (let i = 8; i < matrix.length - 8; i += 1) {
    assert.equal(matrix[6][i], i % 2 === 0, `row 6, column ${i}`);
    assert.equal(matrix[i][6], i % 2 === 0, `column 6, row ${i}`);
  }
});

test("the module the standard always keeps dark is dark", () => {
  const matrix = encodeQr("hola");
  assert.equal(matrix[matrix.length - 8][8], true);
});

test("a short link reads back as itself", () => {
  const text = "https://antesala.app/g?id=7";
  assert.equal(decode(encodeQr(text)), text);
});

test("a link long enough to need several blocks reads back as itself", () => {
  const text = "https://antesala.app/g?id=2f6a1c04-9b3e-4d77-8a51-0c9e2b6d4af8";
  const matrix = encodeQr(text);

  assert.ok(matrix.length >= 33, `expected version 4 or more, got ${matrix.length}`);
  assert.equal(decode(matrix), text);
});

test("accents survive, because venue names have them", () => {
  const text = "Clínica Dental Alameda · recepción";
  assert.equal(decode(encodeQr(text)), text);
});

test("text too long for the biggest version it draws is refused, not silently cut", () => {
  assert.throws(() => encodeQr("x".repeat(214)), /demasiado largo/);
});

/**
 * The number of modules each version leaves for data, from the standard's own capacity tables:
 * total codewords times eight, plus the few remainder bits versions 2 to 6 carry.
 *
 * This is the check the round trip above cannot make. Reading a code back with the same idea of
 * which modules are furniture confirms the two halves agree, not that either is right — an early
 * draft reserved a whole row that is not reserved, and the round trip passed while no scanner on
 * earth could read the result.
 */
const DATA_MODULES = [208, 359, 567, 807, 1079, 1383, 1568, 1936, 2336, 2768];

test("every version leaves exactly the data modules the standard counts", () => {
  DATA_MODULES.forEach((expected, index) => {
    const free = functionModules(index + 1)
      .flat()
      .filter((taken) => !taken).length;

    assert.equal(free, expected, `version ${index + 1}`);
  });
});

/** ISO/IEC 18004 Table C.1: the eight finished format strings for error correction level M. */
const FORMAT_M = [
  "101010000010010", "101000100100101", "101111001111100", "101101101001011",
  "100010111111001", "100000011001110", "100111110010111", "100101010100000",
];

test("the format information is one of the strings the standard prints, in both copies", () => {
  const matrix = encodeQr("https://antesala.app/g?id=7");
  const size = matrix.length;
  const read = (places: number[][]): number => {
    let value = 0;
    places.forEach(([row, col], bit) => {
      if (matrix[row][col]) value |= 1 << bit;
    });
    return value;
  };

  const first = read([
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8],
    [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ]);
  const second = read([
    ...Array.from({ length: 8 }, (_, i) => [8, size - 1 - i]),
    ...Array.from({ length: 7 }, (_, i) => [size - 7 + i, 8]),
  ]);

  assert.equal(first, second, "the two copies must say the same thing");
  assert.ok(
    FORMAT_M.includes(first.toString(2).padStart(15, "0")),
    `${first.toString(2).padStart(15, "0")} is not a level M format string`,
  );
});
