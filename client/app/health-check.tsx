"use client";

import { useState } from "react";

import { checkDatabase } from "../lib/api.ts";

export default function HealthCheck() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setMessage(await checkDatabase());
    setLoading(false);
  }

  return (
    <div className="health">
      <button type="button" onClick={onClick} disabled={loading}>
        {loading ? "Checking..." : "Check database"}
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
