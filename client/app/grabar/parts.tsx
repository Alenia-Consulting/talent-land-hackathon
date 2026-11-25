"use client";

// Before recording, the person says where they are going to walk and what the place is called.
// Those parts become the "Llegué a: X" buttons during the recording, and the steps of the guide.
//
// Light, like every screen of the recorder that is not the camera.
//
// The screen has no button of its own: "Continuar" lives in the recorder's footer, where every
// other screen keeps its action, so it is on the bottom edge whatever the list of parts does to
// the height of the page. That is why the plan is held by the page and passed in.

import { es } from "../../lib/i18n/es.ts";
import { CATALOGUE, MAX_MARKS, type Part, planProblem } from "../../lib/pure/marks.ts";
import { CloseIcon, PlusIcon } from "../icons.tsx";

export type Plan = { title: string; venue: string; parts: Part[] };

const t = es.partes;

export const EMPTY_PLAN: Plan = { title: t.guideTitlePlaceholder, venue: "", parts: [] };

/** What is still stopping this route from being recorded, in words, or null. */
export function planWarning(plan: Plan): string | null {
  const problem = planProblem(plan.venue, plan.parts.length);
  if (problem === "venue") return t.needVenue;
  if (problem === "parts") return t.needTwo;
  return null;
}

const inputClass =
  "mt-1 w-full rounded-2xl border-2 border-tinta/15 bg-tarjeta px-4 py-3 text-lg text-tinta placeholder:text-tinta/45 focus:border-pino focus:outline-none";

export function PartsScreen({
  plan,
  onChange,
  addingTo,
}: {
  plan: Plan;
  onChange: (next: Plan) => void;
  /** The venue of the guide this recording is added to: its name is not asked again. */
  addingTo?: string;
}) {
  const warning = planWarning(plan);
  const full = plan.parts.length >= MAX_MARKS;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
      <div>
        <h1 className="text-4xl font-extrabold">{t.title}</h1>
        <p className="mt-2 text-tinta/70">{t.lead}</p>
      </div>

      {addingTo ? (
        <p className="font-bold text-pino">{t.addingTo(addingTo)}</p>
      ) : (
      <p>
        <label htmlFor="venue-name" className="font-bold">
          {t.venue}
        </label>
        <input
          id="venue-name"
          value={plan.venue}
          maxLength={200}
          placeholder={t.venuePlaceholder}
          className={inputClass}
          onChange={(event) => onChange({ ...plan, venue: event.target.value })}
        />
      </p>
      )}

      <p>
        <label htmlFor="guide-title" className="font-bold">
          {t.guideTitle}
        </label>
        <input
          id="guide-title"
          value={plan.title}
          maxLength={120}
          className={inputClass}
          onChange={(event) => onChange({ ...plan, title: event.target.value })}
        />
      </p>

      <div>
        <h2 className="font-bold">{t.add}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {CATALOGUE.map((part) => (
            <li key={part.category}>
              <button
                type="button"
                disabled={full}
                onClick={() => onChange({ ...plan, parts: [...plan.parts, part] })}
                className="inline-flex min-h-12 items-center gap-2 rounded-[18px] border-2 border-pino/35 bg-tarjeta px-4 text-lg font-bold text-pino disabled:opacity-40"
              >
                <PlusIcon size={20} />
                {part.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-bold">{t.chosen}</h2>
        {plan.parts.length === 0 ? (
          <p className="mt-2 text-tinta/60">{t.empty}</p>
        ) : (
          // Numbered the way they will be walked, because the order is the recording order and a
          // mistake here is a mistake the person only notices with the camera already open.
          <ol className="mt-2 flex flex-wrap gap-2">
            {plan.parts.map((part, index) => (
              <li
                key={`${part.category}-${index}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-[18px] bg-salvia pr-2 pl-4 text-lg font-bold text-pino"
              >
                <span>
                  {index + 1} {part.title}
                </span>
                <button
                  type="button"
                  aria-label={`${t.remove} ${part.title}`}
                  onClick={() =>
                    onChange({ ...plan, parts: plan.parts.filter((_, i) => i !== index) })
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-pino"
                >
                  <CloseIcon size={20} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {warning && (
        <p role="alert" className="rounded-2xl bg-ambar/35 p-4 text-sobre-ambar">
          {warning}
        </p>
      )}
    </div>
  );
}
