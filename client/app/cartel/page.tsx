"use client";

// The sign for reception: one sheet of A4 with the QR big enough to scan from a queue.
//
// It is a page rather than a download because a venue prints it from the browser it already has
// open, and because the same page is what the recorder links to as "descargar cartel".

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { es } from "../../lib/i18n/es.ts";
import { AntesalaMark, CheckIcon, PrinterIcon } from "../icons.tsx";
import { QrCode } from "../qr-code.tsx";
import { ActionBar, Button } from "../ui.tsx";

const t = es.cartel;

function Poster() {
  const slug = useSearchParams().get("slug");
  if (!slug) return <p role="alert">{t.missing}</p>;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/g?slug=${slug}`;

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col print:block print:min-h-0">
      <div className="flex-1">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center text-[#15302b] print:rounded-none print:p-0">
          <span className="inline-flex items-center gap-3 text-2xl font-extrabold">
            <span className="text-[#1f5d50]">
              <AntesalaMark size={40} />
            </span>
            antesala
          </span>

          <h1 className="mt-6 text-5xl leading-tight font-extrabold">{t.title}</h1>
          <p className="mt-3 text-2xl">{t.lead}</p>

          <div className="mt-6 flex justify-center">
            <QrCode text={url} label={t.title} />
          </div>

          <p className="mt-4 text-xl font-bold">{url.replace(/^https?:\/\//, "")}</p>
          <p className="mt-2 text-lg">{t.how}</p>

          <ul className="mt-6 grid gap-2 text-left text-lg">
            {t.what.map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span className="text-[#1f5d50]">
                  <CheckIcon size={22} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ActionBar className="print:hidden">
        <Button full icon={<PrinterIcon size={22} />} onClick={() => window.print()}>
          {t.print}
        </Button>
      </ActionBar>
    </div>
  );
}

export default function PosterPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 print:p-0">
      <Suspense fallback={<p className="text-tinta/70">{es.panel.loading}</p>}>
        <Poster />
      </Suspense>
    </main>
  );
}
