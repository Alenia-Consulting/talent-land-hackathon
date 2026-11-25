import assert from "node:assert/strict";
import { test } from "node:test";

import type { Guide, Step } from "../lib/guides.ts";
import { hasSeveralRoutes, scopedToRoute, stepsOfRoute } from "../lib/pure/routes.ts";

const step = (id: string, route_id: string | null) => ({ id, route_id }) as unknown as Step;
const STEPS = [step("a", "r1"), step("b", "r1"), step("c", "r2")];

test("a chosen route keeps only its own steps", () => {
  assert.deepEqual(stepsOfRoute(STEPS, "r2").map((s) => s.id), ["c"]);
});

test("no route chosen shows every step", () => {
  assert.equal(stepsOfRoute(STEPS, null).length, 3);
});

test("an unknown route falls back to every step instead of an empty player", () => {
  assert.equal(stepsOfRoute(STEPS, "gone").length, 3);
});

test("scopedToRoute leaves the rest of the guide alone", () => {
  const guide = { title: "T", steps: STEPS, routes: [] } as unknown as Guide;
  const scoped = scopedToRoute(guide, "r1");
  assert.equal(scoped.title, "T");
  assert.equal(scoped.steps.length, 2);
});

test("only a guide with several recordings offers a choice", () => {
  assert.equal(hasSeveralRoutes({ routes: [{}] } as unknown as Guide), false);
  assert.equal(hasSeveralRoutes({ routes: [{}, {}] } as unknown as Guide), true);
});
