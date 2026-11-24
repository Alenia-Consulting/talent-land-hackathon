"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDING } from "./config.ts";
import { baseMimeType, pickMimeType } from "./pure/mime.ts";

export type StopReason = "user" | "limit" | "background";

export type RecordingResult = {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
  stopReason: StopReason;
};

/** MediaRecorder with a hard time limit. Stops by itself at the limit or when the page is hidden. */
export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reasonRef = useRef<StopReason>("user");
  const urlRef = useRef<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback((reason: StopReason = "user") => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    reasonRef.current = reason;
    recorder.stop();
  }, []);

  /** `t0` is the performance.now() of the tap, shared with the alert log so both use one clock. */
  const start = useCallback(
    (stream: MediaStream, t0: number) => {
      setFailed(false);
      const chosen = pickMimeType((type) => MediaRecorder.isTypeSupported(type));
      setMimeType(chosen);
      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          ...(chosen ? { mimeType: chosen } : {}),
          videoBitsPerSecond: RECORDING.videoBitsPerSecond,
        });
      } catch {
        setFailed(true);
        return;
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => stop("user");
      recorder.onstop = () => {
        clearTimer();
        const used = recorder.mimeType || chosen || chunks[0]?.type || "video/mp4";
        const blob = new Blob(chunks, { type: baseMimeType(used) });
        const measured = Math.round(((performance.now() - t0) / 1000) * 10) / 10;
        urlRef.current = URL.createObjectURL(blob);
        setResult({
          blob,
          url: urlRef.current,
          mimeType: used,
          durationSec: Math.min(measured, RECORDING.maxDurationSec),
          stopReason: reasonRef.current,
        });
        setIsRecording(false);
        recorderRef.current = null;
      };

      reasonRef.current = "user";
      recorderRef.current = recorder;
      recorder.start();
      setElapsedSec(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - t0) / 1000;
        setElapsedSec(Math.min(elapsed, RECORDING.maxDurationSec));
        if (elapsed >= RECORDING.maxDurationSec) stop("limit");
      }, 200);
    },
    [clearTimer, stop],
  );

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setResult(null);
    setElapsedSec(0);
    setFailed(false);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop("background");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      clearTimer();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [clearTimer, stop]);

  const remainingSec = Math.max(0, Math.ceil(RECORDING.maxDurationSec - elapsedSec));
  return { isRecording, mimeType, elapsedSec, remainingSec, result, failed, start, stop, reset };
}
