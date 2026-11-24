// Time-based hysteresis shared by the light and motion monitors.
//
// "low" mode (light): the alert starts after the value stays BELOW `threshold` for `onMs` and ends
// after it stays ABOVE `threshold + margin` for `offMs`. "high" mode (motion) is the mirror image:
// starts above `threshold`, ends below `threshold - margin`.

export type HysteresisConfig = {
  mode: "low" | "high";
  threshold: number;
  margin: number;
  onMs: number;
  offMs: number;
};

export type HysteresisState = {
  active: boolean;
  /** When the value first met the pending flip condition, or null if it does not. */
  since: number | null;
};

export type HysteresisEvent = {
  type: "start" | "end";
  /** When the condition that caused the flip began (not when the flip was confirmed). */
  at: number;
};

export const initialHysteresis: HysteresisState = { active: false, since: null };

function meetsFlipCondition(active: boolean, value: number, cfg: HysteresisConfig): boolean {
  if (cfg.mode === "low") {
    return active ? value > cfg.threshold + cfg.margin : value < cfg.threshold;
  }
  return active ? value < cfg.threshold - cfg.margin : value > cfg.threshold;
}

export function stepHysteresis(
  state: HysteresisState,
  value: number,
  now: number,
  cfg: HysteresisConfig,
): { state: HysteresisState; event: HysteresisEvent | null } {
  if (!meetsFlipCondition(state.active, value, cfg)) {
    return { state: { active: state.active, since: null }, event: null };
  }
  const since = state.since ?? now;
  const holdMs = state.active ? cfg.offMs : cfg.onMs;
  if (now - since >= holdMs) {
    return {
      state: { active: !state.active, since: null },
      event: { type: state.active ? "end" : "start", at: since },
    };
  }
  return { state: { active: state.active, since }, event: null };
}
