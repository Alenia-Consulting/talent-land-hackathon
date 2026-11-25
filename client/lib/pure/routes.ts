// Which recording of a guide a visitor is looking at.

import type { Guide, Step } from "../guides.ts";

/** The steps of one route, or all of them when none is chosen (or the choice is unknown). */
export function stepsOfRoute(steps: Step[], routeId: string | null): Step[] {
  if (!routeId) return steps;
  const own = steps.filter((step) => step.route_id === routeId);
  return own.length > 0 ? own : steps;
}

/** The guide as if it only had the chosen route, so every view can keep reading `guide.steps`. */
export function scopedToRoute(guide: Guide, routeId: string | null): Guide {
  return { ...guide, steps: stepsOfRoute(guide.steps, routeId) };
}

/** Routes worth offering: a guide with a single recording has nothing to choose between. */
export function hasSeveralRoutes(guide: Guide): boolean {
  return guide.routes.length > 1;
}
