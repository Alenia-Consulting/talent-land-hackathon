import assert from "node:assert/strict";
import { test } from "node:test";

import { layoutPoint, pauseSecond, spokenPoint, type Point } from "../lib/pure/points.ts";

const point = (box_2d: number[], label = "Entrada de cristal"): Point => ({
  label,
  description: "Busca las puertas de cristal. Cruza por la abertura para entrar.",
  kind: "door",
  box_2d,
});

test("the clip pauses where the photo was taken, counted from the start of the clip", () => {
  assert.equal(pauseSecond({ start_seconds: 12, photo_second: 13.5 }), 1.5);
});

test("a photo second before the start of the clip pauses at its first frame", () => {
  assert.equal(pauseSecond({ start_seconds: 12, photo_second: 11 }), 0);
});

test("the voice reads the name and then what to do", () => {
  assert.equal(
    spokenPoint(point([0, 0, 1, 1])),
    "Entrada de cristal. Busca las puertas de cristal. Cruza por la abertura para entrar.",
  );
});

test("the box is placed in the frame's own pixels", () => {
  // [ymin, xmin, ymax, xmax] of a 720x1280 frame.
  const { box } = layoutPoint(point([500, 100, 600, 300]), 720, 1280);

  assert.deepEqual(box, { x: 72, y: 640, width: 144, height: 128 });
});

test("the arrow comes from above and points down at the middle of the box", () => {
  const { arrow, box } = layoutPoint(point([500, 100, 600, 300]), 720, 1280);

  assert.equal(arrow.tipX, box.x + box.width / 2);
  assert.equal(arrow.tailX, arrow.tipX);
  assert.ok(arrow.tailY < arrow.tipY && arrow.tipY < box.y);
});

test("a box near the top gets its arrow from below, so nothing is cut off", () => {
  const { arrow, box, label } = layoutPoint(point([20, 400, 120, 600]), 720, 1280);

  assert.ok(arrow.tipY > box.y + box.height && arrow.tailY > arrow.tipY);
  assert.ok(label.y >= arrow.tailY);
  assert.ok(label.y + label.height <= 1280);
});

test("a label next to the edge stays inside the frame while the arrow still points at the box", () => {
  const left = layoutPoint(point([500, 0, 600, 60], "Mostrador de información"), 720, 1280);
  const right = layoutPoint(point([500, 940, 600, 1000], "Mostrador de información"), 720, 1280);

  assert.ok(left.label.x >= 0);
  assert.ok(right.label.x + right.label.width <= 720);
  assert.ok(left.arrow.tipX < 60);
  assert.ok(right.arrow.tipX > 940 * 0.72);
});

test("the label grows with its text and the strokes grow with the frame", () => {
  const short = layoutPoint(point([500, 100, 600, 300], "Mesa"), 720, 1280);
  const long = layoutPoint(point([500, 100, 600, 300], "Mostrador de información"), 720, 1280);
  const big = layoutPoint(point([500, 100, 600, 300], "Mesa"), 1440, 2560);

  assert.ok(long.label.width > short.label.width);
  assert.equal(big.unit, short.unit * 2);
});

import { movePoint, pointsAreSendable, scalePoint } from "../lib/pure/points.ts";

test("moving a point centres its box on the tapped place and keeps its size", () => {
  const moved = movePoint(point([500, 100, 600, 300]), 0.5, 0.25);

  assert.deepEqual(moved.box_2d, [200, 400, 300, 600]);
});

test("a point cannot be moved out of the photo", () => {
  assert.deepEqual(movePoint(point([500, 100, 600, 300]), 0, 0).box_2d, [0, 0, 100, 200]);
  assert.deepEqual(movePoint(point([500, 100, 600, 300]), 1, 1).box_2d, [900, 800, 1000, 1000]);
});

test("a bigger or smaller box keeps its centre", () => {
  const bigger = scalePoint(point([400, 400, 600, 600]), 1.5);
  const smaller = scalePoint(point([400, 400, 600, 600]), 0.5);

  assert.deepEqual(bigger.box_2d, [350, 350, 650, 650]);
  assert.deepEqual(smaller.box_2d, [450, 450, 550, 550]);
});

test("a box never shrinks to nothing nor grows past the photo", () => {
  const tiny = scalePoint(point([400, 400, 440, 440]), 0.1);
  const huge = scalePoint(point([100, 100, 900, 900]), 5);

  assert.deepEqual(tiny.box_2d, [400, 400, 440, 440]);
  assert.deepEqual(huge.box_2d, [0, 0, 1000, 1000]);
});

test("points are sent only when each one has a name and something to read aloud", () => {
  const ok = point([100, 100, 300, 300]);

  assert.equal(pointsAreSendable([ok]), true);
  assert.equal(pointsAreSendable([]), true);
  assert.equal(pointsAreSendable([{ ...ok, label: "  " }]), false);
  assert.equal(pointsAreSendable([{ ...ok, description: "" }]), false);
  assert.equal(pointsAreSendable([ok, ok, ok, ok]), false);
});
