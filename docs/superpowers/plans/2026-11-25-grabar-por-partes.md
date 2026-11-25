# Grabar por partes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada parte de un recorrido se graba en su propia toma, cuando la persona está lista, y deja de perderse la grabación entera por aritmética entre el reloj del móvil y el fichero de vídeo.

**Architecture:** Cada toma es un `Route` con una sola marca en el segundo 0, de modo que su paso abarca la toma entera y no hay nada que cortar. La API mide la duración real del fichero al recibirlo y recoloca los pasos con ella; los recorridos pueden insertarse en una posición y borrarse, y la numeración de pasos pasa a derivarse del orden de los recorridos en vez del orden de llegada.

**Tech Stack:** FastAPI + SQLAlchemy 2.x + Alembic (`api/`), Next.js 16 App Router con export estático (`client/`), ffmpeg vía `imageio-ffmpeg`, OpenCV. pytest en `api/`, `node --test` en `client/`.

**Spec:** `docs/superpowers/specs/2026-11-25-grabar-por-partes-design.md`

## Global Constraints

- **Dependencias nuevas: ninguna.** Todo sale de lo que ya hay (`AGENTS.md` exige confirmación del equipo).
- **Ficheros de 500 líneas como máximo.** `client/app/grabar/page.tsx` ya va por 400: la lista vive en su propio fichero.
- **Tests dentro de `api/test/` (pytest) y `client/test/` (`node --test`)**; fuera de ahí no cuentan. Cobertura ≥ 85 %.
- **Contrato:** tras tocar rutas o modelos, `cd api && python scripts/export_openapi.py` y después `cd client && npm run types`. Nunca a mano.
- **Textos de interfaz en español, código y commits en inglés** (`AGENTS.md`).
- **No tocar** `AGENTS.md`, `.github/`, `kubernetes/` ni `docker/`.
- **Invariantes de producto** (`CLAUDE.md` §1): nada de sonido automático; la IA no inventa; nada se publica sin revisión humana; sin animaciones ni transiciones bruscas; el ruido es relativo (`quiet`/`medium`/`noisy`), nunca en decibelios.
- **Dos PR:** tareas 1–5 son `api/` y van juntas; 6–8 son `client/`. Cada bloque cabe en ~400 modificaciones.
- **Antes de empezar:** preguntar a Heitor por su PoC «Reduce to 1 the number of sections to record», que no está en el repo y toca estos mismos ficheros.

## Review Focus

Lo que la especificación implica, ningún test de tarea ejercita y más probablemente muerde a alguien:

1. **El fichero dura más que el reloj del móvil.** `useRecorder` guarda `Math.min(measured, 120)`, así que al llegar al tope el fichero puede durar 120,4 s y la cola se perdería si la medida solo recortase. → test en Tarea 1.
2. **Borrar el único recorrido de una guía publicada** dejaría un enlace público, quizá ya impreso en un QR, apuntando a una guía sin nada. → 409, test en Tarea 4.
3. **Reintentar la primera toma tras un fallo de subida** no debe crear una segunda guía: la guía ya existe y se reutiliza. → test en Tarea 7.
4. **Una toma sin audio utilizable** deja el nivel vacío, y la hoja de sonido no puede anunciar «tranquilo». → test en Tarea 5.
5. **Un nivel puesto a mano no puede ser pisado por una medida posterior**, o la respuesta de la persona que estuvo allí desaparece sola. → test en Tarea 5.

---

## Tarea 1: La API mide la duración y recoloca los pasos

**Files:**
- Modify: `api/media/video_io.py`
- Modify: `api/db/guides.py`
- Modify: `api/routers/guides.py` (dentro de `_ingest`, antes de construir `timings`)
- Test: `api/test/test_video_io.py`, `api/test/test_guides_repository.py`

**Interfaces:**
- Consumes: `video_io.ffmpeg_exe()`, `ProcessingFailed`, `Route`, `Guide`.
- Produces:
  - `video_io.duration(video: pathlib.Path) -> float`
  - `guides.retime_route(route: Route, measured_seconds: float) -> None`

- [ ] **Step 1: Escribir los tests que fallan** en `api/test/test_video_io.py` y `api/test/test_guides_repository.py`

```python
def test_duration_measures_the_file_and_not_its_header(tmp_path):
    """Un webm de MediaRecorder suele venir sin duración en la cabecera."""
    video = _encode_seconds(tmp_path, 2.0)          # helper del propio test, con ffmpeg
    assert video_io.duration(video) == pytest.approx(2.0, abs=0.2)


def test_duration_refuses_a_file_it_cannot_decode(tmp_path):
    broken = tmp_path / "roto.mp4"
    broken.write_bytes(b"no soy un video")
    with pytest.raises(ProcessingFailed):
        video_io.duration(broken)


def test_retiming_stretches_a_step_when_the_file_is_longer(db_session, make_guide):
    """El reloj del móvil se queda corto al llegar al tope: la cola no se pierde."""
    guide = make_guide(marks=[{"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0}],
                       video_duration_seconds=120.0)
    route = guide.routes[0]

    guides.retime_route(route, 120.4)

    assert route.steps[0].end_seconds == 120.4
    assert route.video_duration_seconds == 120.4


def test_retiming_shortens_a_step_when_the_file_is_shorter(db_session, make_guide):
    guide = make_guide(marks=[{"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0}],
                       video_duration_seconds=30.0)

    guides.retime_route(guide.routes[0], 18.5)

    assert guide.routes[0].steps[0].end_seconds == 18.5


def test_retiming_puts_the_photo_in_the_middle_of_the_step(db_session, make_guide):
    """Hoy sale «marca + 1,5 s»: el instante justo después de pulsar Grabar."""
    guide = make_guide(marks=[{"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0}],
                       video_duration_seconds=30.0)

    guides.retime_route(guide.routes[0], 20.0)

    assert guide.routes[0].steps[0].photo_second == 10.0


def test_retiming_adds_up_the_duration_of_the_whole_guide(db_session, make_guide):
    guide = make_guide(..., video_duration_seconds=30.0)
    guides.add_route(db_session, guide, title="Recepción",
                     marks=[{"title": "Recepción", "category": "reception", "marked_at_seconds": 0.0}],
                     video_duration_seconds=30.0)

    guides.retime_route(guide.routes[0], 18.0)

    assert guide.video_duration_seconds == 48.0
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_video_io.py test/test_guides_repository.py -q`
Expected: FAIL con `AttributeError: module 'media.video_io' has no attribute 'duration'` y lo mismo para `retime_route`.

- [ ] **Step 3: Implementar `video_io.duration`**

Decodifica el fichero entero sin codificar nada —`ffmpeg -i <video> -f null -`— y lee el **último** `time=HH:MM:SS.ss` de stderr. Es lo único fiable: la cabecera de un webm de `MediaRecorder` suele no traer duración, que es precisamente el caso que hay que cubrir. Sin ningún `time=`, `ProcessingFailed("no se pudo leer el vídeo")`.

- [ ] **Step 4: Implementar `guides.retime_route`**

Para los pasos del recorrido en orden: el final de cada uno es el comienzo del siguiente, y el del último es `measured_seconds`; todos recortados a `measured_seconds`. `photo_second` pasa a ser el centro del paso. Después, `route.video_duration_seconds = measured_seconds` y la duración de la guía vuelve a ser la suma de sus recorridos, igual que ya hace `add_route`.

- [ ] **Step 5: Llamarla desde `_ingest`**

En `api/routers/guides.py:317`, antes de construir `timings`: medir con `video_io.duration(target)`, llamar a `guides.retime_route(route, medida)` y leer los `timings` de los pasos ya recolocados. El número que mandó el móvil queda como lo que es, una pista.

- [ ] **Step 6: Ejecutar la suite entera**

Run: `cd api && pytest test/ --cov=. --cov-fail-under=85 -q`
Expected: PASS, cobertura ≥ 85 %.

- [ ] **Step 7: Commit**

```bash
git add api/media/video_io.py api/db/guides.py api/routers/guides.py api/test/
git commit -m "(fix) Measure the real duration of a recording instead of trusting the phone"
```

---

## Tarea 2: Un paso sin fotogramas no tumba la subida

**Files:**
- Modify: `api/media/pipeline.py:88-100`
- Test: `api/test/test_pipeline.py`

**Interfaces:**
- Consumes: `video_io.read_frames`, `video_io.duration` (Tarea 1).
- Produces: nada nuevo; cambia el comportamiento de `pipeline.process` ante un tramo vacío.

- [ ] **Step 1: Escribir los tests que fallan** en `api/test/test_pipeline.py`

```python
def test_a_step_past_the_end_uses_the_last_frame_instead_of_failing(tmp_path):
    """Las guías ya grabadas tienen marcas posteriores al final real del fichero."""
    video = _encode_seconds(tmp_path, 2.0)
    steps = [pipeline.StepTiming(position=1, start_seconds=5.0, end_seconds=6.0, photo_second=5.5)]

    processed = pipeline.process(video, steps)

    assert len(processed[0].photo) > 0


def test_a_file_with_no_frames_at_all_is_still_a_failure(tmp_path):
    empty = tmp_path / "vacio.mp4"
    empty.write_bytes(b"")
    with pytest.raises(pipeline.ProcessingFailed):
        pipeline.process(empty, [pipeline.StepTiming(1, 0.0, 1.0, 0.5)])


def test_a_rescued_step_gets_a_clip_with_frames_in_it(tmp_path):
    """Un mp4 de cero fotogramas es una tarjeta rota en el reproductor."""
    video = _encode_seconds(tmp_path, 2.0)
    steps = [pipeline.StepTiming(position=1, start_seconds=5.0, end_seconds=6.0, photo_second=5.5)]

    assert len(pipeline.process(video, steps)[0].clip) > 0
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_pipeline.py -q`
Expected: FAIL con `ProcessingFailed: el paso 1 no tiene imagen en el vídeo`.

- [ ] **Step 3: Rescatar el tramo en `_process_step`**

Si el tramo no da ni un fotograma, repetir la lectura sobre **el último segundo del fichero**, usando `video_io.duration`. Lo que se escriba en el clip son esos fotogramas, de modo que el clip nunca queda vacío. Si tampoco así hay fotogramas, `ProcessingFailed`: un fichero ilegible sí es irrecuperable.

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `cd api && pytest test/test_pipeline.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/media/pipeline.py api/test/test_pipeline.py
git commit -m "(fix) Rescue a step whose range falls past the end of the recording"
```

---

## Tarea 3: Un recorrido sabe en qué posición va

**Files:**
- Modify: `api/db/guides.py` (`add_route`, nuevo `_renumber`)
- Modify: `api/schemas.py` (`RouteCreate`, `GuideCreate`)
- Modify: `api/routers/guides.py` (`create_guide`, `add_route`)
- Regenerate: `contracts/openapi.json`, `client/lib/api-types.ts`
- Test: `api/test/test_guides_repository.py`, `api/test/test_guides_api.py`

**Interfaces:**
- Produces:
  - `guides.add_route(session, guide, *, title, marks, video_duration_seconds, position: int | None = None) -> Route`
  - `RouteCreate.position: int | None`, `GuideCreate.route_title: str | None`
  - Regla: la posición de un paso sale de recorrer los recorridos en orden y, dentro de cada uno, sus pasos en orden.

- [ ] **Step 1: Escribir los tests que fallan**

```python
def test_a_route_can_be_inserted_in_a_place_of_its_own(db_session, make_guide):
    guide = make_guide(route_title="Entrada")
    guides.add_route(db_session, guide, title="Sala", marks=[_mark("Sala")], video_duration_seconds=10)

    guides.add_route(db_session, guide, title="Recepción", marks=[_mark("Recepción")],
                     video_duration_seconds=10, position=2)

    assert [r.title for r in sorted(guide.routes, key=lambda r: r.position)] == [
        "Entrada", "Recepción", "Sala"]


def test_inserting_renumbers_the_steps_of_the_whole_guide(db_session, make_guide):
    """«paso 3 de 7» tiene que seguir significando algo."""
    guide = make_guide(route_title="Entrada")
    guides.add_route(db_session, guide, title="Sala", marks=[_mark("Sala")], video_duration_seconds=10)
    guides.add_route(db_session, guide, title="Recepción", marks=[_mark("Recepción")],
                     video_duration_seconds=10, position=2)

    assert [(s.position, s.title) for s in sorted(guide.steps, key=lambda s: s.position)] == [
        (1, "Entrada"), (2, "Recepción"), (3, "Sala")]


def test_without_a_position_a_route_still_goes_last(db_session, make_guide):
    """Lo que ya existe no cambia de comportamiento."""


def test_the_first_route_can_be_named_after_its_part(client, db_session):
    """Hoy la ruta 1 se llama como la guía, y el visitante vería «Recorrido principal»."""
    response = client.post("/guides", json={
        "title": "Recorrido principal", "venue_name": "Centro Trinidad", "route_title": "Entrada",
        "video_duration_seconds": 20, "marks": [{"title": "Entrada", "category": "entrance",
                                                 "marked_at_seconds": 0.0}]})

    assert response.json()["routes"][0]["title"] == "Entrada"
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_guides_repository.py test/test_guides_api.py -q`
Expected: FAIL con `TypeError: add_route() got an unexpected keyword argument 'position'` y `route_title` ignorado.

- [ ] **Step 3: Implementar `_renumber(guide: Guide) -> None`** en `api/db/guides.py`

Recorre los recorridos ordenados por posición, les asigna 1..n, y numera los pasos 1..m siguiendo ese orden. Sustituye al `max(position) + 1` de `add_route` y lo usará también el borrado.

- [ ] **Step 4: Añadir `position` a `add_route` y `route_title` a `create`**

`position=None` añade al final, como hoy. Con posición, el recorrido entra ahí y los siguientes se corren; después, `_renumber`. En `create`, `route_title` nombra la ruta 1 y, si no viene, se usa el título de la guía, que es lo que hace ahora.

- [ ] **Step 5: Pasar los campos por los esquemas y las rutas**

`RouteCreate.position: int | None = Field(default=None, ge=1, description=...)` y `GuideCreate.route_title: str | None = Field(default=None, min_length=1, max_length=120)`. Ambos opcionales: nada de lo que existe se rompe.

- [ ] **Step 6: Ejecutar la suite entera**

Run: `cd api && pytest test/ --cov=. --cov-fail-under=85 -q`
Expected: PASS.

- [ ] **Step 7: Regenerar contrato y tipos**

Run: `cd api && python scripts/export_openapi.py` y después `cd client && npm run types`
Expected: ambos ficheros modificados; `pytest test/test_openapi_contract.py -q` en verde.

- [ ] **Step 8: Commit**

```bash
git add api/ contracts/openapi.json client/lib/api-types.ts
git commit -m "(feat) Let a route be inserted in a place of its own"
```

---

## Tarea 4: Borrar un recorrido

**Files:**
- Modify: `api/db/guides.py` (`route_media_paths`, `delete_route`)
- Modify: `api/routers/guides.py` (endpoint nuevo)
- Regenerate: `contracts/openapi.json`, `client/lib/api-types.ts`
- Test: `api/test/test_guides_repository.py`, `api/test/test_guides_api.py`

**Interfaces:**
- Consumes: `_renumber` (Tarea 3), `guides.media_paths`, `storage.remove`.
- Produces:
  - `guides.route_media_paths(route: Route) -> list[str]`
  - `guides.delete_route(session: Session, guide: Guide, route: Route) -> None`
  - `DELETE /guides/{guide_id}/routes/{route_id}` → 204

- [ ] **Step 1: Escribir los tests que fallan**

```python
def test_deleting_a_route_takes_its_steps_with_it(db_session, make_guide):
    guide = _guide_with_routes(db_session, "Entrada", "Recepción")

    guides.delete_route(db_session, guide, guide.routes[0])

    assert [r.title for r in guide.routes] == ["Recepción"]
    assert [s.title for s in guide.steps] == ["Recepción"]


def test_deleting_a_route_renumbers_what_is_left(db_session, make_guide):
    """Sin huecos: la numeración es una sola para toda la guía."""
    guide = _guide_with_routes(db_session, "Entrada", "Recepción", "Salida")

    guides.delete_route(db_session, guide, guide.routes[0])

    assert [(s.position, s.title) for s in guide.steps] == [(1, "Recepción"), (2, "Salida")]
    assert [r.position for r in guide.routes] == [1, 2]


def test_the_last_route_of_a_published_guide_cannot_be_deleted(client, db_session, make_guide):
    """Dejaría un enlace público, quizá ya en un QR, apuntando a una guía sin nada."""
    guide = make_guide(status="published", public_slug="centro-trinidad")

    response = client.delete(f"/guides/{guide.id}/routes/{guide.routes[0].id}")

    assert response.status_code == 409


def test_one_of_several_routes_can_be_deleted_from_a_published_guide(client, db_session, make_guide):
    """Quien borra es el propio centro: ésa es la revisión humana."""


def test_the_files_go_first(client, db_session, make_guide, storage_refuses):
    """Si el almacenamiento se niega, el recorrido se queda y se puede volver a borrar, en vez de
    dejar clips y fotos de personas que ya nadie puede alcanzar."""
    response = client.delete(f"/guides/{guide.id}/routes/{route.id}")

    assert response.status_code == 502
    assert guides.get(db_session, guide.id).routes != []


def test_a_route_of_another_guide_is_not_found(client, db_session, make_guide):
    assert client.delete(f"/guides/{other.id}/routes/{route.id}").status_code == 404
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_guides_api.py -q`
Expected: FAIL con 405 Method Not Allowed.

- [ ] **Step 3: Implementar `route_media_paths` y `delete_route`**

`route_media_paths` devuelve las rutas de almacenamiento de los pasos de ese recorrido, con la misma forma que `media_paths` usa para la guía entera. `delete_route` borra el recorrido con sus pasos, llama a `_renumber` y recalcula la duración de la guía como suma de los que quedan.

- [ ] **Step 4: Añadir el endpoint**

`@router.delete("/guides/{guide_id}/routes/{route_id}", status_code=204)`, con la misma forma que `delete_guide`: **los ficheros primero** (502 si el almacenamiento se niega), después la fila. 404 si el recorrido no es de esa guía. 409 con `detail` en español si es el último recorrido de una guía publicada.

- [ ] **Step 5: Ejecutar la suite entera**

Run: `cd api && pytest test/ --cov=. --cov-fail-under=85 -q`
Expected: PASS.

- [ ] **Step 6: Regenerar contrato y tipos**

Run: `cd api && python scripts/export_openapi.py` y después `cd client && npm run types`

- [ ] **Step 7: Commit**

```bash
git add api/ contracts/openapi.json client/lib/api-types.ts
git commit -m "(feat) Delete one recording of a guide with its media"
```

---

## Tarea 5: El nivel de ruido lo dice quien graba

**Files:**
- Modify: `api/schemas.py` (`MarkIn`)
- Modify: `api/db/guides.py` (`_steps_from_marks`)
- Modify: `api/routers/guides.py:343-345` (no pisar lo manual)
- Modify: `client/app/g/sound-sheet.tsx:20-23`
- Modify: `client/lib/i18n/es.ts`
- Regenerate: `contracts/openapi.json`, `client/lib/api-types.ts`
- Test: `api/test/test_guides_api.py`, `client/test/sound-sheet.test.ts`

**Interfaces:**
- Produces:
  - `MarkIn.noise_level: NoiseLevel | None` → el paso nace con ese nivel y `noise_level_source = "manual"`.
  - `levelOf(step: Step): Level | null` en `sound-sheet.tsx` (hoy devuelve `Level`).
  - `es.publica.sound.title.unknown`.

- [ ] **Step 1: Escribir los tests que fallan**

```python
def test_the_person_recording_can_say_how_it_sounded(client, db_session):
    response = client.post("/guides", json={..., "marks": [
        {"title": "Urgencias", "category": "waiting", "marked_at_seconds": 0.0,
         "noise_level": "noisy"}]})

    step = response.json()["steps"][0]
    assert step["noise_level"] == "noisy"
    assert step["noise_level_source"] == "manual"


def test_a_measured_level_never_overwrites_what_a_person_said(db_session, make_guide):
    """Quien estuvo de pie allí sabe más que una media entre dos tomas."""
```

```ts
test("un nivel desconocido no se anuncia como tranquilo", () => {
  // La hoja de sonido ES el aviso previo de ruido: decir «bajo» sin saberlo lo rompe.
  assert.equal(levelOf({ ...step, noise_level: null }), null);
  assert.equal(levelOf({ ...step, noise_level: "noisy" }), "noisy");
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd api && pytest test/test_guides_api.py -q` y `cd client && node --test test/sound-sheet.test.ts`
Expected: FAIL — `noise_level` rechazado por `extra` en `MarkIn`, y `levelOf` devolviendo `"quiet"`.

- [ ] **Step 3: Pasar el nivel desde la marca**

`MarkIn` gana `noise_level: NoiseLevel | None = None`. En `_steps_from_marks`, un paso con nivel nace con `noise_level_source="manual"`.

- [ ] **Step 4: No pisar lo manual en la ingesta**

En `_ingest`, la medida solo se escribe si el paso no tiene ya un nivel puesto a mano.

- [ ] **Step 5: Decir «no lo sabemos» en vez de inventar**

`levelOf` devuelve `null` cuando el nivel no es uno de los tres conocidos, y la hoja usa `es.publica.sound.title.unknown` ("Este centro no ha dicho cómo suena"). Arregla además el caso que ya existe hoy: cualquier paso sin medir se anunciaba como tranquilo.

- [ ] **Step 6: Ejecutar las dos suites y regenerar**

Run: `cd api && pytest test/ --cov=. --cov-fail-under=85 -q`, `cd api && python scripts/export_openapi.py`, `cd client && npm run types && npm test`
Expected: PASS las dos.

- [ ] **Step 7: Commit**

```bash
git add api/ client/ contracts/openapi.json
git commit -m "(feat) Let the person recording say how a place sounded"
```

---

## Tarea 6: Las reglas de la lista de tomas

**Files:**
- Create: `client/lib/pure/takes.ts`
- Modify: `client/lib/pure/marks.ts` (se queda con `CATALOGUE`, `Part`, `planProblem`, `MIN_MARKS` —que `planProblem` usa— y `MAX_MARKS`)
- Test: `client/test/takes.test.ts`, `client/test/marks.test.ts`

**Interfaces:**
- Produces:
  - `type TakeState = "pending" | "recorded" | "uploading" | "sent" | "failed"`
  - `type Take = { part: Part; state: TakeState; routeId: string | null; durationSec: number | null }`
  - `takesFromParts(parts: readonly Part[]): Take[]`
  - `nextToRecord(takes: readonly Take[]): number | null`
  - `canFinish(takes: readonly Take[]): boolean`
  - `recordedCount(takes: readonly Take[]): number`
- Desaparecen: `PAUSE_MS`, `markAt`, `whyNotSendable`.

- [ ] **Step 1: Escribir los tests que fallan** en `client/test/takes.test.ts`

```ts
test("al empezar, todas las partes están pendientes y la primera es la que toca", () => {
  const takes = takesFromParts([ENTRADA, RECEPCION]);
  assert.deepEqual(takes.map((t) => t.state), ["pending", "pending"]);
  assert.equal(nextToRecord(takes), 0);
});

test("la siguiente que toca es la primera pendiente, aunque se grabara fuera de orden", () => {
  // El orden lo marca la lista, no el momento de grabar: permitirlo es menos código que prohibirlo.
});

test("se puede terminar con una sola toma grabada", () => {
  // Parar a mitad dejó de ser un error: la parte que no grabaste sencillamente no está.
  assert.equal(canFinish([recorded(ENTRADA), pending(RECEPCION)]), true);
});

test("no se puede terminar sin ninguna toma", () => {
  assert.equal(canFinish([pending(ENTRADA), pending(RECEPCION)]), false);
});

test("una toma fallida sigue contando como grabada, porque el vídeo está en el móvil", () => {
  assert.equal(canFinish([failed(ENTRADA)]), true);
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd client && node --test test/takes.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Escribir `client/lib/pure/takes.ts`**

Funciones puras sobre la lista, sin React ni cámara. Cabecera que diga por qué `canFinish` acepta una sola toma: parar a mitad dejó de ser un error.

- [ ] **Step 4: Vaciar `marks.ts` de la maquinaria de marcas**

Se borra, no se deja apagada. `MAX_MARKS` se queda como tope de partes del plan.

- [ ] **Step 5: Ejecutar y ver que pasan**

Run: `cd client && npm test && npm run typecheck`
Expected: PASS; el typecheck señala quién usaba lo borrado — eso lo arregla la Tarea 7.

- [ ] **Step 6: Commit**

```bash
git add client/lib/pure/ client/test/
git commit -m "(feat) Add the rules of the list of takes"
```

---

## Tarea 7: El grabador por partes

**Files:**
- Create: `client/app/grabar/takes.tsx` (la pantalla de la lista)
- Modify: `client/app/grabar/page.tsx` (la máquina de estados)
- Modify: `client/app/grabar/overlays.tsx` (fuera `StepRail` y el «Llegué a» del `CoachCard`)
- Modify: `client/lib/config.ts` (`maxDurationSec: 45`)
- Modify: `client/lib/i18n/es.ts`
- Test: `client/test/takes.test.ts` (ampliado), `client/test/config.test.ts`

**Interfaces:**
- Consumes: Tarea 6 entera; `createGuide`, `addRoute`, `uploadVideo` con `routeId`; `RouteCreate.position` y `GuideCreate.route_title` (Tarea 3).
- Produces: fases `lista` → `permisos` → `listo` → `grabando` → `lista`.

- [ ] **Step 1: Escribir el test que falla** en `client/test/config.test.ts`

```ts
test("una parte dura como mucho 45 segundos", () => {
  // Con una toma por parte, el límite de antes se multiplicaba por el número de partes: ocho
  // partes habrían permitido dieciséis minutos de vídeo y una llamada a Gemini por toma.
  assert.equal(RECORDING.maxDurationSec, 45);
});
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `cd client && node --test test/config.test.ts`
Expected: FAIL, `120 !== 45`.

- [ ] **Step 3: Escribir `TakesScreen`** en `client/app/grabar/takes.tsx`

La lista del diseño: una fila por parte con su estado, la acción «Grabar» en la que toca, «Repetir» en la última grabada, y el pie con «Terminar» y la cuenta. Sin animaciones ni transiciones. Usa `Door`, `Card` y los tokens que ya existen.

- [ ] **Step 4: Rehacer la máquina de estados de `page.tsx`**

`grabando` pasa a terminar en `lista`, no en `revision`. Al volver de una toma: se guarda su blob en la fila; al salir de esa parte (pulsar «Grabar» en otra o «Terminar») se envía — la primera con `createGuide` (`route_title` = nombre de la parte), las demás con `addRoute` (`position` = su sitio en el plan). Una toma con subida fallida se reintenta desde su fila. Una segunda llamada a `createGuide` nunca ocurre: si ya hay `guideId`, se reutiliza.

- [ ] **Step 5: Escribir el test del reintento y hacerlo pasar**

```ts
test("reintentar la primera toma no crea una segunda guía", () => {
  // La guía ya existe desde el primer envío: crearla otra vez dejaría una duplicada en el panel
  // del centro, con la mitad de los pasos en cada una.
  const after = sentFirstTake(takes, { guideId: "g1", routeId: "r1" });
  assert.equal(guideIdFor(after), "g1");
});
```

- [ ] **Step 6: «Terminar» no se queda esperando**

La guía ya existe, así que la pantalla final enseña qué tomas están listas y cuáles siguen
subiendo, con reintento por fila, en vez de una pantalla de carga delante de alguien que ya
terminó su trabajo. Se conserva la salida de emergencia que ya existe: si una toma no hay manera
de enviarla, `downloadGuide` la guarda en el móvil.

- [ ] **Step 7: Preguntar cómo sonaba, una vez por toma**

Al terminar la toma, la fila ofrece Tranquilo / Normal / Ruidoso. Lo elegido viaja como `noise_level` de la marca (Tarea 5). Sin respuesta, no se manda nada.

- [ ] **Step 8: Ejecutar las comprobaciones del cliente**

Run: `cd client && npm run typecheck && npm test && npm run build`
Expected: PASS las tres; ningún resto de `markAt` ni `PAUSE_MS`.

- [ ] **Step 9: Comprobarlo en el navegador**

Run: `docker compose up --build -d` y abrir `/grabar`
Expected: grabar dos partes en dos tomas, con una pausa entre ellas, y que la guía resultante tenga dos recorridos y dos pasos numerados 1 y 2.

- [ ] **Step 10: Commit**

```bash
git add client/
git commit -m "(feat) Record one take per part, when the person is ready"
```

---

## Tarea 8: Repetir una toma

**Files:**
- Modify: `client/lib/guides.ts` (`deleteRoute`)
- Modify: `client/app/grabar/page.tsx`, `client/app/grabar/takes.tsx`
- Test: `client/test/guides.test.ts`, `client/test/takes.test.ts`

**Interfaces:**
- Consumes: `DELETE /guides/{id}/routes/{id}` (Tarea 4), `RouteCreate.position` (Tarea 3).
- Produces: `deleteRoute(guideId: string, routeId: string, fetchImpl?: typeof fetch): Promise<void>`

- [ ] **Step 1: Escribir los tests que fallan**

```ts
test("deleteRoute pide el borrado de ese recorrido y acepta una respuesta vacía", async () => {
  assert.equal(calls[0].method, "DELETE");
  assert.ok(calls[0].url.endsWith("/guides/abc/routes/r1"));
});

test("repetir una toma ya enviada la devuelve a pendiente sin tocar a las demás", () => {
  // Las otras tomas no se tocan, ni las anteriores ni las siguientes.
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `cd client && node --test test/guides.test.ts test/takes.test.ts`
Expected: FAIL — `deleteRoute` no existe.

- [ ] **Step 3: Implementar `deleteRoute`** en `client/lib/guides.ts`

Igual que `deleteGuide`, que ya acepta 204 sin cuerpo.

- [ ] **Step 4: Encadenar borrado y nueva toma**

«Repetir» sobre una toma ya enviada: borrar ese recorrido, devolver la fila a `pending` con su `routeId` a `null`, y volver a grabarla; la nueva se manda con `position` = su sitio en el plan. Si el borrado funciona y la grabación nueva falla, lo que queda es una guía con una parte menos, y la pantalla lo dice.

- [ ] **Step 5: Ejecutar las comprobaciones del cliente**

Run: `cd client && npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/
git commit -m "(feat) Let any take be recorded again without dragging the others"
```
