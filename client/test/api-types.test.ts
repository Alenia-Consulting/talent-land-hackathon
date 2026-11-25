import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// lib/api-types.ts is generated from contracts/openapi.json, which the backend exports from its
// own code. If this fails, the API changed under us: regenerate and read the diff before building
// against it.
const REGENERATE = "run `npm run types` from client/ and commit lib/api-types.ts";

function generate(): string {
  return execFileSync("node_modules/.bin/openapi-typescript", ["../contracts/openapi.json"], {
    encoding: "utf8",
  });
}

test("the committed types match the published contract", () => {
  assert.equal(
    readFileSync("lib/api-types.ts", "utf8").trim(),
    generate().trim(),
    `the API contract changed: ${REGENERATE}`,
  );
});

test("the contract still describes the endpoints the app depends on", () => {
  const types = readFileSync("lib/api-types.ts", "utf8");

  for (const path of ["/guides", "/guides/{guide_id}", "/public/{slug}", "/public/guides"]) {
    assert.ok(types.includes(`"${path}"`), `the contract no longer has ${path}: ${REGENERATE}`);
  }
});
