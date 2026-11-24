# El contrato de la API

Qué hay en esta carpeta, cómo se envía una guía desde el móvil, qué hace el backend con ella y
cómo está montado para que nadie lo rompa sin enterarse.

Documento en español; el código, los campos y los commits van en inglés (`AGENTS.md`).

- [Dónde ver el contrato](#dónde-ver-el-contrato)
- [La idea en una frase](#la-idea-en-una-frase)
- [Cómo lo envía el front](#cómo-lo-envía-el-front)
- [Qué hace el backend con eso](#qué-hace-el-backend-con-eso)
- [Lo que el backend impone, no la UI](#lo-que-el-backend-impone-no-la-ui)
- [Errores](#errores)
- [Los demás endpoints](#los-demás-endpoints)
- [Cómo está montado para que no se rompa](#cómo-está-montado-para-que-no-se-rompa)
- [Si cambias la API](#si-cambias-la-api)

## Dónde ver el contrato

| Quieres… | Ve a |
|---|---|
| Probar endpoints a mano | `http://localhost/api/docs` (Swagger UI) |
| Leerlo como referencia | `http://localhost/api/redoc` |
| El JSON, sin levantar nada | [`contracts/openapi.json`](openapi.json) |
| Los tipos en TypeScript | `client/lib/api-types.ts` |

Para las dos primeras hace falta `docker compose up --build`. Las dos últimas están en el
repositorio: no necesitas arrancar el backend.

**Ninguno de esos ficheros se escribe a mano.** Salen del código de `api/`, así que no pueden
mentir. Más abajo se explica cómo.

## La idea en una frase

La IA **no** decide el recorrido. La persona elige las partes antes de grabar y pulsa
«Llegué a: X» al llegar a cada una. Esas pulsaciones —las **marcas**— son lo que el móvil envía,
y el backend las convierte en los pasos de la guía.

```
[Móvil]  marcas: "Entrada" 0s · "Recepción" 12s · "Salida" 40s
    │
    ▼  POST /api/guides
[Backend]  cada marca → un paso que dura hasta la marca siguiente
    │
    ▼  guía en borrador, sin textos y sin medios
[Panel]  Gemini escribe · una persona revisa y completa · aprueba
    │
    ▼  POST /api/guides/{id}/publish
[Visitante]  GET /api/public/{slug}
```

## Cómo lo envía el front

`POST /api/guides`, con `Content-Type: application/json`:

```json
{
  "title": "Recorrido principal",
  "venue_name": "Clínica Dental Alameda",
  "video_duration_seconds": 48.0,
  "marks": [
    { "title": "Entrada",   "category": "entrance",  "marked_at_seconds": 0 },
    { "title": "Recepción", "category": "reception", "marked_at_seconds": 12 }
  ]
}
```

| Campo | Regla |
|---|---|
| `title` | El nombre de **esta guía**, no del centro: «Recorrido principal», «Sala de rayos X». 1–120 caracteres |
| `venue_name` | El centro. 1–200 caracteres |
| `video_duration_seconds` | Mayor que 0, y mayor que la última marca |
| `marks` | Entre 2 y 12, en orden y **estrictamente crecientes** en el tiempo |
| `marks[].title` | Cómo lo llamó la persona: «Recepción». 1–60 caracteres |
| `marks[].category` | `entrance`, `reception`, `waiting`, `corridor`, `appointment`, `restroom`, `exit`, `other` |
| `marks[].marked_at_seconds` | Segundo del vídeo en el que se pulsó «Llegué a: X». Nunca negativo |
| `language` | Opcional, `"es"` por defecto |

El vídeo **todavía no se sube aquí**: hace falta `python-multipart`, pendiente de confirmar con el
equipo. Hoy solo viajan las marcas.

## Qué hace el backend con eso

### 1. Valida la forma — `api/schemas.py`

Pydantic rechaza lo que no encaje con el contrato antes de que llegue a la lógica: tipos, longitudes,
categorías que no existen. Es lo mismo que Swagger muestra, porque Swagger se genera de aquí.

### 2. Convierte las marcas en tramos — `api/db/guides.py`

```
marca 0s ──────────► marca 12s ──────────► fin del vídeo 48s
└─ paso 1: 0 → 12 ──┘└─ paso 2: 12 → 48 ──┘
```

- `start_seconds` es la marca.
- `end_seconds` es la **marca siguiente**; el último paso llega hasta el final del vídeo.
- `photo_second` cae a la mitad de la pausa de 3 segundos que la app pide al llegar, porque ahí el
  móvil está quieto y el fotograma sale limpio. Si un paso dura menos que la pausa, se recorta para
  no salirse del clip.

### 3. Guarda un borrador sin inventar nada

La respuesta real de ese `POST`, recortada a un paso:

```json
{
  "id": "ce0de518-c160-4add-bf1b-87a608456afb",
  "title": "Recorrido principal",
  "status": "draft",
  "public_slug": null,
  "video_duration_seconds": 48.0,
  "steps": [
    {
      "id": "449e58d1-6156-403b-8bdd-82c29f3d57cd",
      "order": 2,
      "title": "Recepcion",
      "start_seconds": 12.0,
      "end_seconds": 48.0,
      "photo_second": 13.5,
      "easy_read_text": null,
      "what_to_expect": [],
      "who_to_ask_for_help": null,
      "duration_text": null,
      "category": "reception",
      "interests": [],
      "missing_fields": [],
      "reviewed": false,
      "clip_url": null,
      "photo_url": null,
      "sound_available": false,
      "noise_level": null,
      "noise_level_source": null,
      "pictogram_url": null
    }
  ],
  "pending": { "steps_total": 2, "steps_reviewed": 0, "missing_data": 2 }
}
```

Fíjate en todos esos `null`: **no son un error, son el punto**. Gemini aún no ha escrito el texto y
el pipeline de medios no ha cortado nada. El contrato prefiere el hueco a un dato inventado.

**`order`, no `position`.** En la base de datos la columna se llama `position`, porque `ORDER` es
palabra reservada en SQL. El contrato expone `order`, y Pydantic hace la traducción. Si ves
`position` en una respuesta, es un bug.

**`missing_data: 2` con `missing_fields: []`.** No se contradicen: `missing_data` cuenta los pasos
a los que les falta algo para publicar, y aquí les falta el texto. `missing_fields` es la lista de
huecos que la IA dejó marcados para que los rellene el centro («Falta: a quién pedir ayuda»), y
todavía está vacía porque la IA no ha pasado.

### 4. El panel completa y aprueba

`PATCH /api/guides/{id}/steps/{step_id}` con solo los campos que cambian:

```json
{ "who_to_ask_for_help": "La persona del mostrador azul", "noise_level": "noisy", "reviewed": true }
```

Devuelve la guía entera, con `pending` recalculado. Si tocas `noise_level`, el backend pone
`noise_level_source: "manual"` solo: así el panel distingue el valor **medido** del corregido a mano.

### 5. Se publica

`POST /api/guides/{id}/publish` genera el `public_slug` a partir del nombre del centro
(«Clínica Dental Alameda» → `clinica-dental-alameda`, con sufijo si ya existe), marca
`reviewed_at` y abre el enlace público.

## Lo que el backend impone, no la UI

Estas dos reglas viven en el backend **a propósito**. Si estuvieran solo en la pantalla, bastaría
una llamada directa a la API para saltárselas.

1. **No se publica nada incompleto.** `publish` devuelve `409` mientras algún paso esté sin revisar
   o le falte un dato. Es la misma condición que mantiene el botón «Aprobar y publicar»
   deshabilitado, pero comprobada donde no se puede esquivar.
2. **El enlace público nunca sirve un borrador.** `GET /api/public/{slug}` filtra por estado
   publicado en la propia consulta, y devuelve **el mismo 404 y el mismo mensaje** tanto si el slug
   no existe como si existe pero está sin aprobar. Quien pruebe slugs a ver qué pilla no aprende
   nada sobre trabajo sin publicar.

## Errores

| Código | Cuándo | Cuerpo real |
|---|---|---|
| `422` | El JSON no encaja con el contrato | `{"detail":[{"type":"literal_error","loc":["body","marks",0,"category"],"msg":"Input should be 'entrance', 'reception', …"}]}` |
| `422` | El JSON encaja pero la regla no | `{"detail":"marks must move forward in time"}` |
| `409` | Publicar algo incompleto | `{"detail":"the guide is not ready to publish"}` |
| `404` | No existe, o es un borrador en el enlace público | `{"detail":"guide not found"}` |
| `404` | El `step_id` no es de esa guía | `{"detail":"step not found"}` |

Los dos `422` tienen forma distinta y conviene saberlo: el de Pydantic trae una **lista** en
`detail` con la ruta exacta del campo malo, perfecta para pintar el error junto al input. El de
regla de negocio trae un **string**.

## Los demás endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/api/guides` | Crear desde las marcas. Devuelve `201` |
| `GET` | `/api/guides` | Listado del panel, más recientes primero. `limit` 1–100, `offset`. Sin pasos |
| `GET` | `/api/guides/{id}` | Detalle para el panel, borradores incluidos. Trae `pending` |
| `PATCH` | `/api/guides/{id}/steps/{step_id}` | Correcciones del centro |
| `POST` | `/api/guides/{id}/publish` | Aprobar y abrir el enlace |
| `GET` | `/api/public/{slug}` | Lo que abre el visitante. Solo publicadas; `pending` llega a `null` |

Todo cuelga de `/api` porque nginx hace de proxy; en el código de `api/` las rutas se declaran sin
ese prefijo (`root_path="/api"`).

## Cómo está montado para que no se rompa

El contrato no se mantiene: **se deriva**. FastAPI construye el OpenAPI leyendo las rutas y los
modelos Pydantic en el momento, así que cambiar el código cambia el contrato al instante.

```
código Python  →  app.openapi()  →  contracts/openapi.json  →  client/lib/api-types.ts
                        ↑                    ↑                          ↑
                 test en api/          test en api/             test en client/
```

Cada eslabón tiene un test que compara **lo guardado** con **lo que el código produce ahora**:

```python
# api/test/test_openapi_contract.py
assert published == app.openapi(), f"the API changed: {REGENERATE}"
```

```ts
// client/test/api-types.test.ts
assert.equal(readFileSync("lib/api-types.ts", "utf8").trim(), generate().trim(), …);
```

Si cambias la API y no regeneras, el CI de `api/` se pone rojo. Si regeneras el contrato pero no
los tipos, se pone rojo el de `client/`. Y como regenerar deja el cambio **en el diff del PR**, tus
compañeros ven que el contrato se movió durante la revisión, en vez de enterarse cuando se les
rompa la pantalla.

> **Rendija conocida:** `ci-client.yaml` solo se dispara con `paths: client/**`. Si alguien cambia
> `api/` y `contracts/` sin tocar `client/`, el desfase de tipos no salta hasta que el front
> compile. Se arregla añadiendo `contracts/**` a esos `paths`, y `.github/` es carpeta protegida:
> hay que pedírselo al equipo técnico de Alenia.

## Si cambias la API

```bash
# 1. Desde api/, tras tocar rutas o modelos
python scripts/export_openapi.py

# 2. Desde client/, para que los tipos sigan al contrato
npm run types

# 3. Commitea los dos ficheros generados junto a tu cambio
git add contracts/openapi.json client/lib/api-types.ts
```

Si se te olvida, el test te lo dirá con el comando exacto que falta. No hace falta recordarlo.

Un cambio que rompe a alguien (quitar un campo, renombrarlo, volverlo obligatorio) va **en su
propio PR** y se avisa por el canal del equipo, porque hay gente construyendo contra la forma
anterior.
