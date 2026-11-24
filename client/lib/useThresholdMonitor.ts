"use client";

import { useCallback, useRef, useState } from "react";

import {
  type HysteresisConfig,
  type HysteresisEvent,
  type HysteresisState,
  initialHysteresis,
  stepHysteresis,
} from "./pure/hysteresis.ts";

/** Runs a value through the hysteresis and exposes whether the warning is currently showing. */
export function useThresholdMonitor(config: HysteresisConfig, onEvent?: (event: HysteresisEvent) => void) {
  const state = useRef<HysteresisState>(initialHysteresis);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [active, setActive] = useState(false);

  const feed = useCallback(
    (value: number, now: number) => {
      const step = stepHysteresis(state.current, value, now, config);
      state.current = step.state;
      if (step.event) {
        setActive(step.state.active);
        handler.current?.(step.event);
      }
    },
    [config],
  );

  const reset = useCallback(() => {
    state.current = initialHysteresis;
    setActive(false);
  }, []);

  return { active, feed, reset };
}
