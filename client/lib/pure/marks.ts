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
    return `Marca al menos dos partes del recorrido. Llevas ${marks.length}.`;
  }
  if (marks.length > MAX_MARKS) {
    return `Son demasiadas partes: ${marks.length}. El máximo es ${MAX_MARKS}.`;
  }
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].marked_at_seconds <= marks[i - 1].marked_at_seconds) {
      return "Las marcas están fuera de orden: cada una debe ir después de la anterior.";
    }
  }

  const last = marks[marks.length - 1].marked_at_seconds;
  if (last >= durationSec) {
    return "Hay una marca posterior al final del vídeo.";
  }
  if (last + PAUSE_MS / 1000 > durationSec) {
    return "La última marca está demasiado pegada al final del vídeo: ese paso se quedaría sin imagen.";
  }
  return null;
}
