"use client";

// "Ponlo a tu gusto": the visitor's own settings, reachable from the guide.
//
// The preview at the top changes with the text size, so the choice is made by looking at the
// result rather than by guessing what "A" means.
//
// The last row is not a setting. The warning before a sound is always on, so it has a padlock
// instead of a switch: a promise that can be switched off is not a promise.

import { es } from "../../lib/i18n/es.ts";
import { Segmented, Sheet, Toggle } from "../controls.tsx";
import { LockIcon } from "../icons.tsx";
import { usePrefs } from "../prefs.tsx";
import { Button, Card } from "../ui.tsx";

const t = es.ajustes;

/** A sentence of a real guide, so the size is judged on the text it will actually be used for. */
const PREVIEW = "Llegas al mostrador azul. Dices tu nombre.";

/**
 * The controls themselves, without the sheet around them.
 *
 * The welcome shows the same ones on its last screen: one definition of what can be changed, so
 * the settings a person meets on their first visit are the settings they find again later.
 */
export function SettingsControls() {
  const { prefs, setPrefs } = usePrefs();

  return (
    <>
      <Card className="mt-5">
        <p className="text-base font-bold tracking-widest text-pino uppercase">{t.preview}</p>
        <p className="mt-2 text-2xl">{PREVIEW}</p>
      </Card>

      <Card className="mt-4">
        <div className="flex min-h-14 items-center justify-between gap-4 py-2">
          <span className="text-lg font-bold">{t.textSize}</span>
          <Segmented
            label={t.textSize}
            value={prefs.textSize}
            options={[
              { value: "s", label: <span className="text-base">A</span>, title: t.textSizes.s },
              { value: "m", label: <span className="text-xl">A</span>, title: t.textSizes.m },
              { value: "l", label: <span className="text-3xl">A</span>, title: t.textSizes.l },
            ]}
            onChange={(size) => setPrefs({ textSize: size })}
          />
        </div>

        <hr className="border-tinta/10" />
        <Toggle
          label={t.dim}
          hint={t.dimHint}
          checked={prefs.theme === "tenue"}
          onChange={(on) => setPrefs({ theme: on ? "tenue" : "claro" })}
        />

        <hr className="border-tinta/10" />
        <Toggle
          label={t.readAloud}
          hint={t.readAloudHint}
          checked={prefs.readAloud}
          onChange={(on) => setPrefs({ readAloud: on })}
        />

        <hr className="border-tinta/10" />
        <Toggle
          label={t.pictograms}
          hint={t.pictogramsHint}
          checked={prefs.pictograms}
          onChange={(on) => setPrefs({ pictograms: on })}
        />

        <hr className="border-tinta/10" />
        <Toggle
          label={t.soundWarning}
          hint={t.soundWarningHint}
          checked
          locked
          lockedIcon={<LockIcon size={26} />}
        />
      </Card>
    </>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t.title}>
      <h2 className="text-3xl font-extrabold">{t.title}</h2>
      <p className="mt-1 text-tinta/70">{t.lead}</p>

      <SettingsControls />

      <div className="mt-6">
        <Button full onClick={onClose}>
          {t.close}
        </Button>
      </div>
    </Sheet>
  );
}
