"use client";

// The review panel: every guide the venue has, drafts included.

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, type GuideSummary, listGuides } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";
import { Card, StatusChip } from "../ui.tsx";

function reviewedLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function PanelPage() {
  const [guides, setGuides] = useState<GuideSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGuides()
      .then(setGuides)
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? cause.message : String(cause));
      });
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">{es.panel.title}</h1>
          <p className="mt-1 text-tinta/70">{es.panel.lead}</p>
        </div>
        <Link
          href="/grabar"
          className="flex min-h-14 items-center rounded-[18px] bg-pino px-6 text-lg font-bold text-white"
        >
          {es.panel.record}
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-coral/15 p-4 text-[#9c3a22]">
          {error}
        </p>
      )}
      {!guides && !error && <p className="mt-6 text-tinta/70">{es.panel.loading}</p>}

      {guides?.length === 0 && (
        <Card className="mt-6">
          <p className="text-tinta/70">{es.panel.empty}</p>
        </Card>
      )}

      {guides && guides.length > 0 && (
        <Card className="mt-6 p-0">
          <ul>
            {guides.map((guide, index) => (
              <li
                key={guide.id}
                className={index > 0 ? "border-t border-tinta/10" : undefined}
              >
                <Link
                  href={`/panel/guia?id=${guide.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-5"
                >
                  <span>
                    <span className="block text-xl font-bold">{guide.title}</span>
                    <span className="block text-base text-tinta/60">
                      {guide.venue_name} · {reviewedLabel(guide.reviewed_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <StatusChip status={guide.status} />
                    <span className="font-bold text-pino underline">{es.panel.open}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
