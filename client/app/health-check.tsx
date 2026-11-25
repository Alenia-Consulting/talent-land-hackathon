"use client";

// The team's own smoke test for /api/health/db, not a feature of the product.
//
// Deliberately the quietest thing on its page: small type, no card, no colour. The answer comes
// back from the API in English on purpose — it is a diagnostic read by whoever maintains this,
// and translating a status line would only make it harder to match against the logs.

import { useState } from "react";

import { checkDatabase } from "../lib/api.ts";
import { es } from "../lib/i18n/es.ts";

const t = es.centro;

export default function HealthCheck() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setMessage(await checkDatabase());
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-full border border-tinta/15 px-4 py-2 text-base text-tinta/60 disabled:opacity-45"
      >
        {loading ? t.checking : t.check}
      </button>
      {message ? (
        <small role="status" className="text-base text-tinta/60">
          {message}
        </small>
      ) : (
        <small className="text-base text-tinta/45">{t.checkNote}</small>
      )}
    </div>
  );
}
