import assert from "node:assert/strict";
import { test } from "node:test";

import { CATALOGUE, MIN_MARKS, planProblem } from "../lib/pure/marks.ts";

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

test("a plan needs a venue before anything else", () => {
  assert.equal(planProblem("", 3), "venue");
  assert.equal(planProblem("   ", 3), "venue");
});

test("a plan needs at least one part", () => {
  assert.equal(planProblem("Centro de Salud Oeste", 0), "parts");
  assert.equal(planProblem("Centro de Salud Oeste", MIN_MARKS), null);
});
