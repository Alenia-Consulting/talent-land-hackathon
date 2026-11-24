"use client";

// What a visitor opens from the link or the QR code. Published guides only; the API refuses to
// serve a draft here. Not styled yet.
//
// Two product rules are visible in this file: the date of the last human review is always shown,
// and nothing plays on its own — there is no autoplay and no audio element anywhere.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiError, type Guide, readPublicGuide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";

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

  if (!slug) return <p role="alert">{t.missingSlug}</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!guide) return <p>{t.loading}</p>;

  const reviewed = reviewedOn(guide.reviewed_at);

  return (
    <>
      <h1>{guide.venue_name}</h1>
      <p>{guide.title}</p>
      {reviewed && <p>{reviewed}</p>}

      <h2>{t.steps}</h2>
      <ol>
        {guide.steps.map((step) => (
          <li key={step.id}>
            <h3>{step.title}</h3>

            {step.photo_url ? (
              <img src={step.photo_url} alt="" />
            ) : (
              <p>{t.noMedia}</p>
            )}

            {step.easy_read_text && <p>{step.easy_read_text}</p>}

            {step.duration_text && (
              <p>
                {t.duration}: {step.duration_text}
              </p>
            )}

            {step.what_to_expect.length > 0 && (
              <>
                <h4>{t.whatToExpect}</h4>
                <ul>
                  {step.what_to_expect.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {step.who_to_ask_for_help && (
              <p>
                {t.whoToAsk}: {step.who_to_ask_for_help}
              </p>
            )}

            {step.noise_level && <p>{t.noise[step.noise_level as keyof typeof t.noise]}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}

export default function PublicGuidePage() {
  return (
    <main>
      <Suspense fallback={<p>{t.loading}</p>}>
        <PublicGuide />
      </Suspense>
    </main>
  );
}
