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
import { countMissing } from "../../../lib/pure/review.ts";
import { AlertIcon, CheckIcon } from "../../icons.tsx";
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
      <p role="alert" className="rounded-2xl bg-coral/15 p-4 text-sobre-coral">
        {error}
      </p>
    );
  if (!guide) return <p className="text-tinta/70">{es.panel.loading}</p>;

  const pending = guide.pending;
  // Counted here rather than taken from pending.missing_data, which counts STEPS that have
  // something missing. The banner names fields, so it has to count fields.
  const missingCount = countMissing(guide.steps);
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

      {/* Why the draft has holes, said before the person starts filling them in. */}
      {missingCount > 0 && (
        <p className="mt-4 flex items-start gap-3 rounded-2xl bg-ambar/35 p-4 text-sobre-ambar">
          <AlertIcon size={26} />
          <span>{t.blanks(missingCount)}</span>
        </p>
      )}

      {pending && (
        <Card className="mt-4">
          <h2 className="text-2xl font-extrabold">{t.beforePublish}</h2>
          <span
            className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-salvia"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={pending.steps_total}
            aria-valuenow={pending.steps_reviewed}
          >
            <span
              className="block h-full rounded-full bg-pino"
              style={{
                width: `${pending.steps_total > 0 ? (pending.steps_reviewed / pending.steps_total) * 100 : 0}%`,
              }}
            />
          </span>
          <p className="mt-2 text-tinta/70">
            {ready ? t.ready : t.reviewedCount(pending.steps_reviewed, pending.steps_total)}
          </p>

          <ul className="mt-4 grid gap-2">
            {/* Only claimed when there is media to have blurred. Saying "faces blurred" about a
                guide with no clips would be the panel vouching for work nobody did. */}
            {guide.steps.some((step) => step.clip_url) && (
              <>
                <li className="flex items-center gap-3 text-pino">
                  <CheckIcon size={22} />
                  <span className="text-tinta">{t.blurred}</span>
                </li>
                <li className="flex items-center gap-3 text-pino">
                  <CheckIcon size={22} />
                  <span className="text-tinta">{t.filtered}</span>
                </li>
              </>
            )}
            {missingCount > 0 && (
              <li className="flex items-center gap-3 text-sobre-ambar">
                <AlertIcon size={22} />
                <span className="text-tinta">{t.toComplete(missingCount)}</span>
              </li>
            )}
          </ul>

          {guide.status !== "published" && (
            <p className="mt-5">
              <Button disabled={busy || !ready} onClick={publish}>
                {busy ? t.publishing : t.publish}
              </Button>
            </p>
          )}
          <p className="mt-4 rounded-2xl bg-salvia p-4 text-base text-pino">
            {t.nothingWithoutYou}
          </p>
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-coral/15 p-4 text-sobre-coral">
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
