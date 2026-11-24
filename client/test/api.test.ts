import assert from "node:assert/strict";
import { test } from "node:test";

import { checkDatabase } from "../lib/api.ts";

const respond =
  (status: number, body: object): typeof fetch =>
  async (url) => {
    assert.equal(url, "/api/health/db");
    return new Response(JSON.stringify(body), { status });
  };

test("database reachable", async () => {
  assert.equal(await checkDatabase(respond(200, { status: "ok", database: "ok" })), "Database: ok");
});

test("database unavailable returns the API detail", async () => {
  const message = await checkDatabase(respond(503, { detail: "database unavailable" }));
  assert.equal(message, "Error 503: database unavailable");
});

test("non-JSON error falls back to the status text", async () => {
  const fetchImpl = async () => new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" });
  assert.equal(await checkDatabase(fetchImpl), "Error 502: Bad Gateway");
});

test("network failure", async () => {
  const fetchImpl = async () => {
    throw new TypeError("fetch failed");
  };
  assert.equal(await checkDatabase(fetchImpl), "API unreachable");
});
