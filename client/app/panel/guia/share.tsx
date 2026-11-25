"use client";

// What the venue sees once the guide is published: the ways to put it in front of a visitor.
//
// The QR is the point. The link works too, but a sign at reception reaches the person who did
// not get the SMS, and a guide nobody opens before arriving has helped nobody.

import { useState } from "react";

import { es } from "../../../lib/i18n/es.ts";
import { Sheet } from "../../controls.tsx";
import { AntesalaMark, MessageIcon, PrinterIcon } from "../../icons.tsx";
import { QrCode } from "../../qr-code.tsx";
import { Button, Card, StatusChip } from "../../ui.tsx";

const t = es.compartir;

/** Copying can be refused (no permission, no clipboard); the caller shows nothing rather than lie. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function ActionCard({
  icon,
  label,
  done,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-28 flex-1 basis-40 flex-col items-center justify-center gap-2 rounded-3xl bg-tarjeta px-4 py-5 text-center text-lg font-bold"
    >
      <span className="text-pino">{icon}</span>
      {done ? <span className="text-pino">{t.smsCopied}</span> : label}
    </button>
  );
}

export function ShareSheet({
  open,
  onClose,
  venue,
  slug,
  reviewed,
}: {
  open: boolean;
  onClose: () => void;
  venue: string;
  slug: string;
  reviewed: string | null;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);

  // Built from the address bar so the QR carries the host the visitor will really reach, not a
  // placeholder that works on one laptop.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/g?slug=${slug}`;
  const shown = url.replace(/^https?:\/\//, "");

  return (
    <Sheet open={open} onClose={onClose} title={t.title}>
      <p className="mb-3">
        <StatusChip status="published" />
      </p>
      <h2 className="text-3xl font-extrabold">{t.title}</h2>
      <p className="mt-1 text-tinta/70">{t.lead}</p>

      <Card className="mt-5 flex flex-col items-center">
        <QrCode text={url} label={t.qrLabel(venue)} />
        <span className="mt-4 flex w-full items-center gap-3 rounded-[18px] bg-niebla p-2 pl-4">
          <span className="min-w-0 flex-1 truncate font-bold">{shown}</span>
          <Button
            onClick={() => {
              void copy(url).then(setCopiedLink);
            }}
          >
            {copiedLink ? t.copied : t.copy}
          </Button>
        </span>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3">
        <ActionCard
          icon={<MessageIcon size={28} />}
          label={t.sms}
          done={copiedSms}
          onClick={() => {
            void copy(t.smsText(venue, url)).then(setCopiedSms);
          }}
        />
        <a
          href={`/cartel?slug=${slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-28 flex-1 basis-40 flex-col items-center justify-center gap-2 rounded-3xl bg-tarjeta px-4 py-5 text-center text-lg font-bold"
        >
          <span className="text-pino">
            <PrinterIcon size={28} />
          </span>
          {t.poster}
        </a>
      </div>

      {/* The sign as it will look, so nobody prints it to find out. */}
      <div className="mt-6 flex items-center gap-4 rounded-3xl bg-pino p-5 text-sobre-pino">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-pino">
          <AntesalaMark size={40} />
        </span>
        <span>
          <span className="block text-xl font-extrabold">{t.signTitle}</span>
          <span className="mt-1 block text-base opacity-85">
            {reviewed ? t.signReviewed(reviewed) : t.signNeverReviewed}
          </span>
        </span>
      </div>

      <div className="mt-6">
        <Button full variant="secondary" onClick={onClose}>
          {t.close}
        </Button>
      </div>
    </Sheet>
  );
}
