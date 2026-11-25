"use client";

// One guide under review: complete every step, then approve it.
//
// The id travels in the query string because the client is exported statically, so a /panel/[id]
// route could not be pre-rendered for ids that do not exist at build time.
//
// The screen is three fixed parts: where you are (top), what is left to do (middle) and the one
// thing to press next (bottom). The top and the bottom stay put while the middle scrolls, so
// approving a guide never means scrolling to the end to finish the last step and then back to
// the top to find the button. The bar at the bottom always carries exactly one action, and which
// one it is depends on the state of the review: go to what is missing, publish, or share.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { es } from "../../../lib/i18n/es.ts";
import { draftOf, missingInDraft, reviewStateOf } from "../../../lib/pure/draft.ts";
import { ProgressSegments } from "../../controls.tsx";
import { AlertIcon, CheckIcon, ChevronLeftIcon, QrIcon } from "../../icons.tsx";
import { ActionBar, Button, Card, StatusChip, TopBar } from "../../ui.tsx";
import { ShareSheet } from "./share.tsx";
import { anchorOf, focusBlank, SaveStatus, StepForm } from "./step-form.tsx";
import { useReview } from "./useReview.ts";

const t = es.panel.detail;

/** The date of the last human review, in the short form the design writes it. */
function reviewedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** What this panel promises about the media, said next to the button that publishes it. */
function Guarantees({ hasMedia }: { hasMedia: boolean }) {
  return (
    <Card className="mt-4 bg-salvia">
      {/* Only claimed when there is media to have blurred. Saying "faces blurred" about a guide
          with no clips would be the panel vouching for work nobody did. */}
      {hasMedia && (
        <ul className="mb-3 grid gap-2">
          {[t.blurred, t.filtered].map((line) => (
            <li key={line} className="flex items-center gap-3 text-pino">
              <CheckIcon size={22} />
              <span className="text-tinta">{line}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-base text-pino">{t.nothingWithoutYou}</p>
    </Card>
  );
}

function GuideDetail() {
  const id = useSearchParams().get("id");
  const review = useReview(id);
  const { guide, drafts, states, error } = review;

  // Which step is open. One at a time: a review is a list of things already done plus the one
  // being done, and showing eight open forms is what made this screen a scroll.
  const [open, setOpen] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const started = useRef(false);
  const wantsToShare = useRef(false);

  const goTo = useCallback((stepId: string) => {
    setOpen(stepId);
    // After the step has been laid out open, or there is nothing to scroll to yet.
    requestAnimationFrame(() => {
      document.getElementById(anchorOf(stepId))?.scrollIntoView({ block: "start" });
    });
  }, []);

  const state = guide ? reviewStateOf(guide.steps, drafts) : null;

  // Opens on the first thing left to do, which is where the person was going anyway.
  useEffect(() => {
    if (!guide || started.current) return;
    started.current = true;
    setOpen(reviewStateOf(guide.steps, {}).next?.id ?? null);
  }, [guide]);

  // The link and the QR are what the venue came for: asking them to find a button after
  // approving is a step with no purpose.
  useEffect(() => {
    if (wantsToShare.current && guide?.status === "published" && guide.public_slug) {
      wantsToShare.current = false;
      setSharing(true);
    }
  }, [guide?.status, guide?.public_slug]);

  if (!id) return <p role="alert">{es.publica.missingSlug}</p>;
  if (error && !guide)
    return (
      <p role="alert" className="rounded-2xl bg-coral/15 p-4 text-sobre-coral">
        {error}
      </p>
    );
  if (!guide || !state) return <p className="py-8 text-tinta/70">{es.panel.loading}</p>;

  const published = guide.status === "published";
  const reviewedDate = reviewedOn(guide.reviewed_at);
  const next = state.next;

  // The step being worked on, and what it still needs. The bar at the bottom carries its action,
  // so finishing a step never means scrolling to the end of its form to find a button.
  const openStep = guide.steps.find((step) => step.id === open) ?? null;
  const openMissing = openStep
    ? missingInDraft(openStep, drafts[openStep.id] ?? draftOf(openStep))
    : [];
  const openPending =
    openStep && !(openStep.reviewed && openMissing.length === 0) ? openStep : null;

  /** Marking a step read opens the next one that still needs somebody. */
  const markReviewed = (stepId: string) => {
    review.markReviewed(stepId, true);
    // The answer has not come back yet, so this step is excluded by hand rather than read.
    const following = guide.steps.find((step) => {
      const draft = drafts[step.id] ?? draftOf(step);
      return step.id !== stepId && !(step.reviewed && missingInDraft(step, draft).length === 0);
    });
    if (following) goTo(following.id);
    else setOpen(null);
  };

  /** What the bar says above its button: where the review is, in one line. */
  const note = (): string => {
    if (published) return reviewedDate ? t.publishedOn(reviewedDate) : t.publishedNoDate;
    if (state.ready) return t.ready;
    const unreviewed = state.total - state.reviewed;
    return [
      unreviewed > 0 ? t.stepsLeft(unreviewed) : null,
      state.missing > 0 ? t.blanksLeft(state.missing) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <>
      <TopBar>
        <div className="flex items-center gap-3">
          <Link
            href="/panel"
            aria-label={t.back}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-tarjeta text-tinta"
          >
            <ChevronLeftIcon size={24} />
          </Link>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-extrabold">{guide.title}</span>
            <span className="block truncate text-base text-tinta/60">{guide.venue_name}</span>
          </span>
          <StatusChip status={guide.status} />
        </div>
        <div className="mt-3">
          <ProgressSegments total={state.total} current={state.reviewed} />
          <p className="mt-2 text-base text-tinta/60">
            {/* "Ya se puede publicar" is an invitation, so it stops once it has been accepted. */}
            {state.ready && !published
              ? t.ready
              : t.reviewedCount(state.reviewed, state.total)}
          </p>
        </div>
      </TopBar>

      <div className="flex-1">
        {/* Why the draft has holes, said before the person starts filling them in. */}
        {state.missing > 0 && (
          <p className="mb-4 flex items-start gap-3 rounded-2xl bg-ambar/35 px-4 py-3 text-base text-sobre-ambar">
            <AlertIcon size={22} />
            <span>{t.blanks(state.missing)}</span>
          </p>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-coral/15 p-4 text-sobre-coral">
            {error}
          </p>
        )}

        <ol className="grid gap-3">
          {guide.steps.map((step) => (
            <StepForm
              key={step.id}
              step={step}
              draft={drafts[step.id] ?? draftOf(step)}
              open={open === step.id}
              onOpen={() => goTo(step.id)}
              onEdit={(patch) => review.edit(step.id, patch)}
              onSave={() => review.save(step.id)}
            />
          ))}
        </ol>

        <Guarantees hasMedia={guide.steps.some((step) => step.clip_url)} />
      </div>

      <ActionBar
        note={
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{note()}</span>
            {openStep && (
              <SaveStatus
                state={states[openStep.id] ?? "clean"}
                onRetry={() => review.save(openStep.id)}
              />
            )}
          </span>
        }
      >
        {published ? (
          <Button icon={<QrIcon size={22} />} onClick={() => setSharing(true)}>
            {es.compartir.open}
          </Button>
        ) : state.ready ? (
          <Button
            disabled={review.publishing}
            onClick={() => {
              wantsToShare.current = true;
              review.publish();
            }}
          >
            {review.publishing ? t.publishing : t.publish}
          </Button>
        ) : openPending ? (
          <Button
            onClick={() =>
              openMissing.length > 0
                ? focusBlank(openPending.id, openMissing[0])
                : markReviewed(openPending.id)
            }
          >
            {openMissing.length > 0 ? t.completeFirst : t.markReviewed}
          </Button>
        ) : (
          next && <Button onClick={() => goTo(next.id)}>{t.goToStep(next.order)}</Button>
        )}
      </ActionBar>

      {guide.public_slug && (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          venue={guide.venue_name}
          slug={guide.public_slug}
          reviewed={reviewedDate}
        />
      )}
    </>
  );
}

export default function GuideDetailPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
      <Suspense fallback={<p className="py-8 text-tinta/70">{es.panel.loading}</p>}>
        <GuideDetail />
      </Suspense>
    </main>
  );
}
