import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addRoute,
  ApiError,
  createGuide,
  deleteGuide,
  listGuides,
  patchStep,
  publishGuide,
  readGuide,
  readPublicGuide,
} from "../lib/guides.ts";

type Call = { url: string; method: string; body: unknown };

/** A fetch that records the call and answers with the given status and body. */
function spy(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}

const MARKS = [
  { title: "Entrada", category: "entrance" as const, marked_at_seconds: 0 },
  { title: "Recepción", category: "reception" as const, marked_at_seconds: 15 },
];

test("createGuide posts the marks to /guides", async () => {
  const { calls, fetchImpl } = spy(201, { id: "abc", status: "draft", steps: [] });

  const guide = await createGuide(
    { title: "Recorrido principal", venue_name: "Centro Oeste", video_duration_seconds: 60, marks: MARKS },
    fetchImpl,
  );

  assert.equal(calls[0].url, "/api/guides");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, {
    language: "es",
    title: "Recorrido principal",
    venue_name: "Centro Oeste",
    video_duration_seconds: 60,
    marks: MARKS,
  });
  assert.equal(guide.id, "abc");
});

test("createGuide defaults the language but lets it be set", async () => {
  const { calls, fetchImpl } = spy(201, { id: "abc", steps: [] });

  await createGuide(
    { title: "T", venue_name: "V", video_duration_seconds: 60, marks: MARKS, language: "en" },
    fetchImpl,
  );

  assert.equal((calls[0].body as { language: string }).language, "en");
});

test("a business rule rejection carries the API message", async () => {
  const { fetchImpl } = spy(422, { detail: "marks must move forward in time" });

  const error = await createGuide(
    { title: "Mal", venue_name: "X", video_duration_seconds: 30, marks: MARKS },
    fetchImpl,
  ).catch((e: unknown) => e);

  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 422);
  assert.equal(error.message, "marks must move forward in time");
});

test("a validation rejection names the field that is wrong", async () => {
  // Pydantic answers with a list, not a string: the UI needs the field, not just the message.
  const { fetchImpl } = spy(422, {
    detail: [
      {
        type: "literal_error",
        loc: ["body", "marks", 0, "category"],
        msg: "Input should be 'entrance', 'reception' or 'exit'",
      },
    ],
  });

  const error = await createGuide(
    { title: "Mal", venue_name: "X", video_duration_seconds: 30, marks: MARKS },
    fetchImpl,
  ).catch((e: unknown) => e);

  assert.ok(error instanceof ApiError);
  assert.match(error.message, /marks\.0\.category/);
  assert.match(error.message, /Input should be/);
});

test("publishing an incomplete guide reports the conflict", async () => {
  const { fetchImpl } = spy(409, { detail: "the guide is not ready to publish" });

  const error = await publishGuide("abc", fetchImpl).catch((e: unknown) => e);

  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 409);
  assert.equal(error.message, "the guide is not ready to publish");
});

test("a guide that does not exist reports 404", async () => {
  const { fetchImpl } = spy(404, { detail: "guide not found" });

  const error = await readGuide("nope", fetchImpl).catch((e: unknown) => e);

  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 404);
});

test("an unreachable API does not leak a fetch error to the UI", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError("fetch failed");
  };

  const error = await listGuides({}, fetchImpl).catch((e: unknown) => e);

  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 0);
  assert.match(error.message, /conexión/i);
});

test("listGuides paginates", async () => {
  const { calls, fetchImpl } = spy(200, []);

  await listGuides({ limit: 5, offset: 10 }, fetchImpl);

  assert.equal(calls[0].url, "/api/guides?limit=5&offset=10");
});

test("patchStep sends only the fields given", async () => {
  const { calls, fetchImpl } = spy(200, { id: "abc", steps: [] });

  await patchStep("abc", "s1", { reviewed: true }, fetchImpl);

  assert.equal(calls[0].url, "/api/guides/abc/steps/s1");
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body, { reviewed: true });
});

test("readPublicGuide asks the public endpoint", async () => {
  const { calls, fetchImpl } = spy(200, { id: "abc", steps: [] });

  await readPublicGuide("centro-oeste", fetchImpl);

  assert.equal(calls[0].url, "/api/public/centro-oeste");
  assert.equal(calls[0].method, "GET");
});

test("addRoute posts the marks to the guide's routes", async () => {
  const { calls, fetchImpl } = spy(201, { id: "abc", routes: [], steps: [] });

  await addRoute(
    "abc",
    { title: "Rayos X", video_duration_seconds: 30, marks: MARKS },
    fetchImpl,
  );

  assert.equal(calls[0].method, "POST");
  assert.ok(calls[0].url.endsWith("/guides/abc/routes"));
  assert.equal((calls[0].body as { title: string }).title, "Rayos X");
});

test("deleteGuide sends DELETE and accepts an empty answer", async () => {
  const calls: { url: string; method: string }[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return new Response(null, { status: 204 });
  };

  await deleteGuide("abc", fetchImpl);

  assert.equal(calls[0].method, "DELETE");
  assert.ok(calls[0].url.endsWith("/guides/abc"));
});

test("deleteGuide reports why storage refused", async () => {
  const { fetchImpl } = spy(502, { detail: "storage refused the deletion: HTTP 500" });

  await assert.rejects(deleteGuide("abc", fetchImpl), (error: unknown) => {
    return error instanceof ApiError && error.status === 502 && /storage/.test(error.message);
  });
});
