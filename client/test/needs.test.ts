import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_PREFS } from "../lib/pure/prefs.ts";
import { NEEDS, settingsFor } from "../lib/pure/needs.ts";

test("choosing nothing changes nothing", () => {
  assert.deepEqual(settingsFor([]), {});
});

test("seeing badly asks for big text and a voice", () => {
  assert.deepEqual(settingsFor(["sight"]), { textSize: "l", readAloud: true });
});

test("reading being hard asks for pictograms and a voice", () => {
  assert.deepEqual(settingsFor(["reading"]), { pictograms: true, readAloud: true });
});

test("noise and light being too much asks for the dim theme", () => {
  assert.deepEqual(settingsFor(["overload"]), { theme: "tenue" });
});

test("two needs are both answered, not the last one only", () => {
  assert.deepEqual(settingsFor(["sight", "overload"]), {
    textSize: "l",
    readAloud: true,
    theme: "tenue",
  });
});

test("a need the product has no setting for changes no setting", () => {
  // "Oigo poco o nada" and "Me pierdo" are real answers, and the guide already works that way
  // for everybody: nothing sounds unasked, and there is one step per screen. Switching a
  // setting on so the screen looks busy would be the product claiming work it did not do.
  assert.deepEqual(settingsFor(["hearing"]), {});
  assert.deepEqual(settingsFor(["wayfinding"]), {});
});

test("every need the screen offers is a key the mapping knows", () => {
  for (const need of NEEDS) {
    assert.doesNotThrow(() => settingsFor([need]));
  }
});

test("what it returns is always a patch of real preferences", () => {
  const patch = settingsFor([...NEEDS]);
  for (const key of Object.keys(patch)) {
    assert.ok(key in DEFAULT_PREFS, `${key} is not a preference`);
  }
});
