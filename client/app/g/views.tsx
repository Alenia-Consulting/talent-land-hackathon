"use client";

// The four screens of the public guide: overview, one step, the sound warning and the full tour.
// Each one is a function of the guide and the step number; the URL (see page.tsx) decides which.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Guide, Step } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { speak, speechAvailable, stopSpeaking } from "../../lib/speech.ts";
import { Button, Card, SectionLabel } from "../ui.tsx";
import { type ClipHandle, ClipPlayer } from "./player.tsx";
import { ButtonLink, GuideHeader, guideHref, hasSound, StepNoise } from "./parts.tsx";

const t = es.publica;

type ViewProps = { guide: Guide; slug: string };

export function Overview({ guide, slug }: ViewProps) {
  return (
    <>
      <GuideHeader guide={guide} />
      <div className="mt-6 grid gap-3">
        <ButtonLink href={guideHref(slug, { paso: 1 })}>{t.start}</ButtonLink>
        <ButtonLink href={guideHref(slug, { recorrido: 1 })} variant="secondary">
          {t.fullTour}
        </ButtonLink>
      </div>
      <p className="mt-3 text-tinta/70">{t.startLead}</p>

      <SectionLabel>{t.steps}</SectionLabel>
      <ol className="grid gap-3">
        {guide.steps.map((step) => (
          <li key={step.id}>
            <Link href={guideHref(slug, { paso: step.order })} className="block">
              <Card className="flex items-center gap-4 border-2 border-transparent hover:border-pino">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-salvia text-2xl font-extrabold text-pino">
                  {step.order}
                </span>
                <span className="min-w-0 flex-1 text-xl font-bold">{step.title}</span>
                <StepNoise step={step} />
              </Card>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

export function StepView({ guide, slug, step }: ViewProps & { step: Step }) {
  const total = guide.steps.length;
  const [reading, setReading] = useState(false);

  // Switching step or leaving the screen silences the voice.
  useEffect(() => {
    stopSpeaking();
    setReading(false);
    return () => stopSpeaking();
  }, [step.id]);

  const toggleReading = async () => {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    await speak(`${step.title}. ${step.easy_read_text ?? ""}`);
    setReading(false);
  };

  return (
    <>
      <p className="mb-4">
        <Link href={guideHref(slug)} className="font-bold text-pino underline">
          {t.toStart}
        </Link>
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-tinta/70">{t.stepOf(step.order, total)}</span>
        <StepNoise step={step} />
      </div>
      <h1 className="mt-2 text-4xl font-extrabold">{step.title}</h1>

      {/* key: a new step starts a new player, paused and muted. */}
      <ClipPlayer key={step.id} step={step} />

      {step.easy_read_text && <p className="mt-4">{step.easy_read_text}</p>}
      {step.duration_text && (
        <p className="mt-2 inline-block rounded-full bg-salvia px-3 py-1 text-base font-bold text-pino">
          {step.duration_text}
        </p>
      )}
      {step.what_to_expect.length > 0 && (
        <ul className="mt-4 list-disc pl-6">
          {step.what_to_expect.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {step.who_to_ask_for_help && (
        <p className="mt-4 rounded-2xl bg-salvia p-4">
          <span className="font-bold">{t.whoToAsk}:</span> {step.who_to_ask_for_help}
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {hasSound(step) ? (
          <ButtonLink href={guideHref(slug, { paso: step.order, sonido: 1 })} variant="secondary">
            {t.listen}
          </ButtonLink>
        ) : (
          <Button variant="secondary" disabled>
            {t.noSound}
          </Button>
        )}
        {speechAvailable() && step.easy_read_text && (
          <Button variant="secondary" onClick={toggleReading}>
            {reading ? t.stopReading : t.readAloud}
          </Button>
        )}
      </div>

      {/* Same place on every step: back on the left, forward on the right. */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {step.order > 1 ? (
          <ButtonLink href={guideHref(slug, { paso: step.order - 1 })} variant="secondary">
            {t.back}
          </ButtonLink>
        ) : (
          <span />
        )}
        {step.order < total ? (
          <ButtonLink href={guideHref(slug, { paso: step.order + 1 })}>{t.next}</ButtonLink>
        ) : (
          <ButtonLink href={guideHref(slug)}>{t.finish}</ButtonLink>
        )}
      </div>
    </>
  );
}

/** Always shown before any sound. There is no setting that skips it. */
export function SoundView({ slug, step }: Pick<ViewProps, "slug"> & { step: Step }) {
  const [listening, setListening] = useState(false);
  const player = useRef<ClipHandle>(null);
  const back = guideHref(slug, { paso: step.order });
  const s = t.sound;

  useEffect(() => {
    if (listening) player.current?.restart();
  }, [listening]);

  if (!hasSound(step)) {
    return (
      <>
        <p role="alert" className="rounded-2xl bg-salvia p-4">
          {s.unavailable}
        </p>
        <div className="mt-6">
          <ButtonLink href={back}>{s.backToStep}</ButtonLink>
        </div>
      </>
    );
  }

  const level = (step.noise_level as keyof typeof s.warning | null) ?? "unset";

  return (
    <>
      <h1 className="text-3xl font-extrabold">{s.title(step.title)}</h1>
      <Card className="mt-4">
        <p className="mb-3">
          <StepNoise step={step} />
        </p>
        <p role="status">{s.warning[level] ?? s.warning.unset}</p>
        <ul className="mt-3 list-disc pl-6">
          {s.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Card>

      <ClipPlayer ref={player} key={step.id} step={step} sound={listening} controls={listening} />

      <div className="mt-6 grid gap-3">
        {listening ? (
          <Button onClick={() => setListening(false)}>{s.stop}</Button>
        ) : (
          <>
            <Button onClick={() => setListening(true)}>{s.play}</Button>
            <ButtonLink href={back} variant="secondary">
              {s.notNow}
            </ButtonLink>
          </>
        )}
      </div>
      <p className="mt-3 text-base text-tinta/70">{s.anytime}</p>
    </>
  );
}

/** The whole route, one step at a time, with a pause between steps. Never starts by itself and never with sound. */
export function TourView({ guide, slug }: ViewProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"waiting" | "playing" | "paused">("waiting");
  const player = useRef<ClipHandle>(null);
  const tour = t.tour;

  const step = guide.steps[index];
  const last = index === guide.steps.length - 1;
  const next = guide.steps[index + 1];

  const watch = () => {
    if (!step.clip_url) {
      setPhase("paused"); // no clip to play: go straight to the pause
      return;
    }
    setPhase("playing");
    player.current?.play();
  };

  const replay = () => {
    setPhase("playing");
    player.current?.restart();
  };

  return (
    <>
      <p className="mb-4">
        <Link href={guideHref(slug)} className="font-bold text-pino underline">
          {tour.exit}
        </Link>
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-tinta/70">{t.stepOf(index + 1, guide.steps.length)}</span>
        <StepNoise step={step} />
      </div>
      <h1 className="mt-2 text-4xl font-extrabold">{step.title}</h1>

      <ClipPlayer
        ref={player}
        key={step.id}
        step={step}
        controls={false}
        onPlayingChange={(playing) => setPhase((current) => (playing ? "playing" : current === "playing" ? "waiting" : current))}
        onEnded={() => setPhase("paused")}
      />
      {step.easy_read_text && <p className="mt-4">{step.easy_read_text}</p>}

      {phase === "paused" && (
        <Card className="mt-4 bg-salvia">
          <div role="status">
            <h2 className="text-2xl font-extrabold">{tour.done(index + 1, step.title)}</h2>
            <p className="mt-2 font-bold">{tour.whenYouWant}</p>
            <p className="mt-1">{last ? tour.last : tour.nextIs(next.title)}</p>
          </div>
          {step.clip_url && (
            <div className="mt-3 grid">
              <Button variant="secondary" onClick={replay}>
                {tour.repeat(step.title)}
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 grid">
        {phase === "waiting" && <Button onClick={watch}>{tour.watchStep(index + 1)}</Button>}
        {phase === "playing" && (
          <Button variant="secondary" onClick={() => player.current?.pause()}>
            {t.pause}
          </Button>
        )}
        {phase === "paused" &&
          (last ? (
            <ButtonLink href={guideHref(slug)}>{t.finish}</ButtonLink>
          ) : (
            <Button
              onClick={() => {
                setIndex(index + 1);
                setPhase("waiting");
              }}
            >
              {tour.continue(index + 2)}
            </Button>
          ))}
      </div>
    </>
  );
}
