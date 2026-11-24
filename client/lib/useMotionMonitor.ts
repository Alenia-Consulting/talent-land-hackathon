"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDING } from "./config.ts";
import { rotationMagnitude } from "./pure/frames.ts";
import type { HysteresisEvent } from "./pure/hysteresis.ts";
import type { FrameSample } from "./useFrameSampler.ts";
import { useThresholdMonitor } from "./useThresholdMonitor.ts";

export type MotionPermission = "granted" | "denied" | "unsupported" | "pending";
export type MotionSource = "gyro" | "frames";

type DeviceMotionConstructor = { requestPermission?: () => Promise<"granted" | "denied"> };

// The gyroscope counts as live while events keep arriving; otherwise frame differences take over.
const GYRO_FRESH_MS = 1500;

// Module-level so the hysteresis callbacks keep a stable identity across renders.
const GYRO_CONFIG = { mode: "high", ...RECORDING.gyro } as const;
const FRAMES_CONFIG = { mode: "high", ...RECORDING.frameDiff } as const;

/**
 * "Más despacio" warning. Uses the gyroscope (°/s) when available and falls back to the difference
 * between consecutive frames. `requestPermission` must be called synchronously inside a tap handler.
 */
export function useMotionMonitor(
  sample: FrameSample | null,
  enabled: boolean,
  onEvent?: (event: HysteresisEvent) => void,
) {
  const gyro = useThresholdMonitor(GYRO_CONFIG, onEvent);
  const frames = useThresholdMonitor(FRAMES_CONFIG, onEvent);
  const [permission, setPermission] = useState<MotionPermission>("pending");
  const [source, setSource] = useState<MotionSource>("frames");
  const [value, setValue] = useState<{ gyro: number | null; diff: number | null }>({ gyro: null, diff: null });
  // Peak rotation since the last sample, and when the last gyroscope event arrived.
  const peak = useRef(0);
  const lastEventAt = useRef<number | null>(null);
  const lastSampleT = useRef<number | null>(null);

  const requestPermission = useCallback(async (): Promise<MotionPermission> => {
    const ctor = (window as { DeviceMotionEvent?: DeviceMotionConstructor }).DeviceMotionEvent;
    let result: MotionPermission = ctor ? "granted" : "unsupported";
    if (typeof ctor?.requestPermission === "function") {
      try {
        result = await ctor.requestPermission();
      } catch {
        result = "denied";
      }
    }
    setPermission(result);
    return result;
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const onMotion = (event: DeviceMotionEvent) => {
      const magnitude = rotationMagnitude(event.rotationRate);
      if (magnitude === null) return;
      peak.current = Math.max(peak.current, magnitude);
      lastEventAt.current = performance.now();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [enabled, permission]);

  useEffect(() => {
    if (enabled) return;
    gyro.reset();
    frames.reset();
    peak.current = 0;
    lastEventAt.current = null;
  }, [enabled, gyro.reset, frames.reset]);

  useEffect(() => {
    if (!enabled || !sample || sample.t === lastSampleT.current) return;
    lastSampleT.current = sample.t;
    const gyroLive = lastEventAt.current !== null && sample.t - lastEventAt.current < GYRO_FRESH_MS;
    const dps = gyroLive ? peak.current : null;
    peak.current = 0;
    setSource(gyroLive ? "gyro" : "frames");
    setValue({ gyro: dps, diff: sample.diff });
    if (dps !== null) {
      gyro.feed(dps, sample.t);
      frames.reset();
    } else if (sample.diff !== null) {
      frames.feed(sample.diff, sample.t);
      gyro.reset();
    }
  }, [sample, enabled, gyro.feed, gyro.reset, frames.feed, frames.reset]);

  return {
    active: source === "gyro" ? gyro.active : frames.active,
    source,
    permission,
    gyroDps: value.gyro,
    frameDiff: value.diff,
    requestPermission,
  };
}
