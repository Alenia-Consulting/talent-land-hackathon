"use client";

// One step of the route, as the venue corrects it.
//
// What the AI could not find is marked rather than hidden: an empty field gets an amber border
// and a line saying it was not visible in the video. That is the second product invariant made
// visible — the model leaves a blank instead of inventing, and the blank has to look deliberate
// or it reads as a bug.

import { useState } from "react";

import type { NoiseLevel as NoiseLevelValue, Step, StepPatch } from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";
import { missingFieldsOf } from "../../../lib/pure/review.ts";
import { Segmented } from "../../controls.tsx";
import { CheckIcon } from "../../icons.tsx";
import { Button, Card, MissingChip, NoiseLevel } from "../../ui.tsx";

const t = es.panel.detail;
const NOISE_LEVELS: NoiseLevelValue[] = ["quiet", "medium", "noisy"];

const inputBase = "mt-1 w-full rounded-2xl border-2 px-4 py-3 text-lg focus:outline-none";

/** Amber while a required field is empty, as the design marks what is still missing. */
function inputClass(missing: boolean): string {
  return `${inputBase} ${
    missing
      ? "border-ambar bg-ambar/10 focus:border-pino"
      : "border-tinta/15 bg-niebla focus:border-pino"
  }`;
}

export function StepForm({
  step,
  saving,
  onSave,
}: {
  step: Step;
  saving: boolean;
  onSave: (changes: StepPatch) => void;
}) {
  const [easyRead, setEasyRead] = useState(step.easy_read_text ?? "");
  const [whoToAsk, setWhoToAsk] = useState(step.who_to_ask_for_help ?? "");
  const [duration, setDuration] = useState(step.duration_text ?? "");
  const [noise, setNoise] = useState<NoiseLevelValue | "">(
    (step.noise_level ?? "") as NoiseLevelValue | "",
  );

  const submit = (reviewed: boolean) => {
    const changes: StepPatch = {
      easy_read_text: easyRead.trim() || null,
      who_to_ask_for_help: whoToAsk.trim() || null,
      duration_text: duration.trim() || null,
      reviewed,
    };
    // Only sent when it actually changed: any value the panel sends is recorded as corrected by
    // hand, which would otherwise erase the fact that the pipeline measured it.
    if (noise !== (step.noise_level ?? "")) {
      changes.noise_level = noise || null;
    }
    onSave(changes);
  };

  const field = `step-${step.id}`;
  const missing = new Set(missingFieldsOf(step));
  const incomplete = missing.size > 0;

  return (
    <li>
      <Card className={incomplete ? "border-2 border-ambar" : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-3 text-2xl font-extrabold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tinta text-lg text-niebla">
              {step.order}
            </span>
            {step.title}
          </h3>
          {step.reviewed ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-salvia px-3 py-1 text-base font-bold text-pino">
              <CheckIcon size={18} />
              {t.reviewed}
            </span>
          ) : (
            missing.size > 0 && (
              <span className="flex flex-wrap gap-2">
                {[...missing].map((name) => (
                  <MissingChip key={name}>
                    {t.missing(t.fields[name as keyof typeof t.fields] ?? name)}
                  </MissingChip>
                ))}
              </span>
            )
          )}
        </div>
        <p className="mt-1 text-base text-tinta/60">
          {t.seconds(step.start_seconds, step.end_seconds)}
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor={`${field}-easy`} className="font-bold">
              {t.fields.easy_read_text}
            </label>
            <textarea
              id={`${field}-easy`}
              value={easyRead}
              maxLength={300}
              rows={3}
              className={inputClass(missing.has("easy_read_text"))}
              onChange={(event) => setEasyRead(event.target.value)}
            />
            <span className="mt-2 flex flex-wrap gap-2">
              {t.easyReadHints.map((hint) => (
                <span
                  key={hint}
                  className="rounded-full bg-salvia px-3 py-1 text-base font-bold text-pino"
                >
                  {hint}
                </span>
              ))}
            </span>
          </div>

          <div>
            <label htmlFor={`${field}-help`} className="font-bold">
              {t.fields.who_to_ask_for_help}
            </label>
            <input
              id={`${field}-help`}
              value={whoToAsk}
              className={inputClass(missing.has("who_to_ask_for_help"))}
              onChange={(event) => setWhoToAsk(event.target.value)}
            />
            {missing.has("who_to_ask_for_help") && (
              <span className="mt-1 block text-base text-sobre-ambar">{t.missingHint}</span>
            )}
          </div>

          <div>
            <label htmlFor={`${field}-duration`} className="font-bold">
              {t.fields.duration_text}
            </label>
            <input
              id={`${field}-duration`}
              value={duration}
              maxLength={80}
              className={inputClass(missing.has("duration_text"))}
              onChange={(event) => setDuration(event.target.value)}
            />
            {missing.has("duration_text") && (
              <span className="mt-1 block text-base text-sobre-ambar">{t.missingHint}</span>
            )}
          </div>

          <div>
            <span className="font-bold">
              {t.fields.noise_level}
              {/* Measured or corrected: the panel says which, so a human choice is never mistaken
                  for a measurement, and a measurement is never mistaken for a guess. */}
              <span className="font-normal text-tinta/60">
                {" · "}
                {step.noise_level_source === "manual" ? t.noiseManual : t.noiseMeasured}
              </span>
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-3">
              <Segmented
                label={t.fields.noise_level}
                value={noise || null}
                options={NOISE_LEVELS.map((level) => ({ value: level, label: t.noise[level] }))}
                onChange={setNoise}
              />
              {noise && <NoiseLevel level={noise} label={t.noise[noise]} />}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" disabled={saving} onClick={() => submit(step.reviewed)}>
            {saving ? t.saving : t.save}
          </Button>
          <Button disabled={saving} onClick={() => submit(true)}>
            {t.saveAndReview}
          </Button>
        </div>
      </Card>
    </li>
  );
}
