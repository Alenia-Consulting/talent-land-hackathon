import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ESTIMATE_CAP,
  expectedProcessingMs,
  sendingProgress,
  UPLOAD_SHARE,
} from "../lib/pure/progress.ts";

test("the upload fills only its share of the bar", () => {
  assert.equal(sendingProgress(0, null, 60), 0);
  assert.equal(sendingProgress(0.5, null, 60), UPLOAD_SHARE / 2);
  assert.equal(sendingProgress(1, null, 60), UPLOAD_SHARE);
  assert.equal(sendingProgress(2, null, 60), UPLOAD_SHARE);
});

test("the server's part starts where the upload ended and keeps moving", () => {
  const start = sendingProgress(1, 0, 60);
  const later = sendingProgress(1, 20_000, 60);
  assert.equal(start, UPLOAD_SHARE);
  assert.ok(later > start);
  assert.ok(sendingProgress(1, 40_000, 60) > later);
});

test("only the 200 reaches 100 %: the estimate never passes its cap", () => {
  const hours = sendingProgress(1, 3 * 60 * 60 * 1000, 120);
  assert.ok(hours <= ESTIMATE_CAP);
  assert.ok(Math.round(hours * 100) < 100);
});

test("a longer recording is expected to take longer", () => {
  assert.equal(expectedProcessingMs(5), 30_000);
  assert.ok(expectedProcessingMs(120) > expectedProcessingMs(60));
  assert.ok(sendingProgress(1, 30_000, 120) < sendingProgress(1, 30_000, 30));
});
