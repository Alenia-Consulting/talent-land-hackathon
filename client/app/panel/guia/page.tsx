"use client";

// One guide under review: complete every step, then approve it. Not styled yet.
//
// The id travels in the query string because the client is exported statically, so a /panel/[id]
// route could not be pre-rendered for ids that do not exist at build time.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { ApiError, type Guide, patchStep, publishGuide, readGuide, type StepPatch } from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";
import { StepForm } from "./step-form.tsx";

const t = es.panel.detail;

function GuideDetail() {
  const id = useSearchParams().get("id");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError ? cause.message : String(cause));
  }, []);

  useEffect(() => {
    if (!id) return;
    readGuide(id).then(setGuide).catch(fail);
  }, [id, fail]);

  const save = (stepId: string, changes: StepPatch) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    patchStep(id, stepId, changes)
      .then(setGuide)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const publish = () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    publishGuide(id)
      .then(setGuide)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  if (!id) return <p role="alert">{es.publica.missingSlug}</p>;
  if (error && !guide) return <p role="alert">{error}</p>;
  if (!guide) return <p>{es.panel.loading}</p>;

  const pending = guide.pending;
  const ready = pending ? pending.missing_data === 0 && pending.steps_reviewed === pending.steps_total : false;

  return (
    <>
      <h1>{guide.title}</h1>
      <p>{guide.venue_name}</p>
      {pending && <p>{ready ? t.ready : t.pending(pending)}</p>}
      {error && <p role="alert">{error}</p>}

      {guide.status === "published" && guide.public_slug && (
        <p>
          {t.published}{" "}
          <Link href={`/g?slug=${guide.public_slug}`}>/g?slug={guide.public_slug}</Link>
        </p>
      )}

      <ol>
        {guide.steps.map((step) => (
          <StepForm key={step.id} step={step} saving={busy} onSave={(changes) => save(step.id, changes)} />
        ))}
      </ol>

      {guide.status !== "published" && (
        <p>
          <button type="button" disabled={busy || !ready} onClick={publish}>
            {busy ? t.publishing : t.publish}
          </button>
        </p>
      )}
    </>
  );
}

export default function GuideDetailPage() {
  return (
    <main>
      <p>
        <Link href="/panel">{t.back}</Link>
      </p>
      <Suspense fallback={<p>{es.panel.loading}</p>}>
        <GuideDetail />
      </Suspense>
    </main>
  );
}
