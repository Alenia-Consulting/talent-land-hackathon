"use client";

// The takes of a recording session and what happens to each one.
//
// The page owns the camera; this owns the list. A take is recorded, waits on the phone while the
// person can still repeat it, and is sent when they leave that part (record the next one or
// finish). Sends go one after another through a queue: the first creates the guide and the rest
// add to it, so they cannot overlap without creating the guide twice.
//
// Whatever fails fails one row. Its video stays on the phone and the row can be retried.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addRoute,
  ApiError,
  createGuide,
  deleteRoute,
  type Guide,
  type NoiseLevel,
} from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import type { Part } from "../../lib/pure/marks.ts";
import {
  markOf,
  resetTake,
  sendPlan,
  type Take,
  type TakeState,
  takesFromParts,
} from "../../lib/pure/takes.ts";
import { RECORDING } from "../../lib/config.ts";
import { downloadGuide, type GuideInput, uploadVideo, VideoUploadError } from "../../lib/upload.ts";

export type Session = { title: string; venue: string };

/** Where the takes go: a new guide, or one that already exists (opened with ?guia=ID). */
export type Target = { id: string; knownRoutes: string[] } | null;

export function useTakes(target: Target) {
  const [takes, setTakesState] = useState<Take[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [guideId, setGuideId] = useState<string | null>(target?.id ?? null);

  // The queue reads the latest values, not the ones of the render that queued the send.
  const latest = useRef<Take[]>([]);
  const guide = useRef<string | null>(target?.id ?? null);
  const session = useRef<Session | null>(null);
  const known = useRef(new Set<string>(target?.knownRoutes ?? []));
  const inputs = useRef(new Map<number, GuideInput>());
  const queue = useRef<Promise<void>>(Promise.resolve());

  // The target of "?guia=ID" arrives after the first render, once the guide has been read.
  useEffect(() => {
    if (!target) return;
    guide.current = target.id;
    setGuideId(target.id);
    for (const id of target.knownRoutes) known.current.add(id);
  }, [target]);

  const setTakes = useCallback((next: Take[]) => {
    latest.current = next;
    setTakesState(next);
  }, []);

  const patch = useCallback(
    (index: number, changes: Partial<Take>) => {
      setTakes(latest.current.map((take, i) => (i === index ? { ...take, ...changes } : take)));
    },
    [setTakes],
  );

  const fail = useCallback(
    (index: number, message: string) => {
      patch(index, { state: "failed" });
      setErrors((now) => ({ ...now, [index]: message }));
    },
    [patch],
  );

  const begin = useCallback(
    (parts: readonly Part[], who: Session) => {
      session.current = who;
      setTakes(takesFromParts(parts));
      setErrors({});
    },
    [setTakes],
  );

  const record = useCallback(
    (index: number, input: GuideInput) => {
      inputs.current.set(index, input);
      patch(index, { state: "recorded", durationSec: Math.round(input.durationSec) });
    },
    [patch],
  );

  const setNoise = useCallback(
    (index: number, noise: NoiseLevel | null) => patch(index, { noise }),
    [patch],
  );

  /** Remember the routes the server now has, so the next answer's new one can be told apart. */
  const learn = (updated: Guide): string | null => {
    const created = updated.routes.find((route) => !known.current.has(route.id));
    for (const route of updated.routes) known.current.add(route.id);
    return created?.id ?? null;
  };

  const send = useCallback(
    async (index: number) => {
      const take = latest.current[index];
      const input = inputs.current.get(index);
      const who = session.current;
      if (!take || !input || !who) return;
      if (input.blob.size > RECORDING.maxUploadBytes) return fail(index, es.takes.tooBig);

      patch(index, { state: "uploading" });
      setErrors(({ [index]: _, ...rest }) => rest);
      setProgress((now) => ({ ...now, [index]: 0 }));
      try {
        // A retry reuses the route the first try created: creating it again would duplicate it.
        let routeId = take.routeId;
        if (!routeId) {
          const mark = markOf(take);
          const plan = sendPlan(latest.current, index, guide.current);
          let updated: Guide;
          if (plan.kind === "create") {
            updated = await createGuide({
              title: who.title,
              venue_name: who.venue,
              video_duration_seconds: input.durationSec,
              marks: [mark],
              route_title: take.part.title,
            });
          } else {
            updated = await addRoute(plan.guideId, {
              title: take.part.title,
              video_duration_seconds: input.durationSec,
              marks: [mark],
              // A guide that already existed gets the take at the end: the plan's places mean
              // nothing next to routes recorded before.
              ...(target ? {} : { position: plan.position }),
            });
          }
          guide.current = updated.id;
          setGuideId(updated.id);
          routeId = learn(updated);
          patch(index, { routeId });
        }
        if (!routeId) throw new ApiError(0, es.error.uploadFailed);
        await uploadVideo(
          guide.current as string,
          input,
          (fraction) => setProgress((now) => ({ ...now, [index]: fraction })),
          undefined,
          routeId,
        );
        patch(index, { state: "sent" });
      } catch (cause) {
        if (cause instanceof VideoUploadError && cause.status === 503) {
          return fail(index, es.takes.unavailable);
        }
        const known_ = cause instanceof ApiError || (cause instanceof VideoUploadError && cause.status > 0);
        fail(index, known_ ? (cause as Error).message : es.error.uploadFailed);
      }
    },
    [fail, patch, target],
  );

  const enqueue = useCallback(
    (index: number) => {
      queue.current = queue.current.then(() => send(index));
    },
    [send],
  );

  /** Send every take that is waiting, except the one about to be recorded. */
  const flush = useCallback(
    (except: number | null = null) => {
      latest.current.forEach((take, index) => {
        if (take.state === "recorded" && index !== except) enqueue(index);
      });
    },
    [enqueue],
  );

  const retry = useCallback((index: number) => enqueue(index), [enqueue]);

  /**
   * Record this part again, without touching the others.
   *
   * Still on the phone: it is just dropped. Already on the server: that route is deleted first
   * and the new take enters the same place. If the delete works and the new take never arrives,
   * the guide has one part less, not a broken one, and the row says so.
   */
  const repeat = useCallback(
    async (index: number): Promise<boolean> => {
      const take = latest.current[index];
      if (take?.routeId && guide.current) {
        try {
          await deleteRoute(guide.current, take.routeId);
        } catch (cause) {
          setErrors((now) => ({
            ...now,
            [index]: cause instanceof ApiError ? cause.message : es.takes.deleteFailed,
          }));
          return false;
        }
        known.current.delete(take.routeId);
      }
      inputs.current.delete(index);
      setTakes(resetTake(latest.current, index));
      setErrors(({ [index]: _, ...rest }) => rest);
      return true;
    },
    [setTakes],
  );

  const download = useCallback((index: number) => {
    const input = inputs.current.get(index);
    if (input) downloadGuide(input);
  }, []);

  return {
    takes,
    errors,
    progress,
    guideId,
    begin,
    record,
    setNoise,
    flush,
    retry,
    repeat,
    download,
  };
}

export type { TakeState };
