import assert from "node:assert/strict";
import { test } from "node:test";

import { FADE_MS, fadeVolume, levelOf, TARGET_VOLUME } from "../lib/pure/sound.ts";

test("the sound starts at silence, never at full volume", () => {
  // Invariant: "empieza muy bajito y sube poco a poco". A first sample above zero is a jump
  // scare for the exact person this product is built for.
  assert.equal(fadeVolume(0, FADE_MS, TARGET_VOLUME), 0);
});

test("the sound reaches the target only at the end of the fade", () => {
  assert.equal(fadeVolume(FADE_MS, FADE_MS, TARGET_VOLUME), TARGET_VOLUME);
  assert.ok(fadeVolume(FADE_MS / 2, FADE_MS, TARGET_VOLUME) < TARGET_VOLUME);
});

test("the fade rises, never dips", () => {
  let previous = -1;
  for (let elapsed = 0; elapsed <= FADE_MS; elapsed += FADE_MS / 20) {
    const volume = fadeVolume(elapsed, FADE_MS, TARGET_VOLUME);
    assert.ok(volume >= previous, `dipped at ${elapsed}ms`);
    previous = volume;
  }
});

test("past the end it stays at the target and never above it", () => {
  assert.equal(fadeVolume(FADE_MS * 10, FADE_MS, TARGET_VOLUME), TARGET_VOLUME);
});

test("a negative elapsed time is still silence, not a crash or a spike", () => {
  assert.equal(fadeVolume(-500, FADE_MS, TARGET_VOLUME), 0);
});

test("the volume never leaves what an audio element accepts", () => {
  // Outside 0..1 the browser throws, and the sound of the place would fail at the worst moment.
  for (const elapsed of [-1, 0, 1, FADE_MS / 3, FADE_MS, 1e9]) {
    const volume = fadeVolume(elapsed, FADE_MS, TARGET_VOLUME);
    assert.ok(volume >= 0 && volume <= 1, `${volume} out of range at ${elapsed}`);
  }
});

test("the fade is long enough to be a rise and not a click", () => {
  assert.ok(FADE_MS >= 1000);
});

test("an unknown noise level is not announced as quiet", () => {
  // The sound sheet IS the noise warning: saying "low" without knowing it breaks it.
  assert.equal(levelOf({ noise_level: null }), null);
  assert.equal(levelOf({ noise_level: "loud" }), null);
  assert.equal(levelOf({}), null);
});

test("the three known levels are announced as they are", () => {
  for (const level of ["quiet", "medium", "noisy"] as const) {
    assert.equal(levelOf({ noise_level: level }), level);
  }
});
