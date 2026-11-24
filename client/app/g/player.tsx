"use client";

// One step at a time, which is the whole idea: the person sees exactly where they will be, and
// nothing moves on to the next place until they say so.
//
// Three product invariants are enforced here, not just described:
//   · the clip is muted and never carries sound (`muted`, and no audio track is ever unmuted);
//   · the sound of the place plays only after the sheet in sound-sheet.tsx has been answered;
//   · nothing advances on its own — there is no timer in this file.

import { useEffect, useRef, useState } from "react";

import type { Step } from "../../lib/guides.ts";
import { soundUrlOf } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { useAmbience } from "../../lib/useAmbience.ts";
import { useReducedMotion } from "../../lib/useReducedMotion.ts";
import { useSpeech } from "../../lib/useSpeech.ts";
import { ProgressSegments } from "../controls.tsx";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PauseIcon,
  ReplayIcon,
  VolumeIcon,
  WaveIcon,
} from "../icons.tsx";
import { usePrefs } from "../prefs.tsx";
import { Button, Card, HeaderButton, NoiseLevel } from "../ui.tsx";
import { SoundSheet } from "./sound-sheet.tsx";

const t = es.publica;

/** Everything a screen reader or a voice should say for this step, in reading order. */
export function spokenText(step: Step): string {
  return [step.title, step.easy_read_text, ...step.what_to_expect, step.who_to_ask_for_help]
    .filter((line): line is string => Boolean(line))
    .join(". ");
}

function Clip({
  step,
  still,
  paused,
  replayToken,
  onEnded,
}: {
  step: Step;
  still: boolean;
  paused: boolean;
  /** Bumped by the player to start the clip over, so "Repetir" can sit next to "Seguir". */
  replayToken: number;
  onEnded: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element || replayToken === 0) return;
    element.currentTime = 0;
    void element.play();
  }, [replayToken]);

  if (!step.clip_url) {
    return step.photo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={step.photo_url} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover" />
    ) : (
      <p className="rounded-3xl bg-salvia p-6 text-center text-tinta/70">{t.noMedia}</p>
    );
  }

  return (
    <div className="relative">
      <video
        ref={video}
        src={step.clip_url}
        poster={step.photo_url ?? undefined}
        // Muted is not a default here, it is the product: a clip never carries sound.
        muted
        playsInline
        // Someone who asked their system for less movement gets the still and a replay button.
        autoPlay={!still}
        controls={false}
        onEnded={onEnded}
        className="aspect-[4/3] w-full rounded-3xl bg-salvia object-cover"
      />
      <span className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-tinta/80 px-3 py-1 text-base font-bold text-niebla">
        {paused && <PauseIcon size={18} />}
        {paused ? t.player.paused : t.player.silent}
      </span>
      <button
        type="button"
        aria-label={t.player.replay}
        onClick={() => {
          const element = video.current;
          if (!element) return;
          element.currentTime = 0;
          void element.play();
        }}
        className="absolute right-3 bottom-3 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-tinta/80 text-niebla"
      >
        <ReplayIcon size={26} />
      </button>
    </div>
  );
}

/** The step itself: what it looks like, what it says, and the two things that can be heard. */
function StepBody({
  step,
  sound,
  ambience,
  speech,
  onAskSound,
}: {
  step: Step;
  sound: string | null;
  ambience: ReturnType<typeof useAmbience>;
  speech: ReturnType<typeof useSpeech>;
  onAskSound: () => void;
}) {
  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{step.title}</h1>
        {step.noise_level && (
          <NoiseLevel
            level={step.noise_level}
            label={t.noise[step.noise_level as keyof typeof t.noise] ?? step.noise_level}
          />
        )}
      </div>

      {step.easy_read_text && <p className="mt-3 text-2xl">{step.easy_read_text}</p>}

      {(step.what_to_expect.length > 0 || step.who_to_ask_for_help) && (
        <Card className="mt-5">
          <ul className="grid gap-3">
            {step.what_to_expect.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="text-pino">
                  •
                </span>
                {item}
              </li>
            ))}
            {step.who_to_ask_for_help && (
              <li className="flex gap-3">
                <span aria-hidden="true" className="text-pino">
                  •
                </span>
                <span>
                  {t.whoToAsk}, <strong>{step.who_to_ask_for_help}</strong>.
                </span>
              </li>
            )}
          </ul>
        </Card>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {sound &&
          (ambience.playing ? (
            <Button variant="secondary" icon={<PauseIcon size={22} />} onClick={ambience.stop}>
              {t.sound.stop}
            </Button>
          ) : (
            <Button icon={<VolumeIcon size={22} />} onClick={onAskSound}>
              {t.player.listen}
            </Button>
          ))}
        {speech.supported && (
          <Button
            variant="secondary"
            icon={<WaveIcon size={22} />}
            onClick={() => (speech.speaking ? speech.stop() : speech.speak(spokenText(step)))}
          >
            {speech.speaking ? t.player.stopReading : t.player.readThis}
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * What the run shows once a clip has played out.
 *
 * It names the step just finished, says what is coming, and then waits. Announcing the next
 * place before showing it is the whole premise of an anticipation guide, and the waiting is
 * invariant 5: nothing advances on its own.
 */
function PausePanel({ step, index, next }: { step: Step; index: number; next: Step | undefined }) {
  return (
    <div className="mt-5">
      <p className="text-lg font-bold text-tinta/70">{t.player.stepDone(index + 1, step.title)}</p>
      <h1 className="mt-1 text-3xl font-extrabold">{t.player.pauseTitle}</h1>
      <p className="mt-3 text-2xl">{next ? t.player.pauseLead(next.title) : t.player.pauseLast}</p>

      {next && (
        <Card className="mt-5 flex items-center gap-4">
          {next.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={next.photo_url} alt="" className="h-16 w-20 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span aria-hidden="true" className="h-16 w-20 shrink-0 rounded-2xl bg-salvia" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-base text-tinta/70">{t.player.upNext(index + 2)}</span>
            <span className="block text-xl font-bold">{next.title}</span>
          </span>
          {next.noise_level && (
            <NoiseLevel
              level={next.noise_level}
              label={t.noise[next.noise_level as keyof typeof t.noise] ?? next.noise_level}
            />
          )}
        </Card>
      )}
    </div>
  );
}

export function Player({
  steps,
  index,
  onMove,
  onClose,
}: {
  steps: Step[];
  index: number;
  onMove: (next: number) => void;
  onClose: () => void;
}) {
  const step = steps[index];
  const { prefs } = usePrefs();
  const speech = useSpeech();
  const ambience = useAmbience();
  const still = useReducedMotion();
  const [askingSound, setAskingSound] = useState(false);
  // The clip has played to the end and the run is waiting on the person: nothing is counting
  // down, and nothing happens next until a button is pressed.
  const [ended, setEnded] = useState(false);
  const [replayToken, setReplayToken] = useState(0);

  const sound = soundUrlOf(step);

  // Changing step is a clean slate: whatever was being read or played belonged to the last one.
  useEffect(() => {
    speech.stop();
    ambience.stop();
    setAskingSound(false);
    setEnded(false);
    setReplayToken(0);
    if (prefs.readAloud) speech.speak(spokenText(step));
    // Re-running on anything but the step would cut the person off mid-sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  const last = index === steps.length - 1;

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <header className="flex items-center gap-4">
        <HeaderButton label={t.player.close} onClick={onClose}>
          <CloseIcon />
        </HeaderButton>
        <p className="flex-1 text-center text-lg font-bold">
          {t.player.position(index + 1, steps.length)}
        </p>
        {/* Keeps the title centred without a second control competing with the close button. */}
        <span className="h-14 w-14" aria-hidden="true" />
      </header>

      <div className="mt-3">
        <ProgressSegments total={steps.length} current={index + 1} />
      </div>

      <div className="mt-5">
        <Clip
          step={step}
          still={still}
          paused={ended}
          replayToken={replayToken}
          onEnded={() => setEnded(true)}
        />
      </div>

      {/* Once the clip has run out the step gives way to the pause: what just happened, what is
          next, and nothing else to decide. */}
      {ended ? (
        <PausePanel step={step} index={index} next={steps[index + 1]} />
      ) : (
        <StepBody
          step={step}
          sound={sound}
          ambience={ambience}
          speech={speech}
          onAskSound={() => setAskingSound(true)}
        />
      )}

      {/* Pinned to the bottom edge: the two controls of a step-by-step run must be in the same
          place on every step, whatever the length of the text above them. */}
      <nav className="sticky bottom-0 -mx-4 mt-auto grid gap-3 border-t border-tinta/10 bg-niebla px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {ended ? (
          <>
            <Button full onClick={() => (last ? onClose() : onMove(index + 1))}>
              {last ? t.player.finish : t.player.goOn}
            </Button>
            <Button
              full
              variant="secondary"
              icon={<ReplayIcon size={22} />}
              onClick={() => {
                setEnded(false);
                setReplayToken((token) => token + 1);
              }}
            >
              {t.player.repeat(step.title)}
            </Button>
          </>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="quiet"
              className="flex-1"
              icon={<ChevronLeftIcon size={22} />}
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            >
              {t.player.previous}
            </Button>
            <Button
              variant="dark"
              className="flex-1"
              onClick={() => (last ? onClose() : onMove(index + 1))}
            >
              {last ? t.player.finish : t.player.next}
              {!last && <ChevronRightIcon size={22} />}
            </Button>
          </div>
        )}
      </nav>

      <SoundSheet
        open={askingSound}
        step={step}
        onClose={() => setAskingSound(false)}
        onConfirm={() => {
          setAskingSound(false);
          if (sound) ambience.play(sound);
        }}
      />
    </div>
  );
}
