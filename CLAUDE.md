# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Idioma: la documentación de proceso está en español. El **código, los nombres de archivo, los
> commits y los Pull Request van en inglés** (regla de `AGENTS.md`).
> `AGENTS.md` manda sobre este fichero; aquí solo se concreta y se añade el contexto de producto.

## 1. Qué estamos construyendo

**Antesala — que ninguna visita sea la primera.**

Un vídeo de 1–2 minutos grabado con el móvil se convierte en una **guía de anticipación** de un
lugar (hospital, centro de salud, museo, hotel): el recorrido paso a paso con clips reales, el
sonido real de cada zona, fotos, texto en lectura fácil y audio. El establecimiento revisa,
aprueba y comparte por enlace o QR. Usuarias finales: personas autistas, familias y personas de
apoyo.

Especificación completa del producto: `docs/antesala.md`, versionado en el repositorio.
El resto de `docs/` está ignorado por git (material de trabajo, grabaciones de prueba): si añades
un documento que el equipo deba compartir, exclúyelo en `.gitignore` con `!docs/fichero.md`.

### Invariantes de producto — no negociables

Estas reglas son el producto. Si una tarea obliga a romper una, **para y pregunta antes de
implementar**:

1. **Nunca hay sonido automático.** Los clips arrancan en silencio. El sonido solo suena tras
   pulsar «Escuchar el sitio», con aviso previo del nivel de ruido y con fade-in.
2. **La IA no inventa.** Todo lo que se ve y se oye sale del vídeo real. Si un dato no aparece en
   el vídeo, el campo queda vacío para que lo rellene el establecimiento.
3. **Nada se publica sin revisión humana.** La IA genera un borrador; el establecimiento aprueba.
4. **Privacidad por defecto:** caras difuminadas en clips y fotos, audio pasado por filtro paso
   bajo (~500–800 Hz) para que las voces no se entiendan, y el vídeo original se borra tras
   procesarlo.
5. **Sin animaciones, destellos ni transiciones bruscas.** Botones grandes, siempre en la misma
   posición en todos los pasos. Nada avanza solo sin pausa entre pasos.
6. **El ruido es relativo, nunca en decibelios** (`quiet` / `medium` / `noisy`), porque el
   micrófono del móvil no está calibrado. No normalizar el volumen clip a clip: misma ganancia
   para todo el vídeo, o una sala tranquila sonará igual que una ruidosa.
7. **La fecha de la última revisión siempre visible** en la guía pública.
8. **El recorrido lo marca una persona, no la IA.** Elige las partes antes de grabar y pulsa
   «Llegué a: X» al llegar a cada una, quieta 3 segundos. La IA escribe el texto de cada paso,
   nunca decide dónde empieza ni acaba.

Objetivo de rendimiento: **guía lista en menos de 5 minutos** desde la subida.

## 2. Arquitectura

```
[Móvil]  la persona elige las partes, graba (≤ 3 min) y pulsa «Llegué a: X» al llegar a cada una
   │       vídeo  +  marcas (el segundo de cada llegada)
   ▼
[FastAPI]  POST /api/guides
   1. las marcas se vuelven pasos: cada uno va desde su marca hasta la siguiente
   2. Gemini escribe el texto de cada paso a partir de su clip (no decide el recorrido)
   3. por paso:  ffmpeg (cortar + estabilizar)
                 MediaPipe + OpenCV (difuminar caras)
                 ffmpeg + numpy (audio de zona + nivel de ruido RMS)
                 ARASAAC (pictograma, opcional)
   4. guarda la guía en estado `draft`
   │
   ▼
[Postgres] guías, pasos, estado   +   [Supabase Storage] clips, fotos, audio
   │
   ▼
[Next.js]  panel de revisión (privado)  ·  guía pública (enlace / QR)
```

### Qué existe ya y qué falta

El esqueleto está montado y verde. **Lo que falta es el producto**, no la infraestructura:

| Parte | Hoy | Falta |
|---|---|---|
| `api/` | Modelos `Guide`/`Step`, repositorio `db/guides.py`, los 6 endpoints de guías y el contrato publicado | `ai/`, `media/`, `services/`; subir el vídeo (`python-multipart`, sin confirmar) |
| `client/` | Next.js 16 (App Router) + TypeScript, export estático, config de runtime, tipos generados del contrato | Reproductor paso a paso, panel de revisión, QR |
| Base de datos | Postgres 15 en `docker-compose` y StatefulSet en staging; dos migraciones aplicadas | Lo que pida el pipeline de medios |
| Tests | 67 en `api/` (pytest) y los de `client/` (`node --test`), con los guardianes del contrato | Cobertura del pipeline |
| CI | `.github/workflows/ci-api.yaml` y `ci-client.yaml`, en PR contra `development` | — |

### Cómo entra una petición

`nginx:80` sirve el export estático de Next.js y hace proxy de `/api/` hacia `api:8000`. FastAPI
arranca con `root_path="/api"`, así que **en el código las rutas se declaran sin el prefijo**:
`@app.get("/health")` se publica como `/api/health`.

La configuración del navegador se lee **en tiempo de ejecución**, no en el build: el contenedor
escribe `/env.js` al arrancar desde sus variables `NEXT_PUBLIC_*` y el código la lee con `apiUrl()`
de `client/lib/config.ts`. Una sola imagen sirve para todos los entornos. **Todo lo que empieza por
`NEXT_PUBLIC_` llega al navegador: nunca metas ahí un secreto.**

### Capas del backend

```
api/
  main.py        # routers, nada de lógica
  db/            # SQLAlchemy: models.py, session.py  ← única capa que habla con la BD
  migrations/    # Alembic
  test/
  ai/            # (por crear) cliente Gemini y prompt de extracción de etapas
  media/         # (por crear) ffmpeg, MediaPipe/OpenCV, numpy
  services/      # (por crear) orquestación del pipeline, de una guía de principio a fin
```

Reglas duras:

- **Las rutas y la lógica de negocio llaman a `db/`, nunca a la sesión del ORM ni a SQL directo.**
  Es lo que permite mockear la base de datos en el CI, que no levanta Postgres.
- `db/session.py` no conecta al importarse: el engine se crea en el primer uso. No rompas esa
  pereza o el CI dejará de poder importar la app. En las rutas se usa
  `session: Session = Depends(get_session)`.
- Toda tabla nueva se declara en `db/models.py` (de ahí lee Alembic) y hereda `TimestampMixin`
  si es tabla de negocio. Los nombres de constraints salen de `NAMING_CONVENTION`: no los pongas
  a mano.

### Base de datos

- Postgres propio: servicio `talent-land-hackathon-postgres` en `docker-compose`, StatefulSet en
  `kubernetes/overlays/staging/postgres/`. Acceso con **SQLAlchemy 2.x + Alembic** y el driver
  `psycopg[binary]`, mediante la única variable `DATABASE_URL`.
  Para usar el Postgres de Supabase basta con cambiar `DATABASE_URL`.
- **Supabase se usa solo para Storage** (clips, fotos, audio), nunca para el esquema.
- El esquema cambia **únicamente por migraciones**: nada de `Base.metadata.create_all()`, nada de
  `ALTER TABLE` a mano, nada de editar tablas desde un panel web.
- Una migración por cambio lógico, con nombre descriptivo (`add_guide_published_at`, no `update`).
  Revisa siempre el fichero autogenerado antes de commitearlo.
- Nunca edites una migración ya mergeada a `development`: crea otra.
- `snake_case`, clave primaria en toda tabla, índice en cada clave foránea, fechas `timestamptz`
  en UTC. Pagina siempre los endpoints de listado.

## 3. Contrato de datos

`contracts/openapi.json` es la **fuente de verdad compartida**. No se escribe a mano: FastAPI lo
genera del código, y de ahí salen los tipos TypeScript del front.

```
código Python  →  app.openapi()  →  contracts/openapi.json  →  client/lib/api-types.ts
```

Cada eslabón tiene un test que falla si cambias la API y no regeneras, indicando el comando exacto.
**La explicación completa está en `contracts/README.md`**: cómo lo envía el front, qué hace el
backend con ello, los errores reales y dónde ver el Swagger (`/api/docs`).

- Claves en **inglés** por la regla «code in English» de `AGENTS.md`.
- El recorrido llega como **marcas** (`marks`), una por cada «Llegué a: X»; el backend las
  convierte en pasos. El front no calcula tramos.
- Campos que rellena Gemini: `easy_read_text`, `what_to_expect`, `who_to_ask_for_help`.
- Campos que añade el pipeline: `clip_url`, `photo_url`, `sound_available`, `noise_level`,
  `pictogram_url`.
- El contrato dice `order` donde la BD dice `position` (`ORDER` es palabra reservada en SQL).
- **Un cambio que rompa a alguien va en su propio PR** y se avisa al equipo.

## 4. Comandos

```bash
# Stack completo. api/.env es obligatorio: docker compose lo carga con env_file.
cp api/.env.example api/.env          # PowerShell: Copy-Item api/.env.example api/.env
docker compose up --build             # front :80 · API :8000/api/health · :8000/api/health/db

# Backend en local (desde api/)
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload --port 8000                 # aquí las rutas son /health, sin /api

# Migraciones (desde api/, con la BD arriba y DATABASE_URL apuntando a localhost)
alembic upgrade head
alembic revision --autogenerate -m "add_guide_published_at"   # revisa el fichero generado

# Tests backend (desde api/) — el CI exige --cov-fail-under=85
pytest test/ --cov=. --cov-report=term-missing --cov-fail-under=85
pytest test/test_session.py::test_database_url_missing         # un solo test

# Contrato, tras tocar rutas o modelos (desde api/, y luego desde client/)
python scripts/export_openapi.py     # → contracts/openapi.json
npm run types                        # → client/lib/api-types.ts

# Frontend (desde client/)
npm install
npm run dev          # http://localhost:3000, proxy a API_PROXY_TARGET (http://localhost:8000)
npm run typecheck    # next typegen && tsc --noEmit
npm run build        # export estático a client/out/, que sirve nginx
npm test             # node --test (runner nativo de Node 24), NO jest
node --test test/config.test.ts                                # un solo test
```

Todo comando de base de datos debe funcionar también desde PowerShell: se expone como script de
`npm` o comando de Python, **nunca como `.sh`**.

## 5. Reglas del repositorio que más se incumplen

De `AGENTS.md` — léelo entero una vez; esto es el recordatorio:

- **No toques** `AGENTS.md`, `.github/`, `kubernetes/` ni `docker/`. Si tu cambio los necesita,
  escribe a Pierre Bourdois o Franco Gil (`@alenia.io`) en lugar de editarlos.
- **No instales dependencias nuevas sin confirmación** del equipo (las de test y cobertura sí).
- Versiones **fijadas** `x.y.z` en `requirements*.txt` y `package.json`. Nada de `latest` ni `^`.
- Ramas desde `development`: `git checkout -b my-branch origin/development`. PR siempre contra
  `development` (es la rama que dispara el CI). `main` es producción: habla antes con Alenia.
- Commits: `(TYPE) [TICKET:] IMPERATIVE-AND-SHORT-MESSAGE` →
  `(feat) Add noise level detection to media pipeline`.
- **PR de ~400 modificaciones como máximo.** Si prevés más, divídelo.
- **Ficheros de 500 líneas como máximo.**
- Cobertura ≥ 85 %, con los tests dentro de `api/test/` y `client/test/` (fuera de ahí no cuentan)
  y con el framework de cada app: **pytest** en `api/`, **`node --test`** en `client/`.
- Secretos solo en `.env` (ignorado por git); los `.env.example` llevan los placeholders. Si se
  filtra un token, rótalo de inmediato.
- Mantén tu rama al día: `git fetch origin && git pull --rebase origin development`.

## 6. Antes de decir que algo está terminado

1. Arranca y comprueba lo que has tocado (`docker compose up --build`, o la app en local).
2. Ejecuta los tests y **pega la salida real**: `pytest test/ --cov=. --cov-fail-under=85` en
   `api/`, o `npm run typecheck && npm run build && npm test` en `client/`. No afirmes que pasan
   sin haberlos ejecutado.
3. Si tocaste rutas o modelos de `api/`, regenera contrato y tipos (§3) y commitéalos con el
   cambio. Si no, el CI se pone rojo.
4. Repasa los **invariantes de producto** de §1 si has tocado reproductor, audio, IA o medios.
5. Ningún fichero supera 500 líneas; el diff cabe en ~400 modificaciones.
6. Ningún secreto en el diff (ni en variables `NEXT_PUBLIC_*`); `docker/`, `kubernetes/`,
   `.github/` y `AGENTS.md` intactos.
