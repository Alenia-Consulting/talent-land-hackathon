// Checks the static export produced by `npm run build` (the files nginx serves). Run after the build.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const indexHtml = new URL("../out/index.html", import.meta.url);

test("home page shows the application name", async () => {
  const html = await readFile(indexHtml, "utf8");
  assert.match(html, /<title>Antesala<\/title>/);
  assert.match(html, /<h1>Antesala<\/h1>/);
});
