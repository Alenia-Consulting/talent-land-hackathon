"use client";

// Before recording, the person says where they are going to walk and what the place is called.
// Those parts become the "Llegué a: X" buttons during the recording, and the steps of the guide.
// Not styled yet.

import { useState } from "react";

import { es } from "../../lib/i18n/es.ts";
import { CATALOGUE, MAX_MARKS, MIN_MARKS, type Part } from "../../lib/pure/marks.ts";
import { ActionButton } from "./screens.tsx";

export type Plan = { title: string; venue: string; parts: Part[] };

const t = es.partes;

export function PartsScreen({ onReady }: { onReady: (plan: Plan) => void }) {
  const [title, setTitle] = useState<string>(t.guideTitlePlaceholder);
  const [venue, setVenue] = useState("");
  const [parts, setParts] = useState<Part[]>([]);

  const problem = !venue.trim() ? t.needVenue : parts.length < MIN_MARKS ? t.needTwo : null;

  return (
    <div>
      <h1>{t.title}</h1>
      <p>{t.lead}</p>

      <p>
        <label htmlFor="guide-title">{t.guideTitle}</label>
        <br />
        <input
          id="guide-title"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </p>

      <p>
        <label htmlFor="venue-name">{t.venue}</label>
        <br />
        <input
          id="venue-name"
          value={venue}
          maxLength={200}
          placeholder={t.venuePlaceholder}
          onChange={(event) => setVenue(event.target.value)}
        />
      </p>

      <ul>
        {CATALOGUE.map((part) => (
          <li key={part.category}>
            {part.title}{" "}
            <button
              type="button"
              disabled={parts.length >= MAX_MARKS}
              onClick={() => setParts([...parts, part])}
            >
              {t.add}
            </button>
          </li>
        ))}
      </ul>

      <h2>{t.chosen}</h2>
      {parts.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ol>
          {parts.map((part, index) => (
            <li key={`${part.category}-${index}`}>
              {part.title}{" "}
              <button type="button" onClick={() => setParts(parts.filter((_, i) => i !== index))}>
                {t.remove}
              </button>
            </li>
          ))}
        </ol>
      )}

      {problem && <p role="alert">{problem}</p>}

      <ActionButton
        disabled={problem !== null}
        onClick={() => onReady({ title: title.trim(), venue: venue.trim(), parts })}
      >
        {t.next}
      </ActionButton>
    </div>
  );
}
