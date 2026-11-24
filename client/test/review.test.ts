import assert from "node:assert/strict";
import { test } from "node:test";

import { countMissing, missingFieldsOf } from "../lib/pure/review.ts";

type Partial = Parameters<typeof missingFieldsOf>[0];

const step = (over: Record<string, unknown> = {}): Partial =>
  ({ easy_read_text: "Entras por una puerta de cristal.", missing_fields: [], ...over }) as Partial;

test("a complete step is missing nothing", () => {
  assert.deepEqual(missingFieldsOf(step()), []);
});

test("what the API listed as missing is missing", () => {
  assert.deepEqual(missingFieldsOf(step({ missing_fields: ["who_to_ask_for_help"] })), [
    "who_to_ask_for_help",
  ]);
});

test("an empty easy-read text counts as missing even when the API did not list it", () => {
  // The backend treats a step with no easy-read text as incomplete (db/guides.py), but it says so
  // only in the guide-wide count. Without mirroring that rule the panel warns "2 datos en blanco"
  // while every step on screen looks finished, and the person has nothing to click.
  assert.deepEqual(missingFieldsOf(step({ easy_read_text: null })), ["easy_read_text"]);
  assert.deepEqual(missingFieldsOf(step({ easy_read_text: "   " })), ["easy_read_text"]);
});

test("it is never listed twice when the API already said it", () => {
  const missing = missingFieldsOf(step({ easy_read_text: "", missing_fields: ["easy_read_text"] }));

  assert.deepEqual(missing, ["easy_read_text"]);
});

test("counting adds up every field of every step, not the steps", () => {
  const steps = [
    step({ easy_read_text: null }),
    step({ missing_fields: ["who_to_ask_for_help", "duration_text"] }),
    step(),
  ];

  assert.equal(countMissing(steps), 3);
});

test("nothing missing counts as zero", () => {
  assert.equal(countMissing([step(), step()]), 0);
});
