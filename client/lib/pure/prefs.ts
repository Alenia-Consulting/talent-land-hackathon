// What the visitor chose for themselves: dim mode, text size, reading aloud, pictograms.
//
// Two rules from the design live here:
//   · "Sin diagnósticos. Se guarda solo en tu móvil." Nothing in here travels to the API, so
//     nothing in here can describe a person to anyone.
//   · The warning before every sound is NOT a preference. It is always on, so it has no key:
//     a setting that can be turned off is a setting that will be turned off by accident.
//
// Pure functions with the storage injected, so they can be tested without a browser and so a
// browser that refuses storage (private window) degrades to the defaults instead of blanking.

export const STORAGE_KEY = "antesala:prefs";

export type Theme = "claro" | "tenue";
export type TextSize = "s" | "m" | "l";

export type Prefs = {
  theme: Theme;
  textSize: TextSize;
  readAloud: boolean;
  pictograms: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  theme: "claro",
  textSize: "m",
  // Off by default: the guide offers it, the person turns it on. Nothing speaks unasked.
  readAloud: false,
  pictograms: true,
};

/** Multiplies the base font size. Medium is 1 so the design's 20–22 px is the unscaled case. */
export const TEXT_SCALE: Record<TextSize, number> = { s: 0.9, m: 1, l: 1.2 };

const THEMES: readonly string[] = ["claro", "tenue"];
const SIZES: readonly string[] = ["s", "m", "l"];

/** Minimal shape of localStorage, so tests need no browser. */
export type PrefsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function pick<T extends string>(value: unknown, allowed: readonly string[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readPrefs(storage: PrefsStorage | null | undefined): Prefs {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Storage disabled or blocked. The defaults are a perfectly good guide.
  }
  if (!raw) return DEFAULT_PREFS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFS;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_PREFS;

  const stored = parsed as Record<string, unknown>;
  return {
    theme: pick(stored.theme, THEMES, DEFAULT_PREFS.theme),
    textSize: pick(stored.textSize, SIZES, DEFAULT_PREFS.textSize),
    readAloud: bool(stored.readAloud, DEFAULT_PREFS.readAloud),
    pictograms: bool(stored.pictograms, DEFAULT_PREFS.pictograms),
  };
}

export function writePrefs(prefs: Prefs, storage: PrefsStorage | null | undefined): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Nothing to do and nothing to tell the person: the guide works the same this session.
  }
}
