"use client";

// One step of the route, as the venue corrects it.

import { useState } from "react";

import type { NoiseLevel as NoiseLevelValue, Step, StepPatch } from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";
import { Button, Card, NoiseLevel } from "../../ui.tsx";

const t = es.panel.detail;
const NOISE_LEVELS: NoiseLevelValue[] = ["quiet", "medium", "noisy"];

const inputClass =
  "mt-1 w-full rounded-2xl border-2 border-tinta/15 bg-niebla px-4 py-3 text-lg focus:border-pino focus:outline-none";

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

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-2xl font-extrabold">
            {step.order}. {step.title}
          </h3>
          {step.reviewed && (
            <span className="rounded-full bg-salvia px-3 py-1 text-base font-bold text-pino">
              {t.reviewed}
            </span>
          )}
        </div>
        <p className="text-base text-tinta/60">
          {t.seconds(step.start_seconds, step.end_seconds)}
          {step.noise_level_source === "manual" ? ` · ${t.noiseManual}` : ""}
        </p>

        <div className="mt-4 grid gap-4">
          <p>
            <label htmlFor={`${field}-easy`} className="font-bold">
              {t.fields.easy_read_text}
            </label>
            <textarea
              id={`${field}-easy`}
              value={easyRead}
              maxLength={300}
              rows={3}
              className={inputClass}
              onChange={(event) => setEasyRead(event.target.value)}
            />
          </p>

          <p>
            <label htmlFor={`${field}-help`} className="font-bold">
              {t.fields.who_to_ask_for_help}
            </label>
            <input
              id={`${field}-help`}
              value={whoToAsk}
              className={inputClass}
              onChange={(event) => setWhoToAsk(event.target.value)}
            />
          </p>

          <p>
            <label htmlFor={`${field}-duration`} className="font-bold">
              {t.fields.duration_text}
            </label>
            <input
              id={`${field}-duration`}
              value={duration}
              maxLength={80}
              className={inputClass}
              onChange={(event) => setDuration(event.target.value)}
            />
          </p>

          <p>
            <label htmlFor={`${field}-noise`} className="font-bold">
              {t.fields.noise_level}
            </label>
            <span className="mt-1 flex flex-wrap items-center gap-3">
              <select
                id={`${field}-noise`}
                value={noise}
                className={`${inputClass} w-auto`}
                onChange={(event) => setNoise(event.target.value as NoiseLevelValue | "")}
              >
                <option value="">{t.noise.unset}</option>
                {NOISE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t.noise[level]}
                  </option>
                ))}
              </select>
              {noise && <NoiseLevel level={noise} label={t.noise[noise]} />}
            </span>
          </p>
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
