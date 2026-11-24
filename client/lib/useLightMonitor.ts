"use client";

import { useEffect } from "react";

import { RECORDING } from "./config.ts";
import type { HysteresisEvent } from "./pure/hysteresis.ts";
import type { FrameSample } from "./useFrameSampler.ts";
import { useThresholdMonitor } from "./useThresholdMonitor.ts";

const CONFIG = { mode: "low", ...RECORDING.light } as const;

/** "Poca luz" warning: mean luminance below the limit for 1.5 s, cleared above limit + 10 for 1 s. */
export function useLightMonitor(sample: FrameSample | null, onEvent?: (event: HysteresisEvent) => void) {
  const { active, feed } = useThresholdMonitor(CONFIG, onEvent);

  useEffect(() => {
    if (sample) feed(sample.luminance, sample.t);
  }, [sample, feed]);

  return { active, luminance: sample?.luminance ?? null };
}
