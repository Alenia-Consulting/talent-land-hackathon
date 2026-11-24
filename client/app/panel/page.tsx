"use client";

// The review panel: every guide the venue has, drafts included. Not styled yet.

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, type GuideSummary, listGuides } from "../../lib/guides.ts";
import { es } from "../../lib/i18n/es.ts";

function statusLabel(status: string): string {
  return es.panel.statuses[status as keyof typeof es.panel.statuses] ?? status;
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
    <main>
      <h1>{es.panel.title}</h1>
      <p>
        <Link href="/grabar">{es.panel.record}</Link>
      </p>

      {error && <p role="alert">{error}</p>}
      {!guides && !error && <p>{es.panel.loading}</p>}
      {guides?.length === 0 && <p>{es.panel.empty}</p>}

      {guides && guides.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{es.partes.guideTitle}</th>
              <th scope="col">{es.panel.venue}</th>
              <th scope="col">{es.panel.status}</th>
              <th scope="col"> </th>
            </tr>
          </thead>
          <tbody>
            {guides.map((guide) => (
              <tr key={guide.id}>
                <td>{guide.title}</td>
                <td>{guide.venue_name}</td>
                <td>{statusLabel(guide.status)}</td>
                <td>
                  <Link href={`/panel/guia?id=${guide.id}`}>{es.panel.open}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
