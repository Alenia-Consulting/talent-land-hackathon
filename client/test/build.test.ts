// Checks the static export produced by `npm run build` (the files nginx serves). Run after the build.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const indexHtml = new URL("../out/index.html", import.meta.url);

test("home page shows the application name", async () => {
  const html = await readFile(indexHtml, "utf8");
  assert.match(html, /<title>Antesala<\/title>/);
  // The name is the wordmark beside the mark, not the heading. The heading is what the product
  // does: somebody who lands on the door has never heard the name, and the promise is what tells
  // them whether to stay.
  assert.match(html, />antesala<\/span>/);
  assert.match(html, /<h1[^>]*>Que ninguna visita sea la primera\.<\/h1>/);
});
