// What the review panel is holding that the server has not seen yet.
//
// The panel saves by itself, so there is always a moment where the screen and the database
// disagree. Every number the panel shows — "3 de 5 revisados", "2 datos por completar", whether
// the publish button is live — is computed from this file, which merges the two. Reading them
// from the server alone is what made the old panel feel like it was fighting the person: you
// filled a blank and the warning stayed until a round trip came back.
//
// It is also where one API rule is kept honest: `missing_fields` is what the AI could not see,
// and nothing on the backend ever shortens that list (api/db/guides.py, `_data_is_missing`). If
// the panel does not send it back shortened, a guide with one blank can never be published.

import { type Point, pointsAreSendable } from "./points.ts";
import { missingFieldsOf } from "./review.ts";

/** The three levels the contract allows. Kept here so lib/pure stays free of the API client. */
export type Noise = "quiet" | "medium" | "noisy";

/** The four fields of a step the panel can edit, as a form holds them: strings, never null. */
export type Draft = {
  easy_read_text: string;
  who_to_ask_for_help: string;
  duration_text: string;
  noise_level: Noise | "";
  /** The places the clip points at. Edited as a whole list, never field by field. */
  points_of_interest: Point[];
};

export const DRAFT_FIELDS = [
  "easy_read_text",
  "who_to_ask_for_help",
  "duration_text",
  "noise_level",
] as const;

type DraftField = (typeof DRAFT_FIELDS)[number];

type EditableStep = {
  id: string;
  order: number;
  reviewed: boolean;
  easy_read_text?: string | null;
  who_to_ask_for_help?: string | null;
  duration_text?: string | null;
  noise_level?: string | null;
  points_of_interest?: Point[] | null;
  missing_fields: string[];
};

/** Anything the panel may send for one step. A subset of StepPatch, which it must stay inside. */
export type Changes = {
  easy_read_text?: string | null;
  who_to_ask_for_help?: string | null;
  duration_text?: string | null;
  noise_level?: Noise | null;
  points_of_interest?: Point[];
  missing_fields?: string[];
  reviewed?: boolean;
};

const text = (value: string | null | undefined): string => value ?? "";

export function draftOf(step: EditableStep): Draft {
  return {
    easy_read_text: text(step.easy_read_text),
    who_to_ask_for_help: text(step.who_to_ask_for_help),
    duration_text: text(step.duration_text),
    // The contract types the answer as a plain string; the three values are the request side.
    noise_level: text(step.noise_level) as Noise | "",
    points_of_interest: step.points_of_interest ?? [],
  };
}

/**
 * What is still blank in this step, read from the screen.
 *
 * A name the AI listed but the form cannot edit stays missing: the panel has no control for it,
 * so claiming it is filled would be vouching for a blank nobody filled.
 */
export function missingInDraft(step: EditableStep, draft: Draft): string[] {
  return missingFieldsOf({
    easy_read_text: draft.easy_read_text,
    missing_fields: blanksAmong(step.missing_fields, draft),
  });
}

/** Of the names the AI could not fill, the ones that are still empty on screen. */
function blanksAmong(names: string[], draft: Draft): string[] {
  return names.filter((name) => {
    const field = DRAFT_FIELDS.find((known) => known === name);
    return field ? draft[field].trim() === "" : true;
  });
}

/** True while this step still needs a person: unreviewed, or with something blank. */
export function isFinished(step: EditableStep, draft: Draft): boolean {
  return step.reviewed && missingInDraft(step, draft).length === 0;
}

/**
 * What to send for this step, or null when the screen matches the server.
 *
 * The noise level only travels when it changed, because the API records any value the panel
 * sends as corrected by hand, which would erase the fact that the pipeline measured it.
 */
export function changesOf(step: EditableStep, draft: Draft): Changes | null {
  const changes: Changes = {};

  for (const field of ["easy_read_text", "who_to_ask_for_help", "duration_text"] as const) {
    const value = draft[field].trim();
    if (value !== text(step[field]).trim()) changes[field] = value === "" ? null : value;
  }
  if (draft.noise_level !== text(step.noise_level)) {
    changes.noise_level = draft.noise_level === "" ? null : draft.noise_level;
  }

  // The whole list travels, trimmed, only when it differs from the server's and the API would
  // take it. The AI's original stays on the server in `ai_draft`, so correcting it loses nothing.
  const points = draft.points_of_interest.map((point) => ({
    ...point,
    label: point.label.trim(),
    description: point.description.trim(),
  }));
  if (
    pointsAreSendable(points) &&
    JSON.stringify(points) !== JSON.stringify(step.points_of_interest ?? [])
  ) {
    changes.points_of_interest = points;
  }

  const missing = blanksAmong(step.missing_fields, draft);
  if (missing.length !== step.missing_fields.length) changes.missing_fields = missing;

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Fold one save's answer back into the guide on screen.
 *
 * Every answer carries the whole guide, and two fields of two different steps can be saving at
 * once. Taking an answer whole would undo whatever the other save had just written, so only the
 * step that was saved is taken from it; everything above the steps comes from the answer, which
 * is where the status and the slug change.
 */
export function mergeStep<S extends { id: string }, G extends { steps: S[] }>(
  current: G,
  answer: G,
  stepId: string,
): G {
  const saved = answer.steps.find((step) => step.id === stepId);
  return {
    ...answer,
    steps: current.steps.map((step) => (step.id === stepId ? (saved ?? step) : step)),
  };
}

export type ReviewState = {
  total: number;
  reviewed: number;
  /** Blanks across the whole guide. Fields, not steps: the banner names fields. */
  missing: number;
  ready: boolean;
  /** Where the publish bar sends the person: the first step that is not finished. */
  next: { id: string; order: number } | null;
};

/** The state of the whole review, counting what is on screen and not yet saved. */
export function reviewStateOf(
  steps: EditableStep[],
  drafts: Record<string, Draft | undefined>,
): ReviewState {
  let reviewed = 0;
  let missing = 0;
  let next: ReviewState["next"] = null;

  for (const step of steps) {
    const draft = drafts[step.id] ?? draftOf(step);
    if (step.reviewed) reviewed += 1;
    missing += missingInDraft(step, draft).length;
    if (!next && !isFinished(step, draft)) next = { id: step.id, order: step.order };
  }

  return {
    total: steps.length,
    reviewed,
    missing,
    ready: steps.length > 0 && reviewed === steps.length && missing === 0,
    next,
  };
}
