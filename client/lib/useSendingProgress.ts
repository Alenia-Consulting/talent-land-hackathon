"use client";

import { useCallback, useEffect, useState } from "react";

import { sendingProgress } from "./pure/progress.ts";

/**
 * The sending screen's bar: bytes while uploading, then an estimate while the server works, and
 * 1 only after `finish()`, which the caller makes when POST /video answers 200.
 */
export function useSendingProgress(durationSec: number) {
  const [uploaded, setUploaded] = useState(0);
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(false);

  // The estimate moves with time, so it needs a clock while the server is working.
  useEffect(() => {
    if (since === null || done) return;
    const timer = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(timer);
  }, [since, done]);

  /** Upload progress, 0–1. The last byte sent starts the server's part. */
  const onUpload = useCallback((fraction: number) => {
    setUploaded(fraction);
    if (fraction >= 1) {
      const start = performance.now();
      setSince((current) => current ?? start);
      setNow(start);
    }
  }, []);

  const finish = useCallback(() => setDone(true), []);

  const reset = useCallback(() => {
    setUploaded(0);
    setSince(null);
    setDone(false);
  }, []);

  const progress = done
    ? 1
    : sendingProgress(uploaded, since === null ? null : now - since, durationSec);

  return { progress, onUpload, finish, reset };
}
