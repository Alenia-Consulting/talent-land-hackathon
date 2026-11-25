import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueState, filterCatalogue, normalize } from "../lib/pure/search.ts";

const CATALOGUE = [
  { venue_name: "Hospital General de Occidente", title: "Recorrido principal" },
  { venue_name: "Hospital General de Occidente", title: "Sala de rayos X" },
  { venue_name: "Centro de salud Trinidad", title: "Recorrido principal" },
];

test("sin escribir nada se ve el catálogo entero", () => {
  assert.deepEqual(filterCatalogue(CATALOGUE, ""), CATALOGUE);
});

test("solo espacios es como no escribir nada", () => {
  assert.deepEqual(filterCatalogue(CATALOGUE, "   "), CATALOGUE);
});

test("encuentra sin acentos y sin mayúsculas", () => {
  assert.equal(normalize("Hospital Generál"), "hospital general");
  assert.equal(filterCatalogue(CATALOGUE, "GENERAL").length, 2);
});

test("tienen que aparecer todas las palabras, no una cualquiera", () => {
  assert.equal(filterCatalogue(CATALOGUE, "hospital occidente").length, 2);
  assert.equal(filterCatalogue(CATALOGUE, "hospital trinidad").length, 0);
});

test("las palabras pueden repartirse entre el sitio y el recorrido", () => {
  assert.deepEqual(filterCatalogue(CATALOGUE, "occidente rayos"), [CATALOGUE[1]]);
});

test("un centro con varios recorridos los enseña todos", () => {
  assert.equal(filterCatalogue(CATALOGUE, "occidente").length, 2);
});

test("no encontrar nada devuelve una lista vacía, nunca el catálogo entero", () => {
  assert.deepEqual(filterCatalogue(CATALOGUE, "aeropuerto"), []);
});

test("mientras no ha llegado el catálogo, la pantalla está cargando", () => {
  assert.equal(catalogueState({ guides: null, matches: [], error: null }), "loading");
});

test("un fallo de la API se cuenta, y se cuenta antes que nada", () => {
  assert.equal(catalogueState({ guides: null, matches: [], error: "No hay conexión" }), "error");
});

test("que no haya ningún recorrido publicado no es lo mismo que no encontrar", () => {
  assert.equal(catalogueState({ guides: [], matches: [], error: null }), "empty");
  assert.equal(catalogueState({ guides: CATALOGUE, matches: [], error: null }), "noMatch");
});

test("una consulta con acentos encuentra un nombre escrito sin ellos, y al revés", () => {
  const acentuado = [{ venue_name: "Clínica Dental Alameda", title: "Recorrido principal" }];

  assert.equal(filterCatalogue(CATALOGUE, "generál").length, 2);
  assert.equal(filterCatalogue(acentuado, "clinica").length, 1);
});
