import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canFinish,
  markOf,
  nextToRecord,
  recordedCount,
  resetTake,
  sendPlan,
  type Take,
  takesFromParts,
} from "../lib/pure/takes.ts";

const ENTRADA = { title: "Entrada", category: "entrance" as const };
const RECEPCION = { title: "Recepción", category: "reception" as const };
const SALA = { title: "Sala de espera", category: "waiting" as const };

const with_ = (take: Take, state: Take["state"], routeId: string | null = null): Take => ({
  ...take,
  state,
  routeId,
});
const [entrada, recepcion, sala] = takesFromParts([ENTRADA, RECEPCION, SALA]);

test("al empezar, todas las partes están pendientes y la primera es la que toca", () => {
  const takes = takesFromParts([ENTRADA, RECEPCION]);
  assert.deepEqual(takes.map((t) => t.state), ["pending", "pending"]);
  assert.equal(nextToRecord(takes), 0);
});

test("la siguiente que toca es la primera pendiente, aunque se grabara fuera de orden", () => {
  // El orden lo marca la lista, no el momento de grabar: permitirlo es menos código que prohibirlo.
  assert.equal(nextToRecord([entrada, with_(recepcion, "sent", "r"), sala]), 0);
  assert.equal(nextToRecord([with_(entrada, "sent", "r"), recepcion, with_(sala, "recorded")]), 1);
});

test("sin nada pendiente no toca ninguna", () => {
  assert.equal(nextToRecord([with_(entrada, "sent", "r1"), with_(recepcion, "failed")]), null);
});

test("con una guía ya creada, la siguiente toma se añade y nunca se vuelve a crear", () => {
  // Crear la guía otra vez dejaría una duplicada en el panel del centro, con la mitad de los
  // pasos en cada una.
  const takes = [with_(entrada, "sent", "r1"), recepcion];
  assert.deepEqual(sendPlan(takes, 1, "g1"), { kind: "addRoute", guideId: "g1", position: 2 });
  assert.deepEqual(sendPlan([entrada], 0, null), { kind: "create" });
});

test("una parte grabada antes que las anteriores cae en su sitio, no al final", () => {
  // «Sala de espera» está en el puesto 3 del plan pero «Entrada» aún no existe: va segunda.
  const takes = [entrada, with_(recepcion, "sent", "r1"), sala];
  assert.deepEqual(sendPlan(takes, 2, "g1"), { kind: "addRoute", guideId: "g1", position: 2 });
  // Y «Entrada», grabada después, entra la primera y empuja a las demás.
  assert.deepEqual(sendPlan(takes, 0, "g1"), { kind: "addRoute", guideId: "g1", position: 1 });
});

test("se puede terminar con una sola toma grabada", () => {
  // Parar a mitad dejó de ser un error: la parte que no grabaste sencillamente no está.
  assert.equal(canFinish([with_(entrada, "recorded"), recepcion]), true);
});

test("no se puede terminar sin ninguna toma", () => {
  assert.equal(canFinish([entrada, recepcion]), false);
});

test("una toma fallida sigue contando como grabada, porque el vídeo está en el móvil", () => {
  assert.equal(canFinish([with_(entrada, "failed")]), true);
  assert.equal(recordedCount([with_(entrada, "failed"), recepcion]), 1);
});

test("la toma lleva una sola marca en el segundo 0, con el ruido si la persona lo dijo", () => {
  assert.deepEqual(markOf(entrada), { title: "Entrada", category: "entrance", marked_at_seconds: 0 });
  assert.deepEqual(markOf({ ...entrada, noise: "noisy" }), {
    title: "Entrada",
    category: "entrance",
    marked_at_seconds: 0,
    noise_level: "noisy",
  });
});

test("repetir una toma la devuelve a pendiente sin tocar a las demás", () => {
  // Las otras tomas no se tocan, ni las anteriores ni las siguientes.
  const takes = [with_(entrada, "sent", "r1"), with_(recepcion, "sent", "r2"), with_(sala, "sent", "r3")];

  const after = resetTake(takes, 1);

  assert.deepEqual(after.map((t) => t.state), ["sent", "pending", "sent"]);
  assert.equal(after[1].routeId, null);
  assert.deepEqual([after[0].routeId, after[2].routeId], ["r1", "r3"]);
  assert.equal(takes[1].state, "sent", "the list it was given is not mutated");
});
