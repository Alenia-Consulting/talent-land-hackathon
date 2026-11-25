# Traspaso — Grabar por partes

Estado de `record-one-take-per-part` a 25 de noviembre de 2026. Quien retome esto puede partir
de aquí sin haber visto la sesión anterior.

**Documentos que mandan sobre este:** `docs/superpowers/specs/2026-11-25-grabar-por-partes-design.md`
(el diseño aprobado) y `docs/superpowers/plans/2026-11-25-grabar-por-partes.md` (el plan de 8
tareas). Este fichero solo dice dónde nos quedamos y qué se decidió por el camino.

## 1. Qué problema se está arreglando

Grabar fallaba mucho. Tres síntomas, una causa y un fallo de diseño:

- **«El paso X no tiene imagen en el vídeo».** El móvil enviaba como duración el **tiempo de reloj**
  entre pulsar Grabar y Parar. El fichero casi siempre dura menos, porque el codificador termina
  antes. La API calculaba el tramo del último paso con esa cifra, el tramo caía pasado el final
  real del fichero, se leían cero fotogramas y se tiraba la subida entera.
- **«Aguanta 3 segundos quieto».** Consecuencia de cortar un vídeo largo con aritmética entre el
  reloj del móvil y el fichero.
- **Obligar a grabarlo todo seguido.** Si elegías entrada y recepción, tenías que hacer las dos de
  una tirada; parar en medio daba error. Eso es lo que rehacen las tareas 6–8: **una toma por
  parte**, con pausa entre una y otra.

## 2. Estado de la rama

`record-one-take-per-part`, cortada de `origin/development` (`2d70485`). Doce commits:

```
03ab134 (fix)  Key stored media on the step id, not its position
4bde5f7 (docs) Explain why renumbering parks positions first
774ac90 (feat) Let a route be inserted in a place of its own
68b5658 (fix)  Measure the recording only when a step needs rescuing
f2923b8 (fix)  Rescue a step whose range falls past the end of the recording
8419138 (fix)  Keep a short clip for a mark that lands past the end of the file
6236fb0 (test) Cover retiming and unmeasurable uploads through the upload endpoint
e8cf9fb (test) Patch video_io.duration in place for upload tests
dedb139 (fix)  Measure the real duration of a recording instead of trusting the phone
ef90503 (docs) Fix the plan's test fixtures and the retry rule
24b863b (docs) Fix the plan's test fixtures and the retry rule
96d291d (docs) Write down the design and the plan for recording by parts
```

Suite de `api/`: **198 tests en verde, 96,61 % de cobertura.** Contrato y tipos de TypeScript
regenerados y commiteados. Nada del front se ha tocado todavía.

`24b863b` y `ef90503` son el mismo cambio duplicado por un rebase. No pasa nada, pero si alguien
limpia la rama, ahí está.

## 3. Lo que ya está hecho (tareas 1–3)

Las tres cerradas, cada una con revisión independiente y sus arreglos verificados.

### Tarea 1 — La API mide la duración y recoloca los pasos
- `video_io.duration(video) -> float`: la longitud real del fichero, decodificándolo entero
  (`ffmpeg -i … -f null -`, último `time=`). La cabecera no sirve: un webm de MediaRecorder casi
  nunca la trae.
- `guides.retime_route(route, measured_seconds)`: mueve los pasos al tiempo real. Cada uno empieza
  en su marca y acaba en la siguiente; el último acaba al final del fichero. Recalcula
  `route.video_duration_seconds` y la suma de la guía.
- **Suelo de `MIN_STEP_SECONDS = 1.0`** (o el fichero entero si dura menos): ningún paso sale con
  `end <= start`. Sin esto, una marca pasada del final rompía el `CHECK`
  `ck_steps_clip_lasts_a_positive_time` y el endpoint devolvía un 500.
- `_ingest` llama a `retime_route` antes de construir los `timings`.

### Tarea 2 — Un paso sin fotogramas no tumba la subida
- Si un tramo no da ni un fotograma, `pipeline` vuelve a leer **el último segundo del fichero** y
  con eso hace el clip y la foto. Solo un fichero ilegible de verdad falla.
- La medición es **perezosa**: `video_io.duration` solo se llama en el camino de rescate.
  Decodifica el fichero entero, así que llamarlo por paso costaría una pasada completa por paso
  contra el objetivo de «guía lista en menos de 5 minutos».

### Tarea 3 — Un recorrido sabe en qué posición va
- `add_route(..., position: int | None = None)` y `_renumber(guide)`.
- Regla: la posición de un paso sale de recorrer los recorridos en orden y, dentro de cada uno,
  sus pasos en orden.
- `RouteCreate.position` (`ge=1`), `GuideCreate.route_title`.
- **Las rutas de almacenamiento pasan a `{guide.id}/{step.id}.ext`.** Antes eran
  `paso-{position}`, y en cuanto las posiciones se mueven, insertar un recorrido **sobrescribía el
  clip de otro paso**: el visitante vería la sala equivocada. Retrocompatible sin migración, porque
  cada fila guarda su propia ruta en `clip_path` / `photo_path` / `sound_path`.

## 4. Lo que queda (tareas 4–8)

El texto completo de cada tarea está en el plan. Para sacarlo a un fichero suelto:

```bash
bash ~/.claude/plugins/cache/claude-plugins-official/superpowers/7.0.2/skills/subagent-driven-development/scripts/task-brief \
  docs/superpowers/plans/2026-11-25-grabar-por-partes.md 4
```

| # | Qué hace | Ficheros |
|---|---|---|
| **4** | **Borrar un recorrido.** `route_media_paths`, `delete_route`, `DELETE /guides/{id}/routes/{id}` → 204 | `api/db/guides.py`, `api/routers/guides.py`, contrato |
| **5** | **El nivel de ruido lo dice quien graba.** `MarkIn.noise_level` → `noise_level_source = "manual"`; una medida posterior no lo pisa; `levelOf` pasa a devolver `Level \| null` | `api/schemas.py`, `api/db/guides.py`, `client/app/g/sound-sheet.tsx`, contrato |
| **6** | **Las reglas de la lista de tomas** (puro, sin React): `takesFromParts`, `nextToRecord`, `canFinish`, `recordedCount`, `sendPlan` | `client/lib/pure/takes.ts` (nuevo), `client/lib/pure/marks.ts` |
| **7** | **El grabador por partes.** Fases `lista → permisos → listo → grabando → lista`. `maxDurationSec: 45`. Fuera el `StepRail` y el «Llegué a» | `client/app/grabar/takes.tsx` (nuevo), `page.tsx`, `overlays.tsx`, `config.ts` |
| **8** | **Repetir una toma** sin arrastrar las siguientes. `deleteRoute` en el cliente | `client/lib/guides.ts`, `client/app/grabar/*` |

**Orden obligado:** 8 consume el `DELETE` de 4 y el `position` de 3; 7 consume la 6 entera. Las
tareas 4 y 5 son de `api/`; 6, 7 y 8 de `client/`.

**Dos PR, no uno:** tareas 1–5 (`api/`) van juntas, 6–8 (`client/`) aparte. Cada bloque cabe en las
~400 modificaciones que exige `AGENTS.md`. **Las tareas 1–3 ya pasan de 400 por sí solas**, así que
conviene abrir el PR de `api/` en cuanto la 5 esté cerrada, sin esperar al front.

### Lo que decidió el usuario en el diseño, y no se renegocia
- **Una toma por parte.** Eliges las partes, grabas la entrada, dices «ya está», y cuando estés
  listo grabas la recepción. Nada de una tirada única.
- **45 segundos** por toma.
- **El visitante puede ver cada toma por separado y además el recorrido completo**, como hasta ahora.
- **Cualquier toma se puede repetir sin arrastrar las siguientes.**
- **El nivel de ruido lo dice quien graba**, no se mide a ciegas.
- La grabación sigue mientras la pantalla siga viva.

## 5. Decisiones tomadas durante la ejecución (respetarlas)

Cada una se tomó resolviendo un conflicto real. Cambiarlas es legítimo, pero hazlo a sabiendas.

1. **Rescatar, nunca rechazar.** Un paso cuya marca cae pasada del final se queda con un clip corto
   de la cola. No se devuelve 422 pidiendo repetir la grabación: obligar a repetir una caminata
   entera por media marca tardía es *exactamente* la queja que originó este trabajo.
2. **`_renumber` solo renumera.** La suma de `guide.video_duration_seconds` vive en `add_route`,
   `retime_route` y (cuando exista) `delete_route`. Mezclarlas haría que renumerar tuviera efectos
   sobre la duración.
3. **El renumerado aparca las posiciones en negativo, hace `flush`, y luego asigna 1..n.**
   `uq_steps_guide_id_position` y `uq_routes_guide_id_position` son `UNIQUE` planas, no
   `DEFERRABLE`, así que Postgres las comprueba por sentencia y un desplazamiento 1→2, 2→3 choca.
   **SQLite no lo reproduce**, así que una suite verde no es prueba de que se pueda quitar. El
   código lleva un comentario «DO NOT REMOVE» diciendo esto.
4. **Las rutas de medios llevan `step.id`,** nunca la posición (ver Tarea 3).
5. **`video_io.duration` solo se llama en el camino de rescate.**
6. **El fixture autouse `measurable_upload`** (en `api/test/conftest.py`) parchea
   `video_io.duration` *en su sitio*, no sustituyendo el módulo. Mide los vídeos reales de verdad y
   solo sustituye cuando los bytes no son decodificables, con la constante
   `UNMEASURABLE_UPLOAD_SECONDS = 1000.0`. Los tests de subida mandan bytes de relleno que ningún
   decodificador puede medir; sin esto, 17 tests dan 422.
7. **`_encode_seconds` vive en `conftest.py` como `encode_seconds`,** compartido, no duplicado.
8. **Las pruebas que necesitan una guía con recorridos se construyen con `guides.create` y
   `guides.add_route`,** no con la fixture `make_guide`, que crea una `Guide` pelada sin recorridos.

## 6. Pendientes aparcados para la revisión final

Ninguno bloquea. Todos están verificados como reales.

**Tarea 1**
- Una marca justo al final da un paso de longitud mínima; comprobar que el cortado de clips lo
  tolera bien.
- `video_io.duration` usa `subprocess.run` **sin `timeout` y sin mirar el código de salida**. Un
  ffmpeg colgado bloquearía la petición, y un fichero parcialmente decodificable devuelve el último
  tiempo alcanzado como si fuera la duración completa. *Este es el más serio de la lista.*
- En un reintento, `start_seconds` ya viene recortado de la pasada anterior y no se puede restaurar.
- `test_a_file_shorter_than_the_floor_is_the_whole_step` no puede fallar: con `floor = 1.0` el
  resultado es idéntico sin el `min()`. No guarda nada.

**Tarea 2**
- `test_a_file_with_no_frames_at_all_is_still_a_failure` usa un fichero de 0 bytes, que
  probablemente falla antes en `video_io.target_size`, así que la rama «el rescate tampoco encontró
  nada» queda sin probar.
- Al reescribir `test_a_failure_returns_nothing_at_all` se perdió la protección de regresión de
  «si algo falla, no se devuelve nada a medias». La regla se sigue cumpliendo por construcción.
- El test del clip rescatado solo comprueba que tiene algún fotograma, no que dure ~1 segundo.

**Tarea 3**
- El test de inserción por API solo mira el índice `[0]`; no comprueba que el recorrido antiguo
  pasó a `order` 2 ni la secuencia completa.
- No hay test de que `position=0` devuelva 422.
- `_renumber` llama a `object_session(guide)`, que devuelve `None` para una guía desacoplada y
  daría un `AttributeError` opaco.

**Arrastrado a la Tarea 5:** `test_audio::test_the_level_is_relative_to_the_rest_of_the_same_recording`
**falló una vez y pasó en todas las ejecuciones siguientes.** La Tarea 5 es la dueña del nivel de
ruido: que su implementador lo investigue en vez de dar por hecho que es flaky.

## 7. Cómo retomar

El trabajo se está ejecutando con la skill `superpowers:subagent-driven-development`: un subagente
implementa cada tarea, otro la revisa, y las correcciones vuelven al mismo implementador.

```bash
git fetch origin && git checkout record-one-take-per-part
```

Y en Claude Code:

```
/superpowers:subagent-driven-development docs/superpowers/plans/2026-11-25-grabar-por-partes.md
```

La skill monta su propio cuaderno en `.superpowers/sdd/2026-11-25-grabar-por-partes/`, que **está
ignorado por git y no viaja con la rama** — por eso todo lo que hacía falta está en este fichero.
Al arrancar dirá que no hay cuaderno y empezará de cero: hay que decirle que las tareas 1 a 3 están
cerradas y que **la base de la Tarea 4 es `03ab134`**.

También se puede ejecutar a mano con `superpowers:executing-plans`, más barato y sin revisión por
tarea.

### Escollo del entorno
`api/.venv` del repo es **Python 3.11 y no puede ni recolectar la suite**: `numpy==2.5.5` exige
≥ 3.12. Hay que crear un entorno con 3.12 o superior:

```bash
cd api
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pytest test/ --cov=. --cov-fail-under=85 -q
```

Tras tocar rutas o modelos, regenerar siempre el contrato o el CI se pone rojo:

```bash
cd api && python scripts/export_openapi.py
cd client && npm run types
```

## 8. Cosas abiertas que no son código

- **Heitor tiene un PoC, «Reduce to 1 the number of sections to record», que no está en el repo y
  toca estos mismos ficheros** (`client/app/grabar/`). El plan dice preguntarle **antes** de empezar
  las tareas 6–8. No se le ha preguntado todavía. Es lo primero que hay que hacer antes de tocar el
  front, o habrá que resolver un conflicto a mano.
- El PR de la rama `find-a-place` sigue **sin abrir** porque `gh` no está autenticado
  (`gh auth login`). Esa rama lleva ~790 modificaciones escritas a mano frente a las ~400 que
  permite `AGENTS.md`, y se puede partir en dos PR encadenados.
- En el catálogo público real hay **guías de prueba** listadas (`ayyubTest`, `test4`, `testAbi`,
  `testayyoub3`, `Centro de pruebas`). Ninguna guía tiene `cover_photo_url`, y el orden del catálogo
  distingue mayúsculas de minúsculas.
