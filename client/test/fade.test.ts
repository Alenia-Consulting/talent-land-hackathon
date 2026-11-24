import assert from "node:assert/strict";
import { test } from "node:test";

import { FADE_MS, fadeVolume, TARGET_VOLUME } from "../lib/pure/fade.ts";

test("the sound starts silent", () => {
  assert.equal(fadeVolume(0), 0);
  assert.equal(fadeVolume(-50), 0);
  assert.equal(fadeVolume(Number.NaN), 0);
});

test("the volume rises linearly and never overshoots", () => {
  assert.equal(fadeVolume(FADE_MS / 2), TARGET_VOLUME / 2);
  assert.equal(fadeVolume(FADE_MS), TARGET_VOLUME);
  assert.equal(fadeVolume(FADE_MS * 10), TARGET_VOLUME);
});

test("a custom target and length are respected", () => {
  assert.equal(fadeVolume(500, 1, 1000), 0.5);
});
