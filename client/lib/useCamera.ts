"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDING } from "./config.ts";
import { type CameraErrorKind, classifyCameraError } from "./pure/cameraError.ts";

export type CameraStatus = "idle" | "starting" | "ready" | "error";
export type CameraSettings = { width: number; height: number; frameRate: number };

const CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "environment",
    width: { ideal: RECORDING.video.width },
    height: { ideal: RECORDING.video.height },
    frameRate: { ideal: RECORDING.video.frameRate, max: RECORDING.video.frameRate },
  },
  audio: true,
};

/** Rear camera + microphone. Tracks are released on stop(), unmount, pagehide and when the page is hidden. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped by every stop(), so a getUserMedia that resolves afterwards releases its stream.
  const generation = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [settings, setSettings] = useState<CameraSettings | null>(null);

  const stop = useCallback(() => {
    generation.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setStatus((current) => (current === "error" ? current : "idle"));
  }, []);

  const fail = useCallback((kind: CameraErrorKind) => {
    setErrorKind(kind);
    setStatus("error");
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!window.isSecureContext) return fail("insecure");
    if (!navigator.mediaDevices?.getUserMedia) return fail("unsupported");

    const mine = ++generation.current;
    setErrorKind(null);
    setStatus("starting");
    try {
      const opened = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      if (mine !== generation.current) {
        opened.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = opened.getVideoTracks()[0];
      const real = track?.getSettings() ?? {};
      const actual = { width: real.width ?? 0, height: real.height ?? 0, frameRate: real.frameRate ?? 0 };
      console.info("[antesala] camera settings", actual);
      track?.addEventListener("ended", () => stop());
      streamRef.current = opened;
      setSettings(actual);
      setStream(opened);
      setStatus("ready");
    } catch (error) {
      if (mine === generation.current) fail(classifyCameraError(error));
    }
  }, [fail, stop]);

  useEffect(() => {
    const release = () => stop();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", release);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", release);
      stop();
    };
  }, [stop]);

  return { videoRef, stream, status, errorKind, settings, start, stop };
}
