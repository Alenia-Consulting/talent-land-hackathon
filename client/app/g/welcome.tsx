"use client";

// The first time somebody opens a guide: three screens, then never again.
//
// It exists because the settings that matter most — big text, a voice, the dim theme — are the
// ones a person needing them cannot find while already standing in the waiting room. Asking once,
// in plain words, puts them in before the first step.
//
// Nothing here is sent anywhere. The answers choose settings and are then forgotten; what is
// stored is the settings. "Sin diagnósticos", as the design says, is a promise about the wire as
// much as about the wording.

import { useState } from "react";

import { es } from "../../lib/i18n/es.ts";
import { NEEDS, type Need, settingsFor } from "../../lib/pure/needs.ts";
import { useSpeech } from "../../lib/useSpeech.ts";
import { Segmented } from "../controls.tsx";
import {
  CompassIcon,
  DocumentIcon,
  EarIcon,
  EyeIcon,
  HeadphonesIcon,
  LockIcon,
  VolumeIcon,
} from "../icons.tsx";
import { usePrefs } from "../prefs.tsx";
import { Button, Card } from "../ui.tsx";
import { SettingsControls } from "./settings.tsx";

const t = es.bienvenida;
const SLIDES = 3;

const NEED_ICONS: Record<Need, React.ReactNode> = {
  sight: <EyeIcon size={26} />,
  hearing: <EarIcon size={26} />,
  reading: <DocumentIcon size={26} />,
  overload: <HeadphonesIcon size={26} />,
  wayfinding: <CompassIcon size={26} />,
};

/** The one picture in the product: a phone holding the place that is through the door. */
function Illustration() {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl bg-salvia">
      <svg viewBox="0 0 200 140" className="h-full w-full p-6" aria-hidden="true">
        <rect x="26" y="18" width="62" height="104" rx="12" fill="none" stroke="#15302b" strokeWidth="5" />
        <rect x="36" y="30" width="34" height="6" rx="3" fill="#9ec4b4" />
        <rect x="36" y="42" width="22" height="6" rx="3" fill="#9ec4b4" />
        <path d="M46 104V74a11 11 0 0 1 22 0v30" fill="none" stroke="#1f5d50" strokeWidth="5" />
        <circle cx="57" cy="88" r="4.5" fill="#f2b45a" />
        <path d="M100 70h2M108 70h2M116 70h2" stroke="#1f5d50" strokeWidth="4" strokeLinecap="round" />
        <path d="M132 122V50a22 22 0 0 1 44 0v72" fill="none" stroke="#1f5d50" strokeWidth="6" />
        <circle cx="154" cy="78" r="7" fill="#f2b45a" />
      </svg>
    </div>
  );
}

function Dots({ at }: { at: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-2">
      {Array.from({ length: SLIDES }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full ${i === at ? "w-7 bg-pino" : "w-2 bg-tinta/25"}`}
        />
      ))}
    </span>
  );
}

function NeedsSlide({
  chosen,
  onToggle,
}: {
  chosen: ReadonlySet<Need>;
  onToggle: (need: Need) => void;
}) {
  const [who, setWho] = useState<"self" | "other">("self");
  const changing = Object.keys(settingsFor([...chosen])).length;

  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.needs.title}</h1>
      <div className="mt-4">
        <Segmented
          label={t.needs.title}
          value={who}
          full
          options={[
            { value: "self", label: t.needs.who.self },
            { value: "other", label: t.needs.who.other },
          ]}
          onChange={setWho}
        />
      </div>

      <h2 className="mt-7 text-2xl font-extrabold">
        {who === "self" ? t.needs.question : t.needs.questionOther}
      </h2>
      <p className="mt-1 text-tinta/70">{t.needs.lead}</p>

      <ul className="mt-4 grid gap-3">
        {NEEDS.map((need) => {
          const on = chosen.has(need);
          return (
            <li key={need}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggle(need)}
                className={`flex w-full items-center gap-4 rounded-3xl p-4 text-left ${
                  on ? "bg-salvia ring-2 ring-pino" : "bg-tarjeta"
                }`}
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-niebla text-pino">
                  {NEED_ICONS[need]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{t.needs.options[need].title}</span>
                  <span className="mt-0.5 block text-base leading-snug text-tinta/70">
                    {t.needs.options[need].hint}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${
                    on ? "border-pino bg-pino text-sobre-pino" : "border-tinta/30"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-start gap-3 text-base text-tinta/70">
        <span className="text-pino">
          <LockIcon size={22} />
        </span>
        {t.needs.privacy}
      </p>

      {/* Says what the choices did. Nothing is claimed that did not happen. */}
      {chosen.size > 0 && (
        <Card className="mt-4 bg-salvia">
          <p className="text-pino">
            {changing > 0 ? `${t.needs.willChange} ${summary(chosen)}` : t.needs.nothingYet}
          </p>
        </Card>
      )}
    </>
  );
}

/** The settings about to change, in the words the settings screen itself uses. */
function summary(chosen: ReadonlySet<Need>): string {
  const patch = settingsFor([...chosen]);
  const parts = [
    patch.textSize === "l" ? es.ajustes.textSizes.l.toLowerCase() : null,
    patch.readAloud ? es.ajustes.readAloud.toLowerCase() : null,
    patch.pictograms ? es.ajustes.pictograms.toLowerCase() : null,
    patch.theme === "tenue" ? es.ajustes.dim.toLowerCase() : null,
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

export function Welcome({ onDone }: { onDone: () => void }) {
  const { setPrefs } = usePrefs();
  const [slide, setSlide] = useState(0);
  const [chosen, setChosen] = useState<ReadonlySet<Need>>(new Set());
  const speech = useSpeech();

  const finish = () => {
    setPrefs({ onboarded: true });
    onDone();
  };

  const toggle = (need: Need) => {
    const next = new Set(chosen);
    if (next.has(need)) next.delete(need);
    else next.add(need);
    setChosen(next);
  };

  // Applied on leaving the question, not on every tap, so the screen does not change under the
  // hand of somebody still reading it.
  const applyAndAdvance = () => {
    const patch = settingsFor([...chosen]);
    if (Object.keys(patch).length > 0) setPrefs(patch);
    setSlide(2);
  };

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <header className="mb-6 flex items-center justify-between gap-4">
        {slide === 0 ? (
          <button
            type="button"
            onClick={() =>
              speech.speaking
                ? speech.stop()
                : speech.speak(`${t.welcome.title}. ${t.welcome.lead}`)
            }
            className="inline-flex min-h-14 items-center gap-3 rounded-[18px] bg-tarjeta px-5 text-base font-bold"
          >
            <span className="text-pino">
              <VolumeIcon size={22} />
            </span>
            {t.listen}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSlide(slide - 1)}
            className="inline-flex min-h-14 items-center rounded-[18px] bg-tarjeta px-5 text-base font-bold"
          >
            {t.back}
          </button>
        )}

        {slide > 0 && <Dots at={slide} />}

        <button type="button" onClick={finish} className="min-h-14 font-bold text-pino underline">
          {t.skip}
        </button>
      </header>

      <div className="flex-1">
        {slide === 0 && (
          <>
            <Illustration />
            <h1 className="mt-6 text-4xl font-extrabold">{t.welcome.title}</h1>
            <p className="mt-3 text-xl text-tinta/70">{t.welcome.lead}</p>
            <p className="mt-6">
              <Dots at={0} />
            </p>
          </>
        )}
        {slide === 1 && <NeedsSlide chosen={chosen} onToggle={toggle} />}
        {slide === 2 && (
          <>
            <h1 className="text-4xl font-extrabold">{t.ready.title}</h1>
            <p className="mt-1 text-tinta/70">{t.ready.lead}</p>
            <SettingsControls />
          </>
        )}
      </div>

      <div className="mt-8">
        {slide === 0 && (
          <>
            <Button full onClick={() => setSlide(1)}>
              {t.welcome.start}
            </Button>
            <p className="mt-3 text-center text-base text-tinta/60">{t.welcome.free}</p>
          </>
        )}
        {slide === 1 && (
          <Button full onClick={applyAndAdvance}>
            {t.needs.next}
          </Button>
        )}
        {slide === 2 && (
          <Button full onClick={finish}>
            {t.ready.start}
          </Button>
        )}
      </div>
    </div>
  );
}
