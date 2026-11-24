import assert from "node:assert/strict";
import { test } from "node:test";

import { applyAlertEvent, beginLog, countByType, finishLog } from "../lib/pure/alerts.ts";
import { es } from "../lib/i18n/es.ts";

test("alerts are stored relative to the recording start, in seconds", () => {
  let log = beginLog(10_000, []);
  log = applyAlertEvent(log, "luz", { type: "start", at: 12_000 });
  log = applyAlertEvent(log, "luz", { type: "end", at: 15_550 });
  assert.deepEqual(finishLog(log, 40_000), [{ tipo: "luz", inicio_seg: 2, fin_seg: 5.6 }]);
});

test("open alerts are closed at the end; alerts active at the start open at 0", () => {
  let log = beginLog(1000, ["luz"]);
  log = applyAlertEvent(log, "movimiento", { type: "start", at: 6000 });
  assert.deepEqual(finishLog(log, 11_000), [
    { tipo: "luz", inicio_seg: 0, fin_seg: 10 },
    { tipo: "movimiento", inicio_seg: 5, fin_seg: 10 },
  ]);
});

test("duplicate starts and orphan ends are ignored; times never go negative", () => {
  let log = beginLog(5000, []);
  log = applyAlertEvent(log, "luz", { type: "end", at: 6000 });
  log = applyAlertEvent(log, "luz", { type: "start", at: 4000 });
  log = applyAlertEvent(log, "luz", { type: "start", at: 7000 });
  assert.deepEqual(finishLog(log, 8000), [{ tipo: "luz", inicio_seg: 0, fin_seg: 3 }]);
});

test("summary counts per type and pluralizes in Spanish", () => {
  const counts = countByType([
    { tipo: "luz", inicio_seg: 0, fin_seg: 1 },
    { tipo: "luz", inicio_seg: 2, fin_seg: 3 },
    { tipo: "movimiento", inicio_seg: 4, fin_seg: 5 },
  ]);
  assert.deepEqual(counts, { luz: 2, movimiento: 1 });
  assert.equal(es.revision.darkSegments(counts.luz), "2 tramos oscuros");
  assert.equal(es.revision.fastSegments(counts.movimiento), "1 tramo rápido");
});
