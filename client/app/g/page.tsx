"use client";

// What a visitor opens from the link or the QR code. Published guides only; the API refuses to
// serve a draft here.
//
// Three views, and the person chooses between them: the landing, the step-by-step run, and the
// whole route on one page for someone who would rather scroll than tap. Nothing starts on its
// own in any of them.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { ApiError, type Guide, readPublicGuide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { ChevronLeftIcon } from "../icons.tsx";
import { ActionBar, Button, Card, NoiseLevel } from "../ui.tsx";
import { usePrefs } from "../prefs.tsx";
import { Landing } from "./landing.tsx";
import { Player } from "./player.tsx";
import { Welcome } from "./welcome.tsx";

const t = es.publica;

type View = { name: "landing" } | { name: "player"; index: number } | { name: "full" };

function reviewedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // Short month, as the design writes it: "24 nov 2026". The long form pushes the pill onto a
  // line of its own and buries the three facts the visitor reads in one glance.
  return t.reviewedAt(
    date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
  );
}

/** The whole route on one page, for someone who prefers scrolling to tapping. */
function FullRoute({ guide, onBack }: { guide: Guide; onBack: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col">
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold">{guide.venue_name}</h1>

        <ol className="mt-6 grid gap-4">
          {guide.steps.map((step) => (
            <li key={step.id}>
              <Card>
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-salvia text-2xl font-extrabold text-pino">
                    {step.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-extrabold">{step.title}</h2>
                    {step.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={step.photo_url}
                        alt=""
                        className="mt-3 aspect-[4/3] w-full rounded-2xl bg-salvia object-cover"
                      />
                    ) : (
                      <p className="mt-2 rounded-2xl bg-niebla p-3 text-base text-tinta/55">
                        {t.noMedia}
                      </p>
                    )}
                    {step.easy_read_text && <p className="mt-3">{step.easy_read_text}</p>}
                    {step.noise_level && (
                      <p className="mt-3">
                        <NoiseLevel
                          level={step.noise_level}
                          label={t.noise[step.noise_level as keyof typeof t.noise] ?? step.noise_level}
                        />
                      </p>
                    )}
                    {step.what_to_expect.length > 0 && (
                      <ul className="mt-3 list-disc pl-6">
                        {step.what_to_expect.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {step.who_to_ask_for_help && (
                      <p className="mt-4 rounded-2xl bg-salvia p-4">
                        <span className="font-bold">{t.whoToAsk}:</span> {step.who_to_ask_for_help}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </div>

      {/* This page is as long as the route. The way back belongs on the bottom edge, not at the
          top of a list somebody has just scrolled to the end of. */}
      <ActionBar>
        <Button full variant="secondary" icon={<ChevronLeftIcon size={22} />} onClick={onBack}>
          {t.back}
        </Button>
      </ActionBar>
    </div>
  );
}

function PublicGuide() {
  const slug = useSearchParams().get("slug");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "landing" });
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const { prefs, ready } = usePrefs();
  // Held separately from the stored flag so that finishing the welcome does not wait on a write
  // to storage a private window may refuse.
  const [welcomed, setWelcomed] = useState(false);

  useEffect(() => {
    if (!slug) return;
    readPublicGuide(slug)
      .then(setGuide)
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError && cause.status === 404 ? t.notFound : String(cause));
      });
  }, [slug]);

  /**
   * The steps the run will walk through.
   *
   * Choosing interests narrows the route; choosing none shows all of it. A selection that
   * matched nothing would leave an empty player, so it falls back to the whole route.
   */
  const steps = useMemo(() => {
    if (!guide) return [];
    if (chosen.size === 0) return guide.steps;
    const picked = guide.steps.filter((step) =>
      step.interests.some((interest) => chosen.has(interest)),
    );
    return picked.length > 0 ? picked : guide.steps;
  }, [guide, chosen]);

  if (!slug || error)
    return (
      <p role="alert" className="rounded-2xl bg-coral/15 p-4 text-sobre-coral">
        {error ?? t.missingSlug}
      </p>
    );
  if (!guide) return <p className="text-tinta/70">{t.loading}</p>;

  // Only once the stored preferences have been read: showing the welcome to somebody who has
  // already answered it, for the one frame before storage comes back, is worse than a blank.
  if (ready && !prefs.onboarded && !welcomed)
    return <Welcome onDone={() => setWelcomed(true)} />;

  if (view.name === "player" && steps.length > 0)
    return (
      <Player
        steps={steps}
        index={Math.min(view.index, steps.length - 1)}
        onMove={(index) => setView({ name: "player", index })}
        onClose={() => setView({ name: "landing" })}
      />
    );

  if (view.name === "full")
    return <FullRoute guide={guide} onBack={() => setView({ name: "landing" })} />;

  return (
    <Landing
      guide={guide}
      reviewed={reviewedOn(guide.reviewed_at)}
      chosen={chosen}
      onToggle={(interest) =>
        setChosen((current) => {
          const next = new Set(current);
          if (!next.delete(interest)) next.add(interest);
          return next;
        })
      }
      onStart={() => setView({ name: "player", index: 0 })}
      onSeeAll={() => setView({ name: "full" })}
    />
  );
}

export default function PublicGuidePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-6">
      <Suspense fallback={<p className="text-tinta/70">{t.loading}</p>}>
        <PublicGuide />
      </Suspense>
    </main>
  );
}
