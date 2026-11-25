"use client";

// What a visitor sees when they open the link or scan the QR, before anything starts.
//
// Nothing has happened yet and nothing will until they press: no clip, no sound, no movement.
// The date of the last human review is here because freshness is the thing a person cannot
// check for themselves, and a guide that is a year old describes a place that may be gone.

import { useState } from "react";

import type { Guide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { ThemeButton, Toggle } from "../controls.tsx";
import { AntesalaMark, PlayIcon, WaveIcon } from "../icons.tsx";
import { usePrefs } from "../prefs.tsx";
import { ActionBar, Button, Card, Chip, Pill } from "../ui.tsx";
import { SettingsSheet } from "./settings.tsx";

const t = es.publica;

/** The interests the API knows, in the order the design lists them. */
const INTERESTS = [
  "where_to_wait",
  "noisy_areas",
  "restrooms",
  "who_to_ask",
  "exit",
] as const;

type Interest = (typeof INTERESTS)[number];

/**
 * Only the interests this guide actually covers.
 *
 * Offering "Baños" for a place whose recording never passed one would send somebody looking for
 * a step that does not exist.
 */
export function availableInterests(guide: Guide): Interest[] {
  const present = new Set(guide.steps.flatMap((step) => step.interests));
  return INTERESTS.filter((interest) => present.has(interest));
}

export function Landing({
  guide,
  reviewed,
  chosen,
  onToggle,
  onStart,
  onSeeAll,
}: {
  guide: Guide;
  reviewed: string | null;
  chosen: ReadonlySet<string>;
  onToggle: (interest: string) => void;
  onStart: () => void;
  onSeeAll: () => void;
}) {
  const { prefs, setPrefs } = usePrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const interests = availableInterests(guide);

  return (
    <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col">
      <header className="mb-6 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-3 text-2xl font-extrabold">
          <span className="text-pino">
            <AntesalaMark size={40} />
          </span>
          antesala
        </span>
        <span className="flex items-center gap-2">
          <ThemeButton label={t.dimMode} />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex min-h-14 items-center rounded-[18px] bg-tarjeta px-5 text-base font-bold text-tinta"
          >
            {es.ajustes.open}
          </button>
        </span>
      </header>

      <div className="flex-1">
        {guide.cover_photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guide.cover_photo_url}
            alt=""
            className="mb-5 aspect-[4/3] w-full rounded-3xl object-cover"
          />
        )}

        <h1 className="text-4xl font-extrabold">{guide.venue_name}</h1>
        <p className="mt-1 text-xl text-tinta/70">{guide.title}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Pill>{t.stepCount(guide.steps.length)}</Pill>
          {guide.walking_minutes != null && <Pill>{`${guide.walking_minutes} min andando`}</Pill>}
          {reviewed && <Pill>{reviewed}</Pill>}
        </div>

        {interests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-extrabold">{t.pickTitle}</h2>
            <p className="mt-1 text-tinta/70">{t.pickLead}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {interests.map((interest) => (
                <Chip
                  key={interest}
                  selected={chosen.has(interest)}
                  onClick={() => onToggle(interest)}
                >
                  {t.interests[interest]}
                </Chip>
              ))}
            </div>
          </section>
        )}

        <Card className="mt-8 flex items-center gap-4">
          <span className="text-pino">
            <WaveIcon size={28} />
          </span>
          <Toggle
            label={t.readAloud}
            hint={t.readAloudHint}
            checked={prefs.readAloud}
            onChange={(next) => setPrefs({ readAloud: next })}
          />
        </Card>
      </div>

      {/* Pinned to the bottom edge: the way into the guide is never below the fold, however many
          interests this place has to offer. */}
      <ActionBar>
        <Button full icon={<PlayIcon size={22} />} onClick={onStart}>
          {t.start}
        </Button>
        <Button full variant="secondary" onClick={onSeeAll}>
          {t.seeAll}
        </Button>
      </ActionBar>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
