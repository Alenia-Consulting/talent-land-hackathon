# Buscar un recorrido desde la app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una persona abra la app, encuentre un sitio por su nombre y abra su recorrido, sin depender de que le manden el enlace o el QR.

**Architecture:** Una ruta pública nueva devuelve el catálogo de guías publicadas; el navegador lo filtra mientras se escribe. La raíz pasa a ser una bifurcación entre visitante y centro. La entrada por enlace y QR (`/g?slug=…`) no se toca.

**Tech Stack:** FastAPI + SQLAlchemy 2.x (`api/`), Next.js 16 App Router con export estático (`client/`), pytest y `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-buscar-recorrido-design.md`

## Global Constraints

- Rama desde `development`; PR contra `development`.
- Commits `(TYPE) IMPERATIVE-AND-SHORT-MESSAGE`, en inglés. Documentación en español.
- Export estático: nada de rutas `[id]`; los parámetros viajan en el query string.
- Las rutas nunca tocan el ORM: todo pasa por `api/db/guides.py`.
- Tras tocar rutas o modelos: `python scripts/export_openapi.py` desde `api/` y `npm run types` desde `client/`, y se commitean con el cambio.
- `GET /api/guides` es del panel y no se toca: devuelve borradores.
- Sin dependencias nuevas. Ficheros ≤ 500 líneas.
- Cobertura ≥ 85 % en `api/`. Tests solo en `api/test/` (pytest) y `client/test/` (`node --test`).
- Sin animaciones ni transiciones bruscas; objetivos grandes; tokens de color existentes.

## Review Focus

1. **`/public/guides` tapada por `/public/{slug}`** → FastAPI casa la primera que encaja y devolvería 404 «guide not found». Test en Task 1.
2. **Catálogo vacío** (nada publicado todavía) → la pantalla lo dice, no se queda en blanco. Test en Task 2 (`catalogueState`).
3. **La API no responde** → la pantalla lo dice y deja reintentar, no gira para siempre. Test en Task 2.
4. **Consulta de solo espacios, con acentos o en mayúsculas** → espacios = no filtrar; «hospital generál» encuentra «Hospital General». Test en Task 2.
5. **Guía publicada sin `public_slug`** → nunca sale en el catálogo; si saliera, la tarjeta enlazaría a `/g?slug=null`. Test en Task 1.

---

### Task 1: El catálogo público en la API

**Files:**
- Modify: `api/db/guides.py`
- Modify: `api/schemas.py`
- Modify: `api/routers/guides.py`
- Test: `api/test/test_guides_repository.py`, `api/test/test_guides_api.py`
- Regenerate: `contracts/openapi.json`, `client/lib/api-types.ts`

**Interfaces:**
- Consumes: `DEFAULT_PAGE_SIZE`, `Guide`, `select`, `Session` (ya importados en `db/guides.py`).
- Produces:
  - `list_published(session: Session, *, limit: int = DEFAULT_PAGE_SIZE, offset: int = 0) -> list[Guide]`
  - `class PublicGuideSummary(BaseModel)` con `title: str`, `venue_name: str`, `public_slug: str`, `cover_photo_url: str | None`, `walking_minutes: int | None`, `reviewed_at: datetime | None`, `language: str`
  - `GET /public/guides` → `list[PublicGuideSummary]`, `limit` (default 50, 1..200) y `offset` (≥ 0)

- [ ] **Step 1: Escribir los tests del repositorio que fallan** en `api/test/test_guides_repository.py`

```python
def test_the_catalogue_only_has_published_guides(db_session, make_guide):
    db_session.add_all([
        make_guide(venue_name="Centro A", status="published"),
        make_guide(venue_name="Centro B", status="draft"),
        make_guide(venue_name="Centro C", status="needs_review"),
    ])
    db_session.commit()

    assert [g.venue_name for g in guides.list_published(db_session)] == ["Centro A"]


def test_the_catalogue_is_alphabetical_so_it_can_be_browsed(db_session, make_guide):
    for venue, title in (("Hospital Sur", "Urgencias"), ("Centro Trinidad", "Principal"),
                         ("Hospital Sur", "Consultas")):
        db_session.add(make_guide(venue_name=venue, title=title, status="published"))
    db_session.commit()

    assert [(g.venue_name, g.title) for g in guides.list_published(db_session)] == [
        ("Centro Trinidad", "Principal"),
        ("Hospital Sur", "Consultas"),
        ("Hospital Sur", "Urgencias"),
    ]


def test_a_published_guide_without_a_slug_stays_out_of_the_catalogue(db_session, make_guide):
    db_session.add(make_guide(venue_name="Centro sin enlace", status="published", public_slug=None))
    db_session.commit()

    assert guides.list_published(db_session) == []


def test_the_catalogue_is_one_page_at_a_time(db_session, make_guide):
    for n in range(3):
        db_session.add(make_guide(venue_name=f"Centro {n}", status="published"))
    db_session.commit()

    assert len(guides.list_published(db_session, limit=2)) == 2
    assert [g.venue_name for g in guides.list_published(db_session, limit=2, offset=2)] == ["Centro 2"]
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_guides_repository.py -q`
Expected: FAIL con `AttributeError: module 'db.guides' has no attribute 'list_published'`

- [ ] **Step 3: Implementar `list_published` en `api/db/guides.py`**

`select(Guide)` filtrando `Guide.status == "published"` y `Guide.public_slug.is_not(None)`, ordenado por `Guide.venue_name` y luego `Guide.title`, con `limit` y `offset`. Junto a `list_guides`, con docstring que diga por qué el orden es alfabético y no por fecha.

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `cd api && pytest test/test_guides_repository.py -q`
Expected: PASS

- [ ] **Step 5: Escribir los tests de la ruta que fallan** en `api/test/test_guides_api.py`

```python
def test_the_catalogue_is_served_and_not_read_as_a_slug(client, db_session, make_guide):
    """/public/guides no puede quedar tapada por /public/{slug}."""
    db_session.add(make_guide(venue_name="Centro Trinidad", status="published"))
    db_session.commit()

    response = client.get("/public/guides")

    assert response.status_code == 200, response.text
    assert [g["venue_name"] for g in response.json()] == ["Centro Trinidad"]


def test_the_catalogue_never_shows_a_draft(client, db_session, make_guide):
    db_session.add(make_guide(venue_name="Centro en borrador", status="draft"))
    db_session.commit()

    assert client.get("/public/guides").json() == []


def test_the_catalogue_says_nothing_about_the_state_of_the_work(client, db_session, make_guide):
    db_session.add(make_guide(status="published"))
    db_session.commit()

    entry = client.get("/public/guides").json()[0]

    assert set(entry) == {"title", "venue_name", "public_slug", "cover_photo_url",
                          "walking_minutes", "reviewed_at", "language"}
```

- [ ] **Step 6: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_guides_api.py -q`
Expected: FAIL con 404 `guide not found` (la petición la atiende `/public/{slug}`)

- [ ] **Step 7: Añadir `PublicGuideSummary` a `api/schemas.py`**

Junto a `GuideSummary`, con `model_config = ConfigDict(from_attributes=True)` y los siete campos de **Interfaces**. Docstring: lo que ve quien busca un sitio; sin `id` ni estados, que son del panel.

- [ ] **Step 8: Añadir la ruta a `api/routers/guides.py`**

`@router.get("/public/guides", response_model=list[PublicGuideSummary])`, **declarada antes de `read_public_guide`**: FastAPI casa la primera ruta que encaja y `/public/{slug}` se quedaría con la petición. Un comentario en el código lo dice. Firma `limit: int = Query(default=50, ge=1, le=200)` y `offset: int = Query(default=0, ge=0)`; 50 y no los 20 del panel porque esto es un catálogo que se ojea entero. Llama a `guides.list_published`.

- [ ] **Step 9: Ejecutar la suite entera**

Run: `cd api && pytest test/ --cov=. --cov-report=term-missing --cov-fail-under=85 -q`
Expected: PASS, cobertura ≥ 85 %

- [ ] **Step 10: Regenerar contrato y tipos**

Run: `cd api && python scripts/export_openapi.py` y después `cd client && npm run types`
Expected: `contracts/openapi.json` y `client/lib/api-types.ts` modificados; `pytest test/test_openapi_contract.py -q` en verde.

- [ ] **Step 11: Commit**

```bash
git add api/db/guides.py api/schemas.py api/routers/guides.py api/test/ contracts/openapi.json client/lib/api-types.ts
git commit -m "(feat) Serve the catalogue of published guides"
```

---

### Task 2: El filtro y los estados de la pantalla, puros

**Files:**
- Create: `client/lib/pure/search.ts`
- Test: `client/test/search.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `normalize(text: string): string`
  - `filterCatalogue<G extends { venue_name: string; title: string }>(guides: readonly G[], query: string): G[]`
  - `type CatalogueState = "loading" | "error" | "empty" | "noMatch" | "list"`
  - `catalogueState(input: { guides: readonly unknown[] | null; matches: readonly unknown[]; error: string | null }): CatalogueState`

- [ ] **Step 1: Escribir el test que falla** en `client/test/search.test.ts`

```ts
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
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `cd client && node --test test/search.test.ts`
Expected: FAIL, `Cannot find module '../lib/pure/search.ts'`

- [ ] **Step 3: Implementar `client/lib/pure/search.ts`**

`normalize` baja a minúsculas, aplica `normalize("NFD")` y quita los diacríticos (`\p{Diacritic}`), y colapsa los espacios. `filterCatalogue` parte la consulta en palabras y se queda con las guías en cuyo `venue_name + " " + title` normalizado aparecen **todas**. `catalogueState` decide en este orden: `error` → `"error"`, `guides === null` → `"loading"`, `guides.length === 0` → `"empty"`, `matches.length === 0` → `"noMatch"`, si no `"list"`. Cabecera con la regla de producto: una búsqueda sin resultados nunca es un callejón sin salida.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd client && npm test`
Expected: PASS, sin fallos en el resto de la suite

- [ ] **Step 5: Commit**

```bash
git add client/lib/pure/search.ts client/test/search.test.ts
git commit -m "(feat) Add the rule that narrows the catalogue as you type"
```

---

### Task 3: La pantalla de búsqueda

**Files:**
- Modify: `client/lib/guides.ts`
- Create: `client/app/buscar/page.tsx`
- Modify: `client/lib/i18n/es.ts`

**Interfaces:**
- Consumes: `filterCatalogue`, `catalogueState`, `CatalogueState` (Task 2); `PublicGuideSummary` del contrato regenerado (Task 1).
- Produces:
  - `type PublicGuide = components["schemas"]["PublicGuideSummary"]` en `lib/guides.ts`
  - `listPublicGuides({ limit, offset }?: { limit?: number; offset?: number }, fetchImpl?: typeof fetch): Promise<PublicGuide[]>`

- [ ] **Step 1: Añadir `listPublicGuides` a `client/lib/guides.ts`**

Junto a `readPublicGuide`, con la misma forma que `listGuides`: `request<PublicGuide[]>(\`/public/guides?limit=${limit}&offset=${offset}\`, { method: "GET" }, fetchImpl)`, `limit` por defecto 50. Exportar también el tipo `PublicGuide`.

- [ ] **Step 2: Añadir los textos a `client/lib/i18n/es.ts`**

Bloque `buscar` con: título, instrucción del cuadro, etiqueta accesible del campo, los tres estados (`loading`, `error` con reintento, `empty`, `noMatch`), el botón «Ver todos» y el sufijo de minutos andando. Redacción en lectura fácil, frases cortas.

- [ ] **Step 3: Escribir `client/app/buscar/page.tsx`**

`"use client"`. Carga el catálogo una vez con `listPublicGuides`, guarda `guides: PublicGuide[] | null` y `error: string | null` (de `ApiError.message`), y el texto del cuadro. Calcula `matches = filterCatalogue(guides ?? [], query)` y pinta según `catalogueState`. Cada guía es una tarjeta (`Card`) enlazada a `/g?slug=${guide.public_slug}`: nombre del sitio grande, título del recorrido debajo, foto de portada si la hay, minutos andando y fecha de revisión. En `noMatch`, un botón que vacía el cuadro («Ver todos»). El cuadro va dentro de un `TopBar` para que no se pierda al bajar. Sin animaciones.

- [ ] **Step 4: Comprobar que compila y que la suite sigue verde**

Run: `cd client && npm run typecheck && npm test && npm run build`
Expected: PASS; el build lista `/buscar` entre las rutas estáticas

- [ ] **Step 5: Verlo contra la API de verdad**

Abrir `/buscar`, comprobar: el catálogo aparece, escribir estrecha, una consulta sin resultados ofrece «Ver todos», y una tarjeta abre su recorrido en `/g?slug=…`.

- [ ] **Step 6: Commit**

```bash
git add client/lib/guides.ts client/lib/i18n/es.ts client/app/buscar/
git commit -m "(feat) Let a visitor find a place without a link or a QR"
```

---

### Task 4: La bifurcación en la raíz

**Files:**
- Modify: `client/app/page.tsx`
- Create: `client/app/centro/page.tsx`
- Modify: `client/lib/i18n/es.ts`

**Interfaces:**
- Consumes: `/buscar` (Task 3).
- Produces: `/centro`, que es lo que la raíz enseñaba hasta ahora.

- [ ] **Step 1: Mover a `client/app/centro/page.tsx` lo que hoy hay en la raíz**

Las dos tarjetas («Grabar un recorrido» → `/grabar`, panel → `/panel`) y el `HealthCheck`, que deja de estar en la puerta del visitante por ser herramienta de desarrollo.

- [ ] **Step 2: Reescribir `client/app/page.tsx` como la bifurcación**

Título, lema, y dos tarjetas grandes del mismo tamaño: «Voy a ir a un sitio / Mira cómo es antes de ir» → `/buscar`, y «Soy del centro / Graba y publica un recorrido» → `/centro`. No se recuerda la elección: no se guarda nada que describa a quien entra. Textos nuevos en `es.home`.

- [ ] **Step 3: Comprobar que compila y que la suite sigue verde**

Run: `cd client && npm run typecheck && npm test && npm run build`
Expected: PASS; el build lista `/`, `/buscar` y `/centro`

- [ ] **Step 4: Verlo en el navegador**

Desde `/`, cada tarjeta lleva a su lado, y desde `/buscar` se llega a un recorrido publicado.

- [ ] **Step 5: Commit**

```bash
git add client/app/page.tsx client/app/centro/ client/lib/i18n/es.ts
git commit -m "(feat) Ask at the door what someone came to do"
```
