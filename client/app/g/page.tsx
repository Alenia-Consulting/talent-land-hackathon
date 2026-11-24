"use client";

// What a visitor opens from the link or the QR code. Published guides only; the API refuses to
// serve a draft here.
//
// Three product rules are visible in this file: the date of the last human review is always
// shown, nothing plays on its own (no autoplay, no audio element), and the noise level is never
// colour alone.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiError, type Guide, readPublicGuide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { Card, NoiseLevel } from "../ui.tsx";

const t = es.publica;

function reviewedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return t.reviewedAt(
    date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
  );
}

function PublicGuide() {
  const slug = useSearchParams().get("slug");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    readPublicGuide(slug)
      .then(setGuide)
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError && cause.status === 404 ? t.notFound : String(cause));
      });
  }, [slug]);

  if (!slug || error)
    return (
      <p role="alert" className="rounded-2xl bg-coral/15 p-4 text-[#9c3a22]">
        {error ?? t.missingSlug}
      </p>
    );
  if (!guide) return <p className="text-tinta/70">{t.loading}</p>;

  const reviewed = reviewedOn(guide.reviewed_at);

  return (
    <>
      <header>
        <h1 className="text-4xl font-extrabold">{guide.venue_name}</h1>
        <p className="mt-1 text-xl text-tinta/70">{guide.title}</p>
        {/* Always visible: the visitor needs to know how fresh this is. */}
        {reviewed && (
          <p className="mt-3 inline-block rounded-full bg-salvia px-4 py-2 text-base font-bold text-pino">
            {reviewed}
          </p>
        )}
      </header>

      <h2 className="mt-8 mb-3 text-base font-bold tracking-widest text-pino uppercase">
        {t.steps}
      </h2>

      <ol className="grid gap-4">
        {guide.steps.map((step) => (
          <li key={step.id}>
            <Card>
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-salvia text-2xl font-extrabold text-pino">
                  {step.order}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl font-extrabold">{step.title}</h3>

                  {step.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={step.photo_url} alt="" className="mt-3 w-full rounded-2xl" />
                  ) : (
                    <p className="mt-2 rounded-2xl bg-niebla p-3 text-base text-tinta/55">
                      {t.noMedia}
                    </p>
                  )}

                  {step.easy_read_text && <p className="mt-3">{step.easy_read_text}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {step.noise_level && (
                      <NoiseLevel
                        level={step.noise_level}
                        label={t.noise[step.noise_level as keyof typeof t.noise]}
                      />
                    )}
                    {step.duration_text && (
                      <span className="rounded-full bg-salvia px-3 py-1 text-base font-bold text-pino">
                        {step.duration_text}
                      </span>
                    )}
                  </div>

                  {step.what_to_expect.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-bold">{t.whatToExpect}</h4>
                      <ul className="mt-1 list-disc pl-6">
                        {step.what_to_expect.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
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
    </>
  );
}

export default function PublicGuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Suspense fallback={<p className="text-tinta/70">{t.loading}</p>}>
        <PublicGuide />
      </Suspense>
    </main>
  );
}
