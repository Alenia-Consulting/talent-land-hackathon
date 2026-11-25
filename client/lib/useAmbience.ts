"use client";

// The sound of the place, played only when asked for.
//
// Product invariant 1, in code: the audio element is created on play and never autoplays, the
// volume starts at zero and rises over FADE_MS, and stopping is always one tap away.
//
// The audio itself is already low-passed by the pipeline so that no voice stays intelligible;
// this hook only decides when it is heard and how loudly it comes up.

import { useCallback, useEffect, useRef, useState } from "react";

import { FADE_MS, fadeVolume, TARGET_VOLUME } from "./pure/sound.ts";

const STEP_MS = 50;

export type Ambience = {
  playing: boolean;
  play: (url: string) => void;
  stop: () => void;
};

export function useAmbience(): Ambience {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ramp = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (ramp.current) {
      clearInterval(ramp.current);
      ramp.current = null;
    }
    const element = audio.current;
    if (element) {
      element.pause();
      element.src = "";
      audio.current = null;
    }
    setPlaying(false);
  }, []);

  // Leaving the step, closing the guide or navigating away all mean silence.
  useEffect(() => stop, [stop]);

  const play = useCallback(
    (url: string) => {
      stop();
      const element = new Audio(url);
      element.volume = 0;
      element.onended = () => stop();
      element.onerror = () => stop();
      audio.current = element;

      const started = Date.now();
      ramp.current = setInterval(() => {
        if (!audio.current) return;
        const volume = fadeVolume(Date.now() - started, FADE_MS, TARGET_VOLUME);
        audio.current.volume = volume;
        if (volume >= TARGET_VOLUME && ramp.current) {
          clearInterval(ramp.current);
          ramp.current = null;
        }
      }, STEP_MS);

      void element.play().then(
        () => setPlaying(true),
        // Blocked by the browser, or the file is gone. Either way: no sound and no error screen.
        () => stop(),
      );
    },
    [stop],
  );

  return { playing, play, stop };
}
