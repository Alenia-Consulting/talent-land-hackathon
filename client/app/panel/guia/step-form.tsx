"use client";

// One step of the route, as the venue corrects it. Not styled yet.

import { useState } from "react";

import type { NoiseLevel, Step, StepPatch } from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";

const t = es.panel.detail;
const NOISE_LEVELS: NoiseLevel[] = ["quiet", "medium", "noisy"];

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
  const [noise, setNoise] = useState<NoiseLevel | "">((step.noise_level ?? "") as NoiseLevel | "");

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
      <h3>
        {step.order}. {step.title}
      </h3>
      <p>
        {t.seconds(step.start_seconds, step.end_seconds)}
        {step.reviewed ? ` · ${t.reviewed}` : ""}
        {step.noise_level_source === "manual" ? ` · ${t.noiseManual}` : ""}
      </p>

      <p>
        <label htmlFor={`${field}-easy`}>{t.fields.easy_read_text}</label>
        <br />
        <textarea
          id={`${field}-easy`}
          value={easyRead}
          maxLength={300}
          rows={3}
          onChange={(event) => setEasyRead(event.target.value)}
        />
      </p>

      <p>
        <label htmlFor={`${field}-help`}>{t.fields.who_to_ask_for_help}</label>
        <br />
        <input
          id={`${field}-help`}
          value={whoToAsk}
          onChange={(event) => setWhoToAsk(event.target.value)}
        />
      </p>

      <p>
        <label htmlFor={`${field}-duration`}>{t.fields.duration_text}</label>
        <br />
        <input
          id={`${field}-duration`}
          value={duration}
          maxLength={80}
          onChange={(event) => setDuration(event.target.value)}
        />
      </p>

      <p>
        <label htmlFor={`${field}-noise`}>{t.fields.noise_level}</label>
        <br />
        <select
          id={`${field}-noise`}
          value={noise}
          onChange={(event) => setNoise(event.target.value as NoiseLevel | "")}
        >
          <option value="">{t.noise.unset}</option>
          {NOISE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t.noise[level]}
            </option>
          ))}
        </select>
      </p>

      <p>
        <button type="button" disabled={saving} onClick={() => submit(step.reviewed)}>
          {saving ? t.saving : t.save}
        </button>{" "}
        <button type="button" disabled={saving} onClick={() => submit(true)}>
          {t.save} + {t.reviewed}
        </button>
      </p>
    </li>
  );
}
