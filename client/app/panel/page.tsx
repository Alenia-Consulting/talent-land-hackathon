"use client";

// The review panel: every guide the venue has, drafts included.
//
// The design shows four figures across the top. Two of them this product counts; visits and how
// many listened to the place are sample data in the mock and nothing measures them yet. They
// keep their cards and show no number, because a panel that invents its own statistics is the
// same lie as an AI that invents what a room looks like.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError, type GuideSummary, listGuides } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { AntesalaMark, ChevronRightIcon, SearchIcon, VideoIcon } from "../icons.tsx";
import { Card, StatusChip } from "../ui.tsx";

const t = es.panel;

type Filter = "all" | "published" | "pending";

function reviewedLabel(iso: string | null | undefined): string {
  if (!iso) return t.never;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? t.never
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** A guide still waiting on a person: anything that is not published. */
const isPending = (guide: GuideSummary) => guide.status !== "published";

/** Stands in for the cover while the media pipeline is not producing one. */
function Thumbnail({ guide }: { guide: GuideSummary }) {
  const url = (guide as GuideSummary & { cover_photo_url?: string | null }).cover_photo_url;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />;
  }
  return <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-2xl bg-salvia" />;
}

/**
 * One figure of the row across the top. Without a value it says so rather than showing a zero:
 * nothing measured and nothing happening look the same in a number and are not the same thing.
 */
function Stat({
  label,
  value,
  attention,
}: {
  label: string;
  value?: string;
  attention?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 ${attention ? "bg-ambar/35 text-sobre-ambar" : "bg-tarjeta"}`}
    >
      <p className={`text-base ${attention ? "" : "text-tinta/70"}`}>{label}</p>
      {value ? (
        <p className="mt-1 text-4xl font-extrabold">{value}</p>
      ) : (
        <p className="mt-1 text-xl text-tinta/40">{t.stats.notMeasured}</p>
      )}
    </div>
  );
}

function Toolbar({
  query,
  onQuery,
  filter,
  onFilter,
  counts,
}: {
  query: string;
  onQuery: (next: string) => void;
  filter: Filter;
  onFilter: (next: Filter) => void;
  counts: Record<Filter, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-h-14 flex-1 basis-64 items-center gap-3 rounded-[18px] bg-niebla px-4">
        <span className="text-tinta/50">
          <SearchIcon size={22} />
        </span>
        <span className="sr-only">{t.search}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t.search}
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-tinta/50"
        />
      </label>
      <div role="group" aria-label={t.filters.all} className="flex gap-2">
        {(["all", "published", "pending"] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            onClick={() => onFilter(name)}
            className={`min-h-14 rounded-[18px] px-5 text-base font-bold ${
              filter === name ? "bg-pino text-sobre-pino" : "bg-niebla text-tinta"
            }`}
          >
            {t.filters[name]} {counts[name]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PanelPage() {
  const [guides, setGuides] = useState<GuideSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    listGuides()
      .then(setGuides)
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? cause.message : String(cause));
      });
  }, []);

  const counts = useMemo(
    () => ({
      all: guides?.length ?? 0,
      published: guides?.filter((guide) => !isPending(guide)).length ?? 0,
      pending: guides?.filter(isPending).length ?? 0,
    }),
    [guides],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (guides ?? []).filter((guide) => {
      if (filter === "published" && isPending(guide)) return false;
      if (filter === "pending" && !isPending(guide)) return false;
      if (!needle) return true;
      return `${guide.title} ${guide.venue_name}`.toLowerCase().includes(needle);
    });
  }, [guides, query, filter]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-8 flex items-center gap-3 border-b border-tinta/10 pb-5">
        <span className="text-pino">
          <AntesalaMark size={36} />
        </span>
        <span className="text-xl font-extrabold">antesala</span>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">{t.title}</h1>
          <p className="mt-1 text-tinta/70">{t.lead}</p>
        </div>
        <Link
          href="/grabar"
          className="inline-flex min-h-14 items-center gap-3 rounded-[18px] bg-pino px-6 text-lg font-bold text-sobre-pino"
        >
          <VideoIcon size={22} />
          {t.newGuide}
        </Link>
      </div>

      {guides && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={t.stats.published} value={String(counts.published)} />
          <Stat label={t.stats.visits} />
          <Stat label={t.stats.listened} />
          <Stat
            label={t.needsAttention}
            value={String(counts.pending)}
            attention={counts.pending > 0}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-coral/15 p-4 text-sobre-coral">
          {error}
        </p>
      )}
      {!guides && !error && <p className="mt-6 text-tinta/70">{t.loading}</p>}

      {guides && guides.length === 0 && (
        <Card className="mt-6">
          <p className="text-tinta/70">{t.empty}</p>
        </Card>
      )}

      {guides && guides.length > 0 && (
        <Card className="mt-6 p-4">
          <Toolbar
            query={query}
            onQuery={setQuery}
            filter={filter}
            onFilter={setFilter}
            counts={counts}
          />

          {shown.length === 0 ? (
            <p className="px-1 py-6 text-tinta/70">{t.searchEmpty}</p>
          ) : (
            <ul className="mt-2">
              {shown.map((guide, index) => (
                <li
                  key={guide.id}
                  className={`min-w-0 ${index > 0 ? "border-t border-tinta/10" : ""}`}
                >
                  {/* Two lines, whatever the width: wrapping turned one guide into four rows on
                      a phone, and a list you cannot run your eye down is not a list. */}
                  <Link
                    href={`/panel/guia?id=${guide.id}`}
                    className="flex items-center gap-4 px-1 py-4"
                  >
                    <Thumbnail guide={guide} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xl font-bold">{guide.title}</span>
                      {/* The state sits under the title rather than beside it: on the right it
                          was a fixed column that left the titles a dozen characters wide. */}
                      <span className="flex min-w-0 items-center gap-2">
                        <StatusChip status={guide.status} />
                        <span className="truncate text-base text-tinta/60">
                          {guide.venue_name} · {t.lastReview}: {reviewedLabel(guide.reviewed_at)}
                        </span>
                      </span>
                    </span>
                    <span className="hidden font-bold text-pino underline sm:inline">
                      {isPending(guide) ? t.review : t.edit}
                    </span>
                    <span aria-hidden="true" className="text-pino">
                      <ChevronRightIcon size={22} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </main>
  );
}
