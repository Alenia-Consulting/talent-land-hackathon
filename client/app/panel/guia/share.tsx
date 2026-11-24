"use client";

// Link, copy button and QR code of a published guide. The QR is drawn in the browser (no
// external service), so it works offline and never sends the link anywhere.

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { es } from "../../../lib/i18n/es.ts";
import { Button, Card } from "../../ui.tsx";

const t = es.panel.detail;

export function ShareCard({ slug }: { slug: string }) {
  const path = `/g?slug=${slug}`;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const fullUrl = () => `${window.location.origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setFailed(false);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  };

  return (
    <Card className="mt-4 bg-salvia">
      <p className="font-bold">{t.published}</p>
      <Link href={path} className="text-lg font-bold text-pino underline break-all">
        {path}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={typeof window === "undefined" ? path : fullUrl()}
            size={176}
            title={t.qrTitle}
            level="M"
          />
        </div>
        <div className="grid gap-3">
          <Button variant="secondary" onClick={copy}>
            {copied ? t.copied : t.copy}
          </Button>
          {failed && (
            <p role="alert" className="text-base text-[#9c3a22]">
              {t.copyFailed}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
