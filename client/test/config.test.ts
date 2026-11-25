import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { apiUrl, RECORDING, type RuntimeEnv } from "../lib/config.ts";

// Node has no `window`: the tests set a minimal one, as the browser does after loading /env.js.
const global = globalThis as { window?: { __ENV__?: RuntimeEnv } };

afterEach(() => {
  delete global.window;
  delete process.env.NEXT_PUBLIC_API_URL;
});

test("defaults to /api, proxied by nginx", () => {
  assert.equal(apiUrl(), "/api");
});

test("uses the runtime value written to /env.js by the container", () => {
  global.window = { __ENV__: { NEXT_PUBLIC_API_URL: "https://api.example.com/api/" } };
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
  assert.equal(apiUrl(), "https://api.example.com/api");
});

test("falls back to the build/dev value when the runtime one is missing", () => {
  global.window = { __ENV__: {} };
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
  assert.equal(apiUrl(), "http://localhost:8000/api");
});

test("una parte dura como mucho 45 segundos", () => {
  // Con una toma por parte, el límite de antes se multiplicaba por el número de partes: ocho
  // partes habrían permitido dieciséis minutos de vídeo y una llamada a Gemini por toma.
  assert.equal(RECORDING.maxDurationSec, 45);
});
