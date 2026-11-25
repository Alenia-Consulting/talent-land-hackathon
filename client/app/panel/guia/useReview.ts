"use client";

// One guide under review, and everything the panel does to it.
//
// The panel has no save button. It had two of them — "Guardar" and "Guardar y revisar" — which
// is a checkbox dressed up as a decision, and which meant that every correction only existed
// until somebody remembered to press something. Here a field saves itself: shortly after the
// typing stops, and at once when the field is left. The only button left is the one that says a
// human has read this step, which is the decision the product actually turns on.
//
// Saving is per step. The old panel kept one `busy` flag for the whole guide, so a save on step 4
// greyed out every field of every step for as long as the request took: the "refresh" the screen
// seemed to do on each press.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  type Guide,
  patchStep,
  publishGuide,
  readGuide,
  type StepPatch,
} from "../../../lib/guides.ts";
import { type Changes, changesOf, type Draft, draftOf, mergeStep } from "../../../lib/pure/draft.ts";

/** How long the panel waits after the last keystroke before saving by itself. */
const QUIET_MS = 800;

/** Where one step's edits are: `pending` means on screen and not yet sent. */
export type SaveState = "clean" | "pending" | "saving" | "saved" | "error";

export type Review = {
  guide: Guide | null;
  drafts: Record<string, Draft>;
  states: Record<string, SaveState>;
  error: string | null;
  publishing: boolean;
  /** Change one field. Schedules the save; does not send it yet. */
  edit: (stepId: string, patch: Partial<Draft>) => void;
  /** Send this step's edits now, if it has any. Called when a field is left. */
  save: (stepId: string) => void;
  /** Save and record that a person has read this step. */
  markReviewed: (stepId: string, reviewed: boolean) => void;
  /** Flush every pending edit, then approve. */
  publish: () => void;
};

export function useReview(id: string | null): Review {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Mirrored in refs because the timer that fires after the last keystroke must read what is on
  // screen when it fires, not what was on screen when the key was pressed.
  const guideRef = useRef<Guide | null>(null);
  const draftsRef = useRef<Record<string, Draft>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inFlight = useRef<Record<string, Promise<unknown>>>({});

  const keep = useCallback((next: Guide) => {
    guideRef.current = next;
    setGuide(next);
  }, []);

  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError ? cause.message : String(cause));
  }, []);

  useEffect(() => {
    if (!id) return;
    readGuide(id)
      .then((loaded) => {
        keep(loaded);
        const seeded: Record<string, Draft> = {};
        for (const step of loaded.steps) seeded[step.id] = draftOf(step);
        draftsRef.current = seeded;
        setDrafts(seeded);
      })
      .catch(fail);
  }, [id, keep, fail]);

  const send = useCallback(
    (stepId: string, extra: Changes = {}) => {
      const current = guideRef.current;
      const step = current?.steps.find((one) => one.id === stepId);
      if (!id || !current || !step) return;

      clearTimeout(timers.current[stepId]);
      delete timers.current[stepId];

      const draft = draftsRef.current[stepId] ?? draftOf(step);
      const changes = { ...(changesOf(step, draft) ?? {}), ...extra };
      if (Object.keys(changes).length === 0) return;

      setStates((before) => ({ ...before, [stepId]: "saving" }));
      setError(null);
      const request = patchStep(id, stepId, changes as StepPatch)
        .then((answer) => {
          keep(mergeStep(guideRef.current ?? answer, answer, stepId));
          setStates((before) => ({ ...before, [stepId]: "saved" }));
        })
        .catch((cause: unknown) => {
          setStates((before) => ({ ...before, [stepId]: "error" }));
          fail(cause);
        })
        .finally(() => {
          delete inFlight.current[stepId];
        });
      inFlight.current[stepId] = request;
    },
    [id, keep, fail],
  );

  const edit = useCallback(
    (stepId: string, patch: Partial<Draft>) => {
      const step = guideRef.current?.steps.find((one) => one.id === stepId);
      if (!step) return;
      const next = {
        ...draftsRef.current,
        [stepId]: { ...(draftsRef.current[stepId] ?? draftOf(step)), ...patch },
      };
      draftsRef.current = next;
      setDrafts(next);
      setStates((before) => ({ ...before, [stepId]: "pending" }));

      clearTimeout(timers.current[stepId]);
      timers.current[stepId] = setTimeout(() => send(stepId), QUIET_MS);
    },
    [send],
  );

  // Held so the two listeners below always call the current one without re-subscribing.
  const sendRef = useRef(send);
  sendRef.current = send;

  // An edit waiting on its timer must not be lost because the person left the screen or put the
  // phone away: both send what is pending instead of dropping it.
  useEffect(() => {
    const scheduled = timers.current;
    const flush = () => {
      for (const stepId of Object.keys(scheduled)) sendRef.current(stepId);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, []);

  const save = useCallback((stepId: string) => send(stepId), [send]);

  const markReviewed = useCallback(
    (stepId: string, reviewed: boolean) => send(stepId, { reviewed }),
    [send],
  );

  const publish = useCallback(() => {
    if (!id) return;
    // Anything still waiting on its timer goes first: publishing text the server has never seen
    // would put the draft online and call it reviewed.
    for (const stepId of Object.keys(timers.current)) send(stepId);
    setPublishing(true);
    setError(null);
    Promise.all(Object.values(inFlight.current))
      .then(() => publishGuide(id))
      .then(keep)
      .catch(fail)
      .finally(() => setPublishing(false));
  }, [id, send, keep, fail]);

  return { guide, drafts, states, error, publishing, edit, save, markReviewed, publish };
}
