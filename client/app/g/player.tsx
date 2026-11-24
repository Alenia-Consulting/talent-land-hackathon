"use client";

// Plays the clip of one step. Two product rules live here:
//   · nothing starts by itself: the clip waits for the person to press play, and it is muted;
//   · sound only comes on when `sound` is true, and it rises from silence (lib/pure/fade.ts).
// The server already cut the clip, blurred the faces and low-passed the audio, so the player
// just plays the whole file.

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";

import { fadeVolume, TARGET_VOLUME } from "../../lib/pure/fade.ts";
import { es } from "../../lib/i18n/es.ts";
import type { Step } from "../../lib/guides.ts";
import { Button } from "../ui.tsx";

const t = es.publica;

export type ClipHandle = { play: () => void; pause: () => void; restart: () => void };

type Props = {
  step: Step;
  /** True once the person accepted the warning and asked to hear the place. */
  sound?: boolean;
  /** Show the play / replay buttons under the clip. */
  controls?: boolean;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  ref?: Ref<ClipHandle>;
};

export function ClipPlayer({ step, sound = false, controls = true, onEnded, onPlayingChange, ref }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      play: () => void video.current?.play().catch(() => undefined),
      pause: () => video.current?.pause(),
      restart: () => {
        const element = video.current;
        if (!element) return;
        element.currentTime = 0;
        void element.play().catch(() => undefined);
      },
    }),
    [],
  );

  // Sound on: unmute and ramp the volume up. Sound off: mute again. The cleanup stops the ramp.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!sound) {
      element.muted = true;
      return;
    }
    element.volume = 0;
    element.muted = false;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const volume = fadeVolume(performance.now() - startedAt);
      element.volume = volume;
      if (volume >= TARGET_VOLUME) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [sound]);

  // Leaving the screen stops the clip.
  useEffect(() => {
    const element = video.current;
    return () => element?.pause();
  }, []);

  const change = (value: boolean) => {
    setPlaying(value);
    onPlayingChange?.(value);
  };

  if (!step.clip_url) {
    return step.photo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={step.photo_url} alt="" className="mt-3 w-full rounded-2xl" />
    ) : (
      <p className="mt-3 rounded-2xl bg-niebla p-3 text-base text-tinta/55">{t.noMedia}</p>
    );
  }

  return (
    <div className="mt-3">
      <video
        ref={video}
        src={step.clip_url}
        poster={step.photo_url ?? undefined}
        muted
        playsInline
        preload="metadata"
        aria-label={step.title}
        className="w-full rounded-2xl bg-tinta"
        onPlay={() => change(true)}
        onPause={() => change(false)}
        onEnded={() => onEnded?.()}
      />
      {controls && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button
            variant="primary"
            onClick={() => (playing ? video.current?.pause() : void video.current?.play())}
          >
            {playing ? t.pause : t.watch}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!video.current) return;
              video.current.currentTime = 0;
              void video.current.play();
            }}
          >
            {t.replay}
          </Button>
        </div>
      )}
    </div>
  );
}
