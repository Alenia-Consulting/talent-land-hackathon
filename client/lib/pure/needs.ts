// "¿Qué te cuesta en un sitio nuevo?" — and what the guide does about it.
//
// The screen promises to switch on what helps, so this says exactly what each answer switches
// on, and nothing else. Two of the five answers map to no setting: the guide already never
// sounds unasked and already shows one step per screen, for everyone. Flipping something anyway
// so the screen looks busy would be the product taking credit for work it did not do.
//
// Nothing here leaves the phone. The answers choose settings and are then forgotten; what is
// stored is the settings, never the answers — "sin diagnósticos", as the design says.

import type { Prefs } from "./prefs.ts";

export const NEEDS = ["sight", "hearing", "reading", "overload", "wayfinding"] as const;

export type Need = (typeof NEEDS)[number];

const ANSWERS: Record<Need, Partial<Prefs>> = {
  sight: { textSize: "l", readAloud: true },
  hearing: {},
  reading: { pictograms: true, readAloud: true },
  overload: { theme: "tenue" },
  wayfinding: {},
};

/** The settings to switch on for the answers given, with no answer overriding another. */
export function settingsFor(needs: readonly Need[]): Partial<Prefs> {
  return needs.reduce<Partial<Prefs>>((patch, need) => ({ ...patch, ...ANSWERS[need] }), {});
}
