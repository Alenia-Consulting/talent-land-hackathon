"use client";

// What a visitor opens from the link or the QR code. Published guides only; the API refuses to
// serve a draft here.
//
// The client is exported statically, so there are no dynamic routes: the slug and the screen
// travel in the query string (?slug=…&paso=2, &sonido=1, &recorrido=1). That also makes the back
// button and the browser history work between screens.
//
// Product rules visible across these files: the date of the last human review is always shown,
// nothing plays on its own, sound is always preceded by a warning, and the noise level is never
// colour alone.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiError, type Guide, readPublicGuide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { Alert, ButtonLink, guideHref } from "./parts.tsx";
import { Overview, SoundView, StepView, TourView } from "./views.tsx";

const t = es.publica;

function PublicGuide() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const stepNumber = Number(params.get("paso"));
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

  if (!slug || error) return <Alert>{error ?? t.missingSlug}</Alert>;
  if (!guide) return <p className="text-tinta/70">{t.loading}</p>;

  if (params.get("recorrido")) return <TourView guide={guide} slug={slug} />;

  if (params.has("paso")) {
    const step = guide.steps.find((candidate) => candidate.order === stepNumber);
    if (!step)
      return (
        <>
          <Alert>{t.stepNotFound}</Alert>
          <div className="mt-6">
            <ButtonLink href={guideHref(slug)}>{t.toStart}</ButtonLink>
          </div>
        </>
      );
    return params.get("sonido") ? (
      <SoundView slug={slug} step={step} />
    ) : (
      <StepView guide={guide} slug={slug} step={step} />
    );
  }

  return <Overview guide={guide} slug={slug} />;
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
