"use client";

// The points the clip stops to show, as the venue corrects them.
//
// The AI proposes them on the photo of the step and gets some wrong: a box on the wrong table, an
// arrow on a person. A guide for people who cannot work around a wrong signal must not go out
// with one, so each point can be renamed, moved, resized or deleted here. There is no "add": a
// point nobody saw is the product inventing, and the venue can always write the place into the
// step's text instead.
//
// Moving is "tap the photo where it is", not dragging: a drag is hard on a phone, and a tap is
// something everyone can do.

import { useState } from "react";

import type { Step } from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";
import { movePoint, type Point, scalePoint } from "../../../lib/pure/points.ts";
import { PointsOverlay } from "../../g/points.tsx";

const t = es.panel.detail.points;

const field = "mt-1 w-full rounded-2xl border-2 border-tinta/15 bg-niebla px-4 py-3 text-lg text-tinta focus:border-pino focus:outline-none";
const action =
  "inline-flex min-h-12 items-center justify-center rounded-2xl bg-salvia px-4 text-base font-bold text-tinta";

export function PointsEditor({
  step,
  points,
  onChange,
  onSave,
}: {
  step: Step;
  points: Point[];
  /** The whole new list. Saved after a pause, or at once when `now` is set. */
  onChange: (points: Point[], now?: boolean) => void;
  onSave: () => void;
}) {
  // The point waiting for a tap on the photo to say where it goes.
  const [placing, setPlacing] = useState<number | null>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  if (!step.photo_url) return null;

  const replace = (index: number, point: Point, now = false) =>
    onChange(points.map((one, i) => (i === index ? point : one)), now);

  return (
    <div>
      <h4 className="font-bold">{t.title}</h4>
      <p className="mt-1 text-base text-tinta/60">{t.hint}</p>

      <div className="relative mx-auto mt-3 w-full max-w-xs overflow-hidden rounded-2xl bg-salvia">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={step.photo_url}
          alt={t.photoAlt}
          className="block h-auto w-full"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) setFrame({ width: naturalWidth, height: naturalHeight });
          }}
        />
        {frame && points.length > 0 && (
          <PointsOverlay points={points} width={frame.width} height={frame.height} />
        )}
        {placing !== null && (
          <button
            type="button"
            aria-label={t.moving}
            className="absolute inset-0 cursor-crosshair bg-tinta/10"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const moved = movePoint(
                points[placing]!,
                (event.clientX - rect.left) / rect.width,
                (event.clientY - rect.top) / rect.height,
              );
              setPlacing(null);
              replace(placing, moved, true);
            }}
          />
        )}
      </div>
      {placing !== null && <p className="mt-2 text-base font-bold text-pino">{t.moving}</p>}

      {points.length === 0 ? (
        <p className="mt-3 text-base text-tinta/60">{t.none}</p>
      ) : (
        <ul className="mt-3 grid gap-4">
          {points.map((point, i) => (
            <li key={i} className="rounded-2xl border-2 border-tinta/10 p-3">
              <label className="font-bold" htmlFor={`point-${step.id}-${i}-label`}>
                {i + 1}. {t.label}
              </label>
              <input
                id={`point-${step.id}-${i}-label`}
                value={point.label}
                maxLength={60}
                className={field}
                onChange={(event) => replace(i, { ...point, label: event.target.value })}
                onBlur={onSave}
              />
              <label className="mt-3 block font-bold" htmlFor={`point-${step.id}-${i}-text`}>
                {t.description}
              </label>
              <textarea
                id={`point-${step.id}-${i}-text`}
                value={point.description}
                maxLength={160}
                rows={2}
                className={field}
                onChange={(event) => replace(i, { ...point, description: event.target.value })}
                onBlur={onSave}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={placing === i}
                  className={`${action} ${placing === i ? "ring-2 ring-pino" : ""}`}
                  onClick={() => setPlacing(placing === i ? null : i)}
                >
                  {t.move}
                </button>
                <button type="button" className={action} onClick={() => replace(i, scalePoint(point, 1.25), true)}>
                  {t.bigger}
                </button>
                <button type="button" className={action} onClick={() => replace(i, scalePoint(point, 0.8), true)}>
                  {t.smaller}
                </button>
                <button
                  type="button"
                  className={`${action} text-sobre-coral`}
                  onClick={() => {
                    setPlacing(null);
                    onChange(points.filter((_, j) => j !== i), true);
                  }}
                >
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
