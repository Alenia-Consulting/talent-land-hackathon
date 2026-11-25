"use client";

// The list of parts, one take each. Light, like every screen of the recorder that is not the camera.
//
// A row is a part and where its take is: not recorded, recorded and still repeatable, being sent,
// sent, or failed. The only place where the screen is allowed to be quiet about a failure is a take
// that has not been tried; everything else says what happened and what can be done with that row.
//
// The actions live in the recorder's footer ("Grabar" the next part, "Terminar"); the rows carry
// only what is about one part.

import { es } from "../../lib/i18n/es.ts";
import type { NoiseLevel } from "../../lib/guides.ts";
import { recordedCount, type Take } from "../../lib/pure/takes.ts";
import { Segmented } from "../controls.tsx";
import { CheckIcon } from "../icons.tsx";
import { Button, Card } from "../ui.tsx";

const t = es.takes;
const NOISE: NoiseLevel[] = ["quiet", "medium", "noisy"];

function stateText(take: Take, progress: number): string {
  switch (take.state) {
    case "pending":
      return t.states.pending;
    case "recorded":
      return t.states.recorded(take.durationSec ?? 0);
    case "uploading":
      // Past the last byte the server is still working: say so instead of freezing at 100 %.
      return progress >= 1 ? t.states.processing : t.states.uploading(Math.round(progress * 100));
    case "sent":
      return t.states.sent;
    case "failed":
      return t.states.failed;
  }
}

function Row({
  take,
  index,
  next,
  finished,
  error,
  progress,
  onRecord,
  onRepeat,
  onRetry,
  onDownload,
  onNoise,
}: {
  take: Take;
  index: number;
  next: boolean;
  finished: boolean;
  error: string | undefined;
  progress: number;
  onRecord: (index: number) => void;
  onRepeat: (index: number) => void;
  onRetry: (index: number) => void;
  onDownload: (index: number) => void;
  onNoise: (index: number, level: NoiseLevel) => void;
}) {
  const { state } = take;
  return (
    <li>
      <Card className={next && !finished ? "border-2 border-pino/40" : ""}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
              state === "sent" ? "bg-pino text-sobre-pino" : "bg-salvia text-pino"
            }`}
          >
            {state === "sent" ? <CheckIcon size={22} /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-bold">{take.part.title}</span>
            <span className={`block text-base ${state === "failed" ? "text-sobre-coral" : "text-tinta/70"}`}>
              {stateText(take, progress)}
            </span>
          </span>
          {!finished && state === "pending" && (
            <Button variant={next ? "primary" : "secondary"} onClick={() => onRecord(index)}>
              {t.record}
            </Button>
          )}
          {!finished && (state === "recorded" || state === "sent") && (
            <Button variant="secondary" onClick={() => onRepeat(index)}>
              {t.repeat}
            </Button>
          )}
          {state === "failed" && (
            <Button variant="secondary" onClick={() => onRetry(index)}>
              {t.retry}
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-base text-sobre-coral">
            {error}
          </p>
        )}
        {state === "failed" && (
          <button type="button" onClick={() => onDownload(index)} className="mt-2 text-base font-bold text-pino underline">
            {t.download}
          </button>
        )}

        {/* Asked once, right after the take and before it leaves the phone, because it travels
            with it. Left unanswered it stays empty: the centre can say it from the panel. */}
        {!finished && state === "recorded" && (
          <div className="mt-4">
            <p className="mb-2 font-bold">{t.noiseQuestion}</p>
            <Segmented
              label={t.noiseQuestion}
              value={take.noise}
              options={NOISE.map((level) => ({ value: level, label: t.noise[level] }))}
              onChange={(level) => onNoise(index, level)}
            />
          </div>
        )}
      </Card>
    </li>
  );
}

export function TakesScreen({
  venue,
  takes,
  errors,
  progress,
  finished,
  next,
  onRecord,
  onRepeat,
  onRetry,
  onDownload,
  onNoise,
}: {
  venue: string;
  takes: readonly Take[];
  errors: Record<number, string>;
  progress: Record<number, number>;
  finished: boolean;
  /** Index of the part that is up next, or null when none is left. */
  next: number | null;
  onRecord: (index: number) => void;
  onRepeat: (index: number) => void;
  onRetry: (index: number) => void;
  onDownload: (index: number) => void;
  onNoise: (index: number, level: NoiseLevel) => void;
}) {
  const unsent = takes.some((take) => ["recorded", "uploading", "failed"].includes(take.state));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-4xl font-extrabold">{finished ? t.finishedTitle : t.title}</h1>
        <p className="mt-2 text-tinta/70">{finished ? t.finishedLead : t.lead}</p>
        <p className="mt-2 font-bold">
          {venue} · {t.count(recordedCount(takes), takes.length)}
        </p>
      </div>
      <ol className="grid gap-3">
        {takes.map((take, index) => (
          <Row
            key={`${take.part.category}-${index}`}
            take={take}
            index={index}
            next={index === next}
            finished={finished}
            error={errors[index]}
            progress={progress[index] ?? 0}
            onRecord={onRecord}
            onRepeat={onRepeat}
            onRetry={onRetry}
            onDownload={onDownload}
            onNoise={onNoise}
          />
        ))}
      </ol>
      {/* Honest about the one thing this does not do: the takes live on the phone until they
          are sent, and closing the tab loses what has not gone up. */}
      {unsent && <p className="rounded-2xl bg-ambar/35 px-4 py-3 text-sobre-ambar">{t.keepOpen}</p>}
    </div>
  );
}
