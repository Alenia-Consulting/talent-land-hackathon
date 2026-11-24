"use client";

import { useCallback, useRef, useState } from "react";

import {
  type AlertLogState,
  type AlertType,
  applyAlertEvent,
  beginLog,
  finishLog,
  type RecordingAlert,
} from "./pure/alerts.ts";

/** Collects quality alerts while recording, in seconds relative to the recording start. */
export function useAlertLog() {
  const log = useRef<AlertLogState | null>(null);
  const [alerts, setAlerts] = useState<RecordingAlert[]>([]);

  const begin = useCallback((t0: number, active: AlertType[]) => {
    log.current = beginLog(t0, active);
    setAlerts([]);
  }, []);

  const record = useCallback((tipo: AlertType, event: { type: "start" | "end"; at: number }) => {
    if (log.current) log.current = applyAlertEvent(log.current, tipo, event);
  }, []);

  /** Closes open alerts at `endAt` (performance.now()) and returns the final list. */
  const finish = useCallback((endAt: number) => {
    if (!log.current) return [];
    const final = finishLog(log.current, endAt);
    log.current = null;
    setAlerts(final);
    return final;
  }, []);

  const reset = useCallback(() => {
    log.current = null;
    setAlerts([]);
  }, []);

  return { alerts, begin, record, finish, reset };
}
