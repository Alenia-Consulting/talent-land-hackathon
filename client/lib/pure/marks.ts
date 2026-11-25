// The route is a list of parts the person chooses before recording; each one is recorded as its own
// take (see takes.ts). What is left here is what the plan itself needs.
//
// Pure functions only, so the rules can be tested without a camera.

import type { Category } from "../guides.ts";

export type Part = { title: string; category: Category };

/** The API refuses a route with fewer marks than this. */
export const MIN_MARKS = 1;

/** The most parts a plan can have: the API refuses a guide with more marks than this. */
export const MAX_MARKS = 12;

/** The parts offered before recording. The person picks and reorders; `other` covers the rest. */
export const CATALOGUE: readonly Part[] = [
  { title: "Entrada", category: "entrance" },
  { title: "Recepción", category: "reception" },
  { title: "Sala de espera", category: "waiting" },
  { title: "Pasillo", category: "corridor" },
  { title: "Consulta", category: "appointment" },
  { title: "Baños", category: "restroom" },
  { title: "Salida", category: "exit" },
];

/**
 * Why this route cannot be recorded yet, or null when it can.
 *
 * A reason rather than a sentence, because the screen that asks for the parts and the button in
 * the footer that is held back by the answer are two different components, and only one of them
 * shows the words.
 */
export function planProblem(venue: string, partCount: number): "venue" | "parts" | null {
  if (!venue.trim()) return "venue";
  if (partCount < MIN_MARKS) return "parts";
  return null;
}
