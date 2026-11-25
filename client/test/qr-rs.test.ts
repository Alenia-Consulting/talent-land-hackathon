import assert from "node:assert/strict";
import { test } from "node:test";

import { EXP, LOG, generatorPoly, multiply, remainder } from "../lib/pure/qr-rs.ts";

test("the field starts as plain powers of two", () => {
  assert.deepEqual([EXP[0], EXP[1], EXP[2], EXP[3], EXP[7]], [1, 2, 4, 8, 128]);
});

test("the field wraps with the QR primitive polynomial 0x11D", () => {
  // Past 0x100 the standard folds with x^8 = x^4 + x^3 + x^2 + 1, which is 0x1D.
  assert.equal(EXP[8], 0x1d);
  assert.equal(EXP[9], 0x3a);
});

test("log and exp undo each other for every value in the field", () => {
  for (let value = 1; value < 256; value += 1) {
    assert.equal(EXP[LOG[value]], value);
  }
});

test("multiplying by zero is zero", () => {
  assert.equal(multiply(0, 123), 0);
  assert.equal(multiply(123, 0), 0);
  assert.equal(multiply(3, 7), 9);
});

test("the generator polynomial for ten codewords is the one the standard prints", () => {
  // ISO/IEC 18004 Annex A gives it as the alpha exponents 0 251 67 46 61 118 70 64 94 32 45.
  const expected = [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45].map((power) => EXP[power]);

  assert.deepEqual([...generatorPoly(10)], expected);
});

test("data followed by its remainder is divisible by the generator", () => {
  // The property that makes the remainder correct: the finished codeword, read as a polynomial,
  // has alpha^0 .. alpha^(n-1) as roots. A wrong division fails this for some root.
  const data = Uint8Array.from([64, 196, 132, 84, 196, 196, 242, 194, 4, 132, 20, 37, 34, 16, 236, 17]);
  const ecc = remainder(data, 10);
  const codeword = [...data, ...ecc];

  assert.equal(ecc.length, 10);
  for (let root = 0; root < 10; root += 1) {
    let sum = 0;
    for (const byte of codeword) sum = multiply(sum, EXP[root]) ^ byte;
    assert.equal(sum, 0, `root alpha^${root}`);
  }
});
