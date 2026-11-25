// The route is marked by a person, not detected by the AI: before recording they pick the parts
// they will walk through, and while recording they tap "Llegué a: X" on arrival. Each mark becomes
// a step that runs until the next one.
//
// Pure functions only, so the rules can be tested without a camera.

import type { Category, Mark } from "../guides.ts";

export type Part = { title: string; category: Category };

/** The app asks the person to stand still this long on arrival: the photo is taken mid-pause. */
export const PAUSE_MS = 3000;

/** The API refuses a route with fewer marks than this. */
export const MIN_MARKS = 2;

/** The API refuses more than this, and a longer route does not fit in a two minute video. */
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

/** Where in the recording this part was reached. `elapsedMs` is measured from the recorder's t0. */
export function markAt(part: Part, elapsedMs: number): Mark {
  return {
    title: part.title,
    category: part.category,
    marked_at_seconds: Math.floor(elapsedMs / 100) / 10,
  };
}

/**
 * Why these marks cannot be sent yet, or null when they can.
 *
 * The API enforces all of this too and answers 422. Checking here first means the person is told
 * what is wrong while they still have the recording, instead of after losing it to an error.
 */
export function whyNotSendable(marks: Mark[], durationSec: number): string | null {
  if (marks.length < MIN_MARKS) {
    return marks.length === 0
      ? "No marcaste ninguna parte. Repite la grabación y pulsa «Llegué a» al llegar a cada una."
      : "Solo marcaste una parte, y hacen falta dos. Repite la grabación y pulsa «Llegué a» en cada parte.";
  }
  if (marks.length > MAX_MARKS) {
    return `Son demasiadas partes: ${marks.length}. El máximo es ${MAX_MARKS}.`;
  }
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].marked_at_seconds <= marks[i - 1].marked_at_seconds) {
      return "Dos marcas quedaron en el mismo segundo o fuera de orden. Repite la grabación y deja unos segundos entre una parte y la siguiente.";
    }
  }

  const last = marks[marks.length - 1].marked_at_seconds;
  if (last >= durationSec) {
    return "Hay una marca posterior al final del vídeo. Repite la grabación.";
  }
  if (last + PAUSE_MS / 1000 > durationSec) {
    return (
      "Marcaste la última parte justo antes de parar, y ese paso se quedaría sin foto. " +
      "Repite la grabación y, después de marcar la última parte, sigue grabando 3 segundos antes de pulsar «Parar»."
    );
  }
  return null;
}
