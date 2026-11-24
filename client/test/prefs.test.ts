import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_PREFS,
  type Prefs,
  readPrefs,
  STORAGE_KEY,
  TEXT_SCALE,
  writePrefs,
} from "../lib/pure/prefs.ts";

/** A localStorage stand-in, because these functions must survive a browser that has none. */
function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    dump: () => Object.fromEntries(data),
  };
}

test("the defaults are the calm ones: light, medium text, nothing speaking on its own", () => {
  assert.equal(DEFAULT_PREFS.theme, "claro");
  assert.equal(DEFAULT_PREFS.textSize, "m");
  // Reading aloud starts off: the design turns it on from the guide, never behind the person's back.
  assert.equal(DEFAULT_PREFS.readAloud, false);
});

test("nothing stored yields the defaults instead of throwing", () => {
  assert.deepEqual(readPrefs(fakeStorage()), DEFAULT_PREFS);
});

test("a stored preference comes back", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ theme: "tenue", textSize: "l" }) });

  const prefs = readPrefs(storage);

  assert.equal(prefs.theme, "tenue");
  assert.equal(prefs.textSize, "l");
});

test("a half-written preference keeps the defaults for the rest", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ theme: "tenue" }) });

  assert.equal(readPrefs(storage).readAloud, DEFAULT_PREFS.readAloud);
});

test("rubbish in storage never breaks the guide", () => {
  assert.deepEqual(readPrefs(fakeStorage({ [STORAGE_KEY]: "{{{" })), DEFAULT_PREFS);
  assert.deepEqual(readPrefs(fakeStorage({ [STORAGE_KEY]: "null" })), DEFAULT_PREFS);
  assert.deepEqual(readPrefs(fakeStorage({ [STORAGE_KEY]: '"texto"' })), DEFAULT_PREFS);
});

test("a value outside the allowed set falls back instead of reaching the CSS", () => {
  const storage = fakeStorage({
    [STORAGE_KEY]: JSON.stringify({ theme: "neon", textSize: "enorme" }),
  });

  const prefs = readPrefs(storage);

  assert.equal(prefs.theme, DEFAULT_PREFS.theme);
  assert.equal(prefs.textSize, DEFAULT_PREFS.textSize);
});

test("a storage that throws is survivable: private browsing must not blank the guide", () => {
  const throwing = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };

  assert.deepEqual(readPrefs(throwing), DEFAULT_PREFS);
  assert.doesNotThrow(() => writePrefs(DEFAULT_PREFS, throwing));
});

test("what is written can be read back", () => {
  const storage = fakeStorage();
  const wanted: Prefs = {
    theme: "tenue",
    textSize: "s",
    readAloud: true,
    pictograms: false,
    onboarded: true,
  };

  writePrefs(wanted, storage);

  assert.deepEqual(readPrefs(storage), wanted);
});

test("every text size maps to a scale, and medium is the unscaled one", () => {
  assert.equal(TEXT_SCALE.m, 1);
  assert.ok(TEXT_SCALE.s < TEXT_SCALE.m);
  assert.ok(TEXT_SCALE.l > TEXT_SCALE.m);
});

test("a fresh phone has not seen the welcome", () => {
  assert.equal(readPrefs(fakeStorage()).onboarded, false);
});

test("having seen the welcome is remembered like any other preference", () => {
  const storage = fakeStorage();
  writePrefs({ ...DEFAULT_PREFS, onboarded: true }, storage);

  assert.equal(readPrefs(storage).onboarded, true);
});

test("a stored value that is not a boolean does not keep the welcome away", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ onboarded: "sí" }) });

  assert.equal(readPrefs(storage).onboarded, false);
});
