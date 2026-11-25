import assert from "node:assert/strict";
import { test } from "node:test";

import {
  changesOf,
  draftOf,
  mergeStep,
  missingInDraft,
  reviewStateOf,
} from "../lib/pure/draft.ts";

type Step = Parameters<typeof draftOf>[0];

const step = (over: Record<string, unknown> = {}): Step =>
  ({
    id: "a",
    order: 1,
    reviewed: false,
    easy_read_text: "Entras por una puerta de cristal.",
    who_to_ask_for_help: "El mostrador de la entrada",
    duration_text: "2 minutos",
    noise_level: "quiet",
    missing_fields: [],
    ...over,
  }) as Step;

test("a draft is the step's fields as strings, never null", () => {
  const empty = step({
    easy_read_text: null,
    who_to_ask_for_help: null,
    duration_text: null,
    noise_level: null,
  });

  assert.deepEqual(draftOf(empty), {
    easy_read_text: "",
    who_to_ask_for_help: "",
    duration_text: "",
    noise_level: "",
    points_of_interest: [],
  });
});

test("nothing to send while the draft matches the step", () => {
  const original = step();

  assert.equal(changesOf(original, draftOf(original)), null);
});

test("only the fields that changed travel, trimmed", () => {
  const original = step();
  const changes = changesOf(original, { ...draftOf(original), easy_read_text: "  Otro texto. " });

  assert.deepEqual(changes, { easy_read_text: "Otro texto." });
});

test("a field emptied by hand travels as null, not as an empty string", () => {
  const original = step();
  const changes = changesOf(original, { ...draftOf(original), duration_text: "   " });

  // And it does not grow missing_fields: that list is what the AI could not see in the video,
  // not a record of what a person decided to leave out.
  assert.deepEqual(changes, { duration_text: null });
});

test("the noise level only travels when it changed, so a measurement stays a measurement", () => {
  // Sending it unchanged would have the API record it as corrected by hand (api/db/guides.py
  // sets noise_level_source = "manual" whenever the key is present).
  const original = step({ noise_level: "quiet" });

  assert.equal(changesOf(original, draftOf(original)), null);
  assert.deepEqual(changesOf(original, { ...draftOf(original), noise_level: "noisy" }), {
    noise_level: "noisy",
  });
});

test("filling a blank the AI left clears it from missing_fields", () => {
  // Without this the API keeps counting the field as missing (db/guides.py `_data_is_missing`
  // reads missing_fields, which nothing else ever shortens) and refuses to publish forever.
  const original = step({
    who_to_ask_for_help: null,
    duration_text: null,
    missing_fields: ["who_to_ask_for_help", "duration_text"],
  });

  const changes = changesOf(original, {
    ...draftOf(original),
    who_to_ask_for_help: "Mostrador de recepción",
  });

  assert.deepEqual(changes, {
    who_to_ask_for_help: "Mostrador de recepción",
    missing_fields: ["duration_text"],
  });
});

test("a blank the panel cannot fill stays listed", () => {
  // The form edits four fields. Anything else Gemini could not see is still missing, and saying
  // otherwise would be the panel vouching for a blank nobody filled.
  const original = step({ missing_fields: ["what_to_expect"] });

  assert.equal(changesOf(original, draftOf(original)), null);
});

test("what is missing is read from the screen, not from the last save", () => {
  const original = step({
    easy_read_text: null,
    who_to_ask_for_help: null,
    missing_fields: ["who_to_ask_for_help"],
  });

  assert.deepEqual(missingInDraft(original, draftOf(original)), [
    "easy_read_text",
    "who_to_ask_for_help",
  ]);
  // Typing is enough: the warning goes before anything is sent.
  assert.deepEqual(
    missingInDraft(original, { ...draftOf(original), who_to_ask_for_help: "Recepción" }),
    ["easy_read_text"],
  );
});

test("a reviewed step with blanks is still not finished", () => {
  const state = reviewStateOf([step({ reviewed: true, easy_read_text: null })], {});

  assert.equal(state.reviewed, 1);
  assert.equal(state.missing, 1);
  assert.equal(state.ready, false);
});

test("the guide is ready when every step is reviewed and nothing is blank", () => {
  const steps = [step({ id: "a", reviewed: true }), step({ id: "b", order: 2, reviewed: true })];

  assert.deepEqual(reviewStateOf(steps, {}), {
    total: 2,
    reviewed: 2,
    missing: 0,
    ready: true,
    next: null,
  });
});

test("the next thing to do is the first step that is not finished", () => {
  const steps = [
    step({ id: "a", order: 1, reviewed: true }),
    step({ id: "b", order: 2, reviewed: false }),
    step({ id: "c", order: 3, reviewed: false }),
  ];

  assert.deepEqual(reviewStateOf(steps, {}).next, { id: "b", order: 2 });
});

test("an unsaved blank still counts, and an unsaved fix stops counting", () => {
  const steps = [step({ id: "a", reviewed: true })];

  assert.equal(reviewStateOf(steps, { a: { ...draftOf(steps[0]), easy_read_text: "" } }).ready, false);

  const blank = [step({ id: "a", reviewed: true, easy_read_text: null })];
  assert.equal(
    reviewStateOf(blank, { a: { ...draftOf(blank[0]), easy_read_text: "Ya está escrito." } }).ready,
    true,
  );
});

test("a save only brings back the step it saved", () => {
  // Two fields of two different steps can be in flight at once, and each answer carries the whole
  // guide. Taking an answer whole would undo whatever the other save had just written.
  const before = { status: "draft", steps: [step({ id: "a" }), step({ id: "b", order: 2 })] };
  const local = {
    ...before,
    steps: [before.steps[0], { ...before.steps[1], who_to_ask_for_help: "Recién escrito" }],
  };
  const answer = {
    status: "needs_review",
    steps: [{ ...before.steps[0], reviewed: true }, before.steps[1]],
  };

  const merged = mergeStep(local, answer, "a");

  assert.equal(merged.status, "needs_review");
  assert.equal(merged.steps[0].reviewed, true);
  assert.equal(merged.steps[1].who_to_ask_for_help, "Recién escrito");
});

test("merging keeps the order on screen even if the answer reshuffles", () => {
  const before = { steps: [step({ id: "a" }), step({ id: "b", order: 2 })] };
  const answer = { steps: [before.steps[1], before.steps[0]] };

  assert.deepEqual(
    mergeStep(before, answer, "a").steps.map((one) => one.id),
    ["a", "b"],
  );
});

const pointOf = (label: string) => ({
  label,
  description: "Busca las puertas de cristal.",
  kind: "door" as const,
  box_2d: [100, 100, 300, 300],
});

test("correcting the points sends the whole list, trimmed", () => {
  const original = step({ points_of_interest: [pointOf("Puerta")] });
  const draft = { ...draftOf(original), points_of_interest: [pointOf("  Puerta principal ")] };

  assert.deepEqual(changesOf(original, draft), {
    points_of_interest: [pointOf("Puerta principal")],
  });
});

test("deleting every point is a change worth sending", () => {
  const original = step({ points_of_interest: [pointOf("Puerta")] });

  assert.deepEqual(changesOf(original, { ...draftOf(original), points_of_interest: [] }), {
    points_of_interest: [],
  });
});

test("untouched points are not sent", () => {
  const original = step({ points_of_interest: [pointOf("Puerta")] });

  assert.equal(changesOf(original, draftOf(original)), null);
});

test("a point whose name was just emptied waits instead of being refused by the API", () => {
  const original = step({ points_of_interest: [pointOf("Puerta")] });
  const draft = { ...draftOf(original), points_of_interest: [pointOf("")] };

  assert.equal(changesOf(original, draft), null);
});
