"use client";

// Where somebody who was never sent a link finds the place they are going to.
//
// The whole catalogue arrives once and the narrowing happens here, in the browser. With the
// number of guides this product has, showing what exists beats an empty box that asks a person
// to guess the exact name of a place. The rule that narrows lives in lib/pure/search.ts, where
// it is tested; this file only shows what it answers.
//
// Nothing moves on its own here: no animation, and the list changes only when a key is pressed.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, listPublicGuides, type PublicGuide } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { catalogueState, filterCatalogue } from "../../lib/pure/search.ts";
import { ChevronRightIcon, SearchIcon } from "../icons.tsx";
import { Button, Card, TopBar } from "../ui.tsx";

const t = es.buscar;

function reviewedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return es.publica.reviewedAt(
    date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
  );
}

/** The cover, or the shape where it will be. A missing photo is not a broken image. */
function Cover({ guide }: { guide: PublicGuide }) {
  if (!guide.cover_photo_url) {
    return <span aria-hidden="true" className="h-16 w-16 shrink-0 rounded-2xl bg-salvia" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={guide.cover_photo_url}
      alt=""
      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
    />
  );
}

function Place({ guide }: { guide: PublicGuide }) {
  // The venue first and in the larger type: it is what the person came looking for. The route
  // title underneath, because one venue can have several.
  const facts = [
    guide.walking_minutes ? t.walking(guide.walking_minutes) : null,
    reviewedOn(guide.reviewed_at),
  ].filter(Boolean);

  return (
    <li className="min-w-0">
      <Link href={`/g?slug=${encodeURIComponent(guide.public_slug)}`} className="block">
        <Card className="flex items-center gap-4">
          <Cover guide={guide} />
          <span className="min-w-0 flex-1">
            {/* Never truncated: the name of the place is the one thing the person is scanning
                for, and two venues can share the first twenty characters. It wraps instead. */}
            <span className="block text-2xl font-extrabold">{guide.venue_name}</span>
            <span className="mt-1 block text-lg text-tinta/70">{guide.title}</span>
            {facts.length > 0 && (
              <span className="mt-1 block text-base text-tinta/55">{facts.join(" · ")}</span>
            )}
          </span>
          <span className="shrink-0 text-tinta/40">
            <ChevronRightIcon size={24} />
          </span>
        </Card>
      </Link>
    </li>
  );
}

export default function Buscar() {
  const [guides, setGuides] = useState<PublicGuide[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setError(null);
    setGuides(null);
    listPublicGuides()
      .then(setGuides)
      .catch((cause: unknown) => {
        // Only strings this app owns reach the screen. A 5xx carries FastAPI's `detail`, in
        // English, and this screen is read by people for whom that is a wall.
        setError(cause instanceof ApiError && cause.status === 0 ? cause.message : t.errorServer);
      });
  }, []);

  useEffect(load, [load]);

  const matches = useMemo(() => filterCatalogue(guides ?? [], query), [guides, query]);
  const state = catalogueState({ guides, matches, error });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-6">
      <h1 className="text-4xl font-extrabold">{t.title}</h1>
      <p className="mt-2 text-lg text-tinta/70">{t.lead}</p>

      {/* The box stays at the top edge once the page scrolls: what was typed never leaves. */}
      <TopBar>
        <label htmlFor="buscar-sitio" className="block text-base font-bold">
          {t.fieldLabel}
        </label>
        <div className="relative mt-1">
          <span aria-hidden="true" className="absolute top-1/2 left-4 -translate-y-1/2 text-tinta/45">
            <SearchIcon size={22} />
          </span>
          <input
            id="buscar-sitio"
            type="search"
            value={query}
            autoComplete="off"
            placeholder={t.placeholder}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-2xl border-2 border-tinta/15 bg-tarjeta py-3 pr-4 pl-12 text-lg text-tinta placeholder:text-tinta/45 focus:border-pino focus:outline-none"
          />
        </div>
      </TopBar>

      <div className="flex-1 pb-10">
        {state === "loading" && <p className="text-lg text-tinta/70">{t.loading}</p>}

        {state === "error" && (
          <Card>
            <p role="alert" className="text-lg font-bold">
              {t.error}
            </p>
            {error && <p className="mt-1 text-base text-tinta/70">{error}</p>}
            <div className="mt-4">
              <Button onClick={load}>{t.retry}</Button>
            </div>
          </Card>
        )}

        {state === "empty" && (
          <Card>
            <p className="text-lg font-bold">{t.empty}</p>
            <p className="mt-1 text-tinta/70">{t.emptyLead}</p>
          </Card>
        )}

        {/* Not finding anything is never the end of the road: the whole list is one tap away. */}
        {state === "noMatch" && (
          <Card>
            <p className="text-lg font-bold">{t.noMatch}</p>
            <p className="mt-1 text-tinta/70">{t.noMatchLead}</p>
            <div className="mt-4">
              <Button onClick={() => setQuery("")}>{t.showAll}</Button>
            </div>
          </Card>
        )}

        {state === "list" && (
          <>
            <p className="text-base text-tinta/55">{t.count(matches.length)}</p>
            <ul className="mt-2 grid gap-3">
              {matches.map((guide) => (
                <Place key={guide.public_slug} guide={guide} />
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
