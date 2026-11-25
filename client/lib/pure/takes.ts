// The list of takes: one recording per part, in the order of the plan.
//
// The person picks the parts, then records each one when they are ready. A take is the whole of
// its part, so there is nothing to cut and no clock to reconcile with the file: a failure costs
// one row, never the walk.
//
// Pure functions over the list, without React or the camera, so the rules can be tested alone.

import type { Mark, NoiseLevel } from "../guides.ts";
import type { Part } from "./marks.ts";

export type TakeState = "pending" | "recorded" | "uploading" | "sent" | "failed";

export type Take = {
  part: Part;
  state: TakeState;
  /** The recording this take became on the server, once it has been created there. */
  routeId: string | null;
  durationSec: number | null;
  /** How the person said it sounded, or null when they did not answer. */
  noise: NoiseLevel | null;
};

export function takesFromParts(parts: readonly Part[]): Take[] {
  return parts.map((part) => ({
    part,
    state: "pending",
    routeId: null,
    durationSec: null,
    noise: null,
  }));
}

/** The first part still to record. Out of order is allowed: the list marks where each one goes. */
export function nextToRecord(takes: readonly Take[]): number | null {
  const index = takes.findIndex((take) => take.state === "pending");
  return index === -1 ? null : index;
}

/** Takes that exist: anything but pending, a failed one included, since its video is on the phone. */
export function recordedCount(takes: readonly Take[]): number {
  return takes.filter((take) => take.state !== "pending").length;
}

/**
 * One take is enough. Stopping halfway stopped being an error: the part you did not record is
 * simply not in the guide, and can be added another day.
 */
export function canFinish(takes: readonly Take[]): boolean {
  return recordedCount(takes) > 0;
}

/**
 * How a take reaches the server: the first one creates the guide, every later one is added to it.
 * Creating twice would leave a duplicate in the panel with half the steps in each.
 *
 * The position is its place among the takes that already exist, not its place in the plan: with
 * "Recepción" recorded and "Entrada" still pending, recording "Sala de espera" goes second, not
 * third. The API moves the ones after it down.
 */
export function sendPlan(
  takes: readonly Take[],
  index: number,
  guideId: string | null,
): { kind: "create" } | { kind: "addRoute"; guideId: string; position: number } {
  if (!guideId) return { kind: "create" };
  const before = takes.slice(0, index).filter((take) => take.routeId !== null).length;
  return { kind: "addRoute", guideId, position: before + 1 };
}

/** The single mark a take carries: its whole video is the part, so it starts at the second 0. */
export function markOf(take: Take): Mark {
  return {
    title: take.part.title,
    category: take.part.category,
    marked_at_seconds: 0,
    ...(take.noise ? { noise_level: take.noise } : {}),
  };
}

/** A take that goes back to waiting, without touching any other. */
export function resetTake(takes: readonly Take[], index: number): Take[] {
  return takes.map((take, i) =>
    i === index ? { ...take, state: "pending", routeId: null, durationSec: null, noise: null } : take,
  );
}
