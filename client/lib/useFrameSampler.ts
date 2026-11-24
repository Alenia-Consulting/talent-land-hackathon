"use client";

import { type RefObject, useEffect, useState } from "react";

import { RECORDING } from "./config.ts";
import { average, lumaFrame, meanAbsDiff } from "./pure/frames.ts";

export type FrameSample = {
  /** performance.now() of the sample. */
  t: number;
  luminance: number;
  /** Mean absolute luma difference with the previous sample; null on the first one. */
  diff: number | null;
};

/** Draws the video into a 64×36 canvas every 500 ms; both monitors read the same sample. */
export function useFrameSampler(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [sample, setSample] = useState<FrameSample | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const { width, height } = RECORDING.canvas;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let previous: Float32Array | null = null;

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      context.drawImage(video, 0, 0, width, height);
      const luma = lumaFrame(context.getImageData(0, 0, width, height).data);
      setSample({
        t: performance.now(),
        luminance: average(luma),
        diff: previous ? meanAbsDiff(previous, luma) : null,
      });
      previous = luma;
    }, RECORDING.sampleIntervalMs);

    return () => clearInterval(timer);
  }, [videoRef, enabled]);

  return sample;
}
