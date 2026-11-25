import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATALOGUE,
  markAt,
  MIN_MARKS,
  PAUSE_MS,
  planProblem,
  whyNotSendable,
} from "../lib/pure/marks.ts";

const PART = { title: "Entrada", category: "entrance" as const };

test("the catalogue offers the parts of a route, entrance first", () => {
  assert.equal(CATALOGUE[0].category, "entrance");
  assert.ok(CATALOGUE.length >= 5);
  // Every part must be a category the API accepts, or the POST fails with 422.
  const allowed = new Set([
    "entrance",
    "reception",
    "waiting",
    "corridor",
    "appointment",
    "restroom",
    "exit",
    "other",
  ]);
  for (const part of CATALOGUE) assert.ok(allowed.has(part.category), part.category);
});

test("a mark records the second of the recording, not the clock", () => {
  // The recorder starts at t0; a mark 15.4 s later is at second 15.4 of the video.
  assert.deepEqual(markAt(PART, 15_400), { title: "Entrada", category: "entrance", marked_at_seconds: 15.4 });
});

test("marks are rounded to a tenth, so they stay readable", () => {
  assert.equal(markAt(PART, 15_449).marked_at_seconds, 15.4);
});

test("two marks are enough to send", () => {
  const marks = [markAt(PART, 0), markAt(PART, 12_000)];
  assert.equal(whyNotSendable(marks, 60), null);
});

test("one mark is not a route", () => {
  assert.match(whyNotSendable([markAt(PART, 0)], 60) ?? "", /dos/i);
});

test("marks that do not move forward are refused before reaching the API", () => {
  // The backend answers 422 for this; catching it here keeps the person from losing the recording.
  const marks = [markAt(PART, 20_000), markAt(PART, 5_000)];
  assert.match(whyNotSendable(marks, 60) ?? "", /orden/i);
});

test("a mark after the end of the video is refused", () => {
  const marks = [markAt(PART, 0), markAt(PART, 65_000)];
  assert.match(whyNotSendable(marks, 60) ?? "", /vídeo|video/i);
});

test("the last mark needs the arrival pause to fit before the video ends", () => {
  // The app asks the person to stand still 3 s on arrival; the photo is taken in the middle.
  const marks = [markAt(PART, 0), markAt(PART, 59_900)];
  assert.ok(whyNotSendable(marks, 60) !== null);
  assert.equal(PAUSE_MS, 3000);
});

test("a plan needs a venue before anything else", () => {
  assert.equal(planProblem("", 3), "venue");
  assert.equal(planProblem("   ", 3), "venue");
});

test("a plan needs at least two parts", () => {
  assert.equal(planProblem("Centro de Salud Oeste", 0), "parts");
  assert.equal(planProblem("Centro de Salud Oeste", 1), "parts");
  assert.equal(planProblem("Centro de Salud Oeste", MIN_MARKS), null);
});
