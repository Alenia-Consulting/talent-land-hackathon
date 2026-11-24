import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyCameraError } from "../lib/pure/cameraError.ts";
import { average, lumaFrame, meanAbsDiff, meanLuminance, rotationMagnitude } from "../lib/pure/frames.ts";
import {
  type HysteresisConfig,
  type HysteresisState,
  initialHysteresis,
  stepHysteresis,
} from "../lib/pure/hysteresis.ts";
import { baseMimeType, fileExtension, pickMimeType } from "../lib/pure/mime.ts";

const rgba = (...pixels: [number, number, number][]) => pixels.flatMap(([r, g, b]) => [r, g, b, 255]);

test("luminance uses the 0.299/0.587/0.114 weights", () => {
  assert.equal(meanLuminance(rgba([255, 255, 255], [255, 255, 255])), 255);
  assert.equal(meanLuminance(rgba([0, 0, 0])), 0);
  assert.ok(Math.abs(lumaFrame(rgba([255, 0, 0]))[0]! - 76.245) < 1e-3);
  assert.ok(Math.abs(lumaFrame(rgba([0, 255, 0]))[0]! - 149.685) < 1e-3);
  assert.equal(average([]), 0);
});

test("frame difference is the mean absolute luma difference", () => {
  assert.equal(meanAbsDiff([0, 100], [50, 100]), 25);
  assert.equal(meanAbsDiff([10, 10], [10, 10]), 0);
  assert.equal(meanAbsDiff([], []), 0);
});

test("rotation magnitude is the hypot of the three axes", () => {
  assert.equal(rotationMagnitude({ alpha: 3, beta: 4, gamma: 0 }), 5);
  assert.equal(rotationMagnitude({ alpha: null, beta: 1, gamma: 1 }), null);
  assert.equal(rotationMagnitude(null), null);
});

const light: HysteresisConfig = { mode: "low", threshold: 60, margin: 10, onMs: 1500, offMs: 1000 };
const motion: HysteresisConfig = { mode: "high", threshold: 60, margin: 10, onMs: 1000, offMs: 1000 };

/** Feeds [timeMs, value] samples and returns the events in order. */
function run(cfg: HysteresisConfig, samples: [number, number][]) {
  let state: HysteresisState = initialHysteresis;
  const events: { type: string; at: number }[] = [];
  for (const [t, value] of samples) {
    const step = stepHysteresis(state, value, t, cfg);
    state = step.state;
    if (step.event) events.push(step.event);
  }
  return { state, events };
}

test("light alert needs 1.5 s below the threshold and reports when the dark stretch began", () => {
  const { events } = run(light, [[0, 100], [500, 40], [1000, 40], [1500, 40], [2000, 40]]);
  assert.deepEqual(events, [{ type: "start", at: 500 }]);
});

test("a short dip does not trigger and resets the timer", () => {
  const { events, state } = run(light, [[0, 40], [1000, 40], [1200, 90], [2000, 40], [3000, 40]]);
  assert.deepEqual(events, []);
  assert.equal(state.active, false);
});

test("light alert only clears above threshold + margin for 1 s", () => {
  const { events, state } = run(light, [
    [0, 10], [1500, 10], // start
    [2000, 65], [3500, 65], // between threshold and threshold + margin: stays active
    [4000, 80], [4500, 80], [5000, 80], // clears after 1 s above 70
  ]);
  assert.deepEqual(events, [{ type: "start", at: 0 }, { type: "end", at: 4000 }]);
  assert.equal(state.active, false);
});

test("motion alert is the mirror image: above the limit to start, below limit - margin to end", () => {
  const { events } = run(motion, [
    [0, 100], [500, 100], [1000, 100], // start after 1 s
    [1500, 55], [2500, 55], // 55 is not below 50: still active
    [3000, 40], [3500, 40], [4000, 40], // ends after 1 s below 50
  ]);
  assert.deepEqual(events, [{ type: "start", at: 0 }, { type: "end", at: 3000 }]);
});

test("recorder format order and file extensions", () => {
  assert.equal(pickMimeType(() => true), "video/mp4;codecs=avc1");
  assert.equal(pickMimeType((m) => m.startsWith("video/webm")), "video/webm;codecs=vp9");
  assert.equal(pickMimeType((m) => m === "video/webm"), "video/webm");
  assert.equal(pickMimeType(() => false), null);
  assert.equal(fileExtension("video/mp4;codecs=avc1"), "mp4");
  assert.equal(fileExtension("video/webm;codecs=vp9"), "webm");
  assert.equal(baseMimeType("video/mp4;codecs=avc1.42E01E"), "video/mp4");
});

test("camera errors map to a message kind", () => {
  assert.equal(classifyCameraError({ name: "NotAllowedError" }), "denied");
  assert.equal(classifyCameraError(new DOMException("x", "NotReadableError")), "busy");
  assert.equal(classifyCameraError({ name: "NotFoundError" }), "notfound");
  assert.equal(classifyCameraError("boom"), "unknown");
});
