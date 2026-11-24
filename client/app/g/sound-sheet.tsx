"use client";

// The question asked before any sound of the place is heard.
//
// This sheet IS product invariant 1. It says how loud the place is before playing it, it says
// the sound will come up slowly, it says it can be stopped, and it offers "Ahora no" as an equal
// choice rather than as a way out. Nothing plays until it has been answered, and closing it by
// tapping outside counts as "no".

import type { Step } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { Sheet } from "../controls.tsx";
import { HeadphonesIcon, VolumeIcon } from "../icons.tsx";
import { Button, Card, NoiseLevel } from "../ui.tsx";

const t = es.publica;

type Level = keyof typeof t.sound.title;

function levelOf(step: Step): Level {
  const level = step.noise_level;
  return level === "medium" || level === "noisy" ? level : "quiet";
}

export function SoundSheet({
  open,
  step,
  onClose,
  onConfirm,
}: {
  open: boolean;
  step: Step;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const level = levelOf(step);

  return (
    <Sheet open={open} onClose={onClose} title={t.sound.title[level]}>
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ambar/35 text-sobre-ambar">
          <VolumeIcon size={30} />
        </span>
        <div className="min-w-0">
          <h2 className="text-3xl font-extrabold">{t.sound.title[level]}</h2>
          <p className="mt-1 text-tinta/70">{t.sound.subtitle(step.title)}</p>
        </div>
      </div>

      <p className="mt-5 text-xl">{t.sound.lead}</p>

      <Card className="mt-5 flex flex-wrap items-center gap-3">
        <NoiseLevel level={level} label={t.noise[level]} />
        {step.duration_text && <span className="text-tinta/70">{step.duration_text}</span>}
      </Card>

      <p className="mt-5 flex items-start gap-3 text-tinta/70">
        <span className="text-pino">
          <HeadphonesIcon size={26} />
        </span>
        {t.sound.headphones}
      </p>

      <div className="mt-6 grid gap-3">
        <Button full icon={<VolumeIcon size={22} />} onClick={onConfirm}>
          {t.sound.confirm}
        </Button>
        {/* Same size and same weight as the other one: refusing is not the lesser choice. */}
        <Button full variant="quiet" onClick={onClose}>
          {t.sound.cancel}
        </Button>
      </div>
    </Sheet>
  );
}
