"use client";

// One step of the route, as the venue corrects it.
//
// Two shapes, because a review is mostly a list of things already done: a finished step is one
// line you can skim, and the one being worked on is open. Only one is open at a time, so the
// screen never asks to be scrolled twice over the same step.
//
// What the AI could not find is marked rather than hidden: an empty field gets an amber border
// and a line saying it was not visible in the video. That is the second product invariant made
// visible — the model leaves a blank instead of inventing, and the blank has to look deliberate
// or it reads as a bug. The mark is read from what is on screen, so it clears as you type and
// not when a round trip comes back.

import type { Step } from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";
import { type Draft, missingInDraft, type Noise } from "../../../lib/pure/draft.ts";
import { Segmented } from "../../controls.tsx";
import { AlertIcon, CheckIcon, ChevronRightIcon } from "../../icons.tsx";
import { Card, MissingChip, NoiseLevel } from "../../ui.tsx";
import type { SaveState } from "./useReview.ts";

const t = es.panel.detail;
const NOISE_LEVELS: Noise[] = ["quiet", "medium", "noisy"];

const inputBase = "mt-1 w-full rounded-2xl border-2 px-4 py-3 text-lg text-tinta focus:outline-none";

/** Amber while a required field is empty, as the design marks what is still missing. */
function inputClass(missing: boolean): string {
  return `${inputBase} ${
    missing
      ? "border-ambar bg-ambar/10 focus:border-pino"
      : "border-tinta/15 bg-niebla focus:border-pino"
  }`;
}

/** The id of each field's control, so the action button can send you to the first blank one. */
const fieldId = (stepId: string, name: string) => `step-${stepId}-${name}`;

/** Where the publish bar scrolls to when it says "Ir al paso 3". */
export const anchorOf = (stepId: string) => `paso-${stepId}`;

/**
 * Put the person in the first field this step is still missing.
 *
 * The bar at the bottom says "Completar lo que falta" rather than going dark and leaving them to
 * find it: a disabled button is a dead end, and the blank is the only thing that could be done
 * next anyway.
 */
export function focusBlank(stepId: string, field: string): void {
  const node = document.getElementById(fieldId(stepId, field));
  const target =
    node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
      ? node
      : node?.querySelector<HTMLElement>("button, input, textarea");
  node?.scrollIntoView({ block: "center" });
  target?.focus();
}

/**
 * The clip the text is supposed to describe.
 *
 * Reviewing a step means checking what the AI wrote against what the camera saw, and that was
 * missing: the old panel asked people to approve a description of a video they could not watch.
 * Muted, and with no controls in the closed row, where it is a thumbnail and not a player.
 */
function Preview({
  step,
  className,
  controls = false,
}: {
  step: Step;
  className: string;
  controls?: boolean;
}) {
  if (step.clip_url) {
    return (
      <video
        src={step.clip_url}
        poster={step.photo_url ?? undefined}
        muted
        playsInline
        preload="metadata"
        controls={controls}
        className={`${className} bg-salvia object-cover`}
      />
    );
  }
  if (step.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={step.photo_url} alt="" className={`${className} bg-salvia object-cover`} />;
  }
  return <span aria-hidden="true" className={`${className} bg-salvia`} />;
}

/** Where this step's edits are. Quiet by design: it reports, it does not ask for anything. */
export function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving") return <span className="text-base text-tinta/60">{t.autosave.saving}</span>;
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-2 text-base text-pino">
        <CheckIcon size={18} />
        {t.autosave.saved}
      </span>
    );
  if (state === "pending") return <span className="text-base text-tinta/50">{t.autosave.pending}</span>;
  if (state === "error")
    return (
      <span className="inline-flex items-center gap-3 text-base text-sobre-coral">
        {t.autosave.error}
        <button type="button" onClick={onRetry} className="font-bold underline">
          {t.retry}
        </button>
      </span>
    );
  return null;
}

/** The finished step: one line. The whole row opens it again. */
function ClosedStep({
  step,
  draft,
  missing,
  onOpen,
}: {
  step: Step;
  draft: Draft;
  missing: string[];
  onOpen: () => void;
}) {
  const done = step.reviewed && missing.length === 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={false}
      className="flex w-full items-center gap-4 rounded-3xl bg-tarjeta p-4 text-left"
    >
      <Preview step={step} className="h-14 w-14 shrink-0 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold">
          <span className="text-tinta/40">{step.order}</span> {step.title}
        </span>
        <span className="block truncate text-base text-tinta/60">
          {draft.easy_read_text || t.fields.easy_read_text}
        </span>
      </span>
      {missing.length > 0 ? (
        <MissingChip>{missing.length}</MissingChip>
      ) : (
        done && (
          <span
            aria-label={t.reviewed}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salvia text-pino"
          >
            <CheckIcon size={20} />
          </span>
        )
      )}
      <span aria-hidden="true" className="text-pino">
        <ChevronRightIcon size={22} />
      </span>
    </button>
  );
}

export function StepForm({
  step,
  draft,
  open,
  onOpen,
  onEdit,
  onSave,
}: {
  step: Step;
  draft: Draft;
  open: boolean;
  onOpen: () => void;
  onEdit: (patch: Partial<Draft>) => void;
  /** Send what is on screen now. The fields call it when they are left. */
  onSave: () => void;
}) {
  const missing = missingInDraft(step, draft);
  const id = (name: string) => fieldId(step.id, name);

  if (!open) {
    return (
      <li id={anchorOf(step.id)} className="min-w-0 scroll-mt-32">
        <ClosedStep step={step} draft={draft} missing={missing} onOpen={onOpen} />
      </li>
    );
  }

  return (
    <li id={anchorOf(step.id)} className="min-w-0 scroll-mt-32">
      <Card className={missing.length > 0 ? "border-2 border-ambar" : "border-2 border-pino/25"}>
        <div className="flex flex-wrap items-start gap-4">
          <Preview step={step} controls className="h-24 w-32 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-3 text-2xl font-extrabold">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tinta text-lg text-niebla">
                {step.order}
              </span>
              {step.title}
            </h3>
            <p className="mt-1 text-base text-tinta/60">
              {t.seconds(step.start_seconds, step.end_seconds)}
            </p>
            {step.reviewed && missing.length === 0 && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-salvia px-3 py-1 text-base font-bold text-pino">
                <CheckIcon size={18} />
                {t.reviewed}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor={id("easy_read_text")} className="font-bold">
              {t.fields.easy_read_text}
            </label>
            <textarea
              id={id("easy_read_text")}
              value={draft.easy_read_text}
              maxLength={300}
              rows={3}
              className={inputClass(missing.includes("easy_read_text"))}
              onChange={(event) => onEdit({ easy_read_text: event.target.value })}
              onBlur={onSave}
            />
            {/* What easy read asks for, as one quiet line. As chips it was two rows of colour
                competing with the field it is advice about. */}
            <span className="mt-2 block text-base text-tinta/55">
              {t.easyReadHints.join(" · ")}
            </span>
          </div>

          <div>
            <label htmlFor={id("who_to_ask_for_help")} className="font-bold">
              {t.fields.who_to_ask_for_help}
            </label>
            <input
              id={id("who_to_ask_for_help")}
              value={draft.who_to_ask_for_help}
              className={inputClass(missing.includes("who_to_ask_for_help"))}
              onChange={(event) => onEdit({ who_to_ask_for_help: event.target.value })}
              onBlur={onSave}
            />
            {missing.includes("who_to_ask_for_help") && (
              <span className="mt-1 block text-base text-sobre-ambar">{t.missingHint}</span>
            )}
          </div>

          <div>
            <label htmlFor={id("duration_text")} className="font-bold">
              {t.fields.duration_text}
            </label>
            <input
              id={id("duration_text")}
              value={draft.duration_text}
              maxLength={80}
              className={inputClass(missing.includes("duration_text"))}
              onChange={(event) => onEdit({ duration_text: event.target.value })}
              onBlur={onSave}
            />
            {missing.includes("duration_text") && (
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
            <span id={id("noise_level")} className="mt-2 flex flex-wrap items-center gap-3">
              <Segmented
                label={t.fields.noise_level}
                value={draft.noise_level || null}
                options={NOISE_LEVELS.map((level) => ({ value: level, label: t.noise[level] }))}
                onChange={(level) => onEdit({ noise_level: level })}
              />
              {draft.noise_level && (
                <NoiseLevel level={draft.noise_level} label={t.noise[draft.noise_level]} />
              )}
            </span>
          </div>
        </div>

        {missing.length > 0 && (
          <p className="mt-4 flex items-center gap-3 rounded-2xl bg-ambar/35 px-4 py-3 text-base text-sobre-ambar">
            <AlertIcon size={22} />
            {missing
              .map((name) => t.fields[name as keyof typeof t.fields] ?? name)
              .join(" · ")}
          </p>
        )}

      </Card>
    </li>
  );
}
