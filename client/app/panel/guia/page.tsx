"use client";

// One guide under review: complete every step, then approve it.
//
// The id travels in the query string because the client is exported statically, so a /panel/[id]
// route could not be pre-rendered for ids that do not exist at build time.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  ApiError,
  type Guide,
  patchStep,
  publishGuide,
  readGuide,
  type StepPatch,
} from "../../../lib/guides.ts";
import { es } from "../../../lib/i18n/es.ts";
import { Button, Card, StatusChip } from "../../ui.tsx";
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
  if (error && !guide)
    return (
      <p role="alert" className="rounded-2xl bg-coral/15 p-4 text-[#9c3a22]">
        {error}
      </p>
    );
  if (!guide) return <p className="text-tinta/70">{es.panel.loading}</p>;

  const pending = guide.pending;
  const ready = pending
    ? pending.missing_data === 0 && pending.steps_reviewed === pending.steps_total
    : false;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-extrabold">{guide.title}</h1>
        <StatusChip status={guide.status} />
      </div>
      <p className="mt-1 text-tinta/70">{guide.venue_name}</p>

      {pending && (
        <p
          className={`mt-4 rounded-2xl p-4 font-bold ${
            ready ? "bg-salvia text-pino" : "bg-ambar/35 text-[#7a4b00]"
          }`}
        >
          {ready ? t.ready : t.pending(pending)}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-coral/15 p-4 text-[#9c3a22]">
          {error}
        </p>
      )}

      {guide.status === "published" && guide.public_slug && (
        <Card className="mt-4 bg-salvia">
          <p className="font-bold">{t.published}</p>
          <Link href={`/g?slug=${guide.public_slug}`} className="text-lg font-bold text-pino underline">
            /g?slug={guide.public_slug}
          </Link>
        </Card>
      )}

      <ol className="mt-6 grid gap-4">
        {guide.steps.map((step) => (
          <StepForm
            key={step.id}
            step={step}
            saving={busy}
            onSave={(changes) => save(step.id, changes)}
          />
        ))}
      </ol>

      {guide.status !== "published" && (
        <p className="mt-6">
          <Button disabled={busy || !ready} onClick={publish}>
            {busy ? t.publishing : t.publish}
          </Button>
        </p>
      )}
    </>
  );
}

export default function GuideDetailPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mb-6">
        <Link href="/panel" className="font-bold text-pino underline">
          {t.back}
        </Link>
      </p>
      <Suspense fallback={<p className="text-tinta/70">{es.panel.loading}</p>}>
        <GuideDetail />
      </Suspense>
    </main>
  );
}
