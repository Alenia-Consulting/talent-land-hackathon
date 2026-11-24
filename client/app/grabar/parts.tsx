"use client";

// Before recording, the person says where they are going to walk and what the place is called.
// Those parts become the "Llegué a: X" buttons during the recording, and the steps of the guide.
//
// Styled dark, because it sits inside the recording screen.

import { useState } from "react";

import { es } from "../../lib/i18n/es.ts";
import { CATALOGUE, MAX_MARKS, MIN_MARKS, type Part } from "../../lib/pure/marks.ts";
import { ActionButton } from "./screens.tsx";

export type Plan = { title: string; venue: string; parts: Part[] };

const t = es.partes;

const inputClass =
  "mt-1 w-full rounded-2xl border-2 border-white/25 bg-white/10 px-4 py-3 text-lg text-white placeholder:text-white/40 focus:border-white focus:outline-none";

export function PartsScreen({ onReady }: { onReady: (plan: Plan) => void }) {
  const [title, setTitle] = useState<string>(t.guideTitlePlaceholder);
  const [venue, setVenue] = useState("");
  const [parts, setParts] = useState<Part[]>([]);

  const problem = !venue.trim() ? t.needVenue : parts.length < MIN_MARKS ? t.needTwo : null;

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
      <div>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-2 text-white/75">{t.lead}</p>
      </div>

      <p>
        <label htmlFor="venue-name" className="font-bold">
          {t.venue}
        </label>
        <input
          id="venue-name"
          value={venue}
          maxLength={200}
          placeholder={t.venuePlaceholder}
          className={inputClass}
          onChange={(event) => setVenue(event.target.value)}
        />
      </p>

      <p>
        <label htmlFor="guide-title" className="font-bold">
          {t.guideTitle}
        </label>
        <input
          id="guide-title"
          value={title}
          maxLength={120}
          className={inputClass}
          onChange={(event) => setTitle(event.target.value)}
        />
      </p>

      <div>
        <h2 className="font-bold">{t.add}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {CATALOGUE.map((part) => (
            <li key={part.category}>
              <button
                type="button"
                disabled={parts.length >= MAX_MARKS}
                onClick={() => setParts([...parts, part])}
                className="min-h-12 rounded-[18px] border-2 border-white/30 px-4 text-lg font-bold disabled:opacity-40"
              >
                + {part.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-bold">{t.chosen}</h2>
        {parts.length === 0 ? (
          <p className="mt-2 text-white/60">{t.empty}</p>
        ) : (
          <ol className="mt-2 grid gap-2">
            {parts.map((part, index) => (
              <li
                key={`${part.category}-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3"
              >
                <span className="text-lg">
                  <span className="font-bold">{index + 1}.</span> {part.title}
                </span>
                <button
                  type="button"
                  onClick={() => setParts(parts.filter((_, i) => i !== index))}
                  className="min-h-12 rounded-[18px] px-4 font-bold underline"
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {problem && (
        <p role="alert" className="rounded-2xl bg-white/10 p-4 text-white/80">
          {problem}
        </p>
      )}

      <ActionButton
        disabled={problem !== null}
        onClick={() => onReady({ title: title.trim(), venue: venue.trim(), parts })}
      >
        {t.next}
      </ActionButton>
    </div>
  );
}
