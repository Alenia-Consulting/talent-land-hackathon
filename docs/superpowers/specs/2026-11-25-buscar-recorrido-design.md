# Buscar un recorrido desde la app

Diseño corto · 25 nov 2026 · rama a crear desde `development`

## Por qué

Hoy a una guía solo se llega si alguien te manda el enlace o te enseña el QR. Quien sabe que
mañana va al Hospital X no tiene manera de entrar. La raíz de la app ni siquiera tiene puerta
para el visitante: son «Grabar», «Panel» y un health check, es decir, la casa del centro.

## Objetivos

1. Una persona abre la app, encuentra el sitio por su nombre y abre su recorrido.
2. La raíz distingue a las dos personas **por lo que vienen a hacer**, no por quiénes son.
3. Solo se ve lo publicado.

## No objetivos

- «Cerca de mí», por ciudad o mapa: `Guide` no guarda dirección ni coordenadas (otro proyecto).
- Cuentas, favoritos, historial.
- Búsqueda en el servidor: el filtro va en el navegador (ver Enfoques).

## Anti objetivos

Esto estaría mal aunque funcionase:

- Pedirle a alguien que se declare discapacitado para entrar. `lib/pure/prefs.ts` ya lleva la
  regla: «Sin diagnósticos. Se guarda solo en tu móvil… nothing in here can describe a person to
  anyone.» Además dejaría fuera a familias y personas de apoyo, que no tienen discapacidad.
- Que un borrador asome en el catálogo.
- Una caja de búsqueda vacía como primera pantalla, sin pista de qué sitios hay.
- Romper la entrada por enlace o QR, que sigue siendo la principal.

## Restricciones

- Export estático: nada de rutas `[id]`; los parámetros viajan en el query string.
- Contrato: `código → app.openapi() → contracts/openapi.json → client/lib/api-types.ts`.
- `GET /api/guides` es del panel y devuelve borradores: la ruta pública es otra, no se toca esa.
- Las rutas nunca hablan con el ORM; todo pasa por `db/guides.py`.
- Sin dependencias nuevas. Ficheros ≤ 500 líneas. Sin animaciones; objetivos grandes.

## Enfoques

**A · Catálogo con filtro (elegido).** La ruta pública devuelve las guías publicadas; la pantalla
las enseña todas y el cuadro de texto las estrecha mientras escribes. Con decenas de recorridos
enseñar el catálogo entero es mejor producto que una caja vacía, y es menos código. Cuando no
quepa en una página, B se añade encima sin romper nada.

**B · Búsqueda en el servidor** (`?q=` con `ILIKE`). Aguanta miles, pero cada tecla es un viaje y
con la caja vacía hay que decidir igualmente qué enseñar. Prematuro.

**C · Por ciudad o cerca de mí.** Pide datos que no existen (dirección o coordenadas en `Guide`,
que alguien las escriba al grabar, permiso de ubicación). Otro proyecto.

## Cómo se hace

### API

- `db.guides.list_published(session, *, limit, offset)`: `status == "published"`, ordenadas por
  `venue_name` y luego `title`. Alfabético, no por fecha: esto es un catálogo que se ojea.
- `GET /api/public/guides` → `list[PublicGuideSummary]`, `limit` por defecto 50 (máx. 200) y
  `offset`. Cuelga de `/public/`, como `/public/{slug}`.
- `PublicGuideSummary` nuevo: `title`, `venue_name`, `public_slug`, `cover_photo_url`,
  `walking_minutes`, `reviewed_at`, `language`. **Sin** `id`, `status`, `processing_status` ni
  marcas de tiempo: un visitante no tiene nada que hacer con el estado interno, y `id` es la
  llave del panel.
- Regenerar contrato y tipos.

### Cliente

- **`/` es la bifurcación**, dos tarjetas grandes: «Voy a ir a un sitio» → `/buscar`; «Soy del
  centro» → la pantalla de hoy (Grabar · Panel). El health check se va de la raíz a ese lado: es
  una herramienta de desarrollo y no pinta nada en la puerta del visitante.
- *Decisión mía:* **no se recuerda la elección.** Un toque no le cuesta nada a nadie, y no guardar
  nada encaja con la regla de `prefs.ts`. Si al centro le molesta, se recuerda entonces.
- **`/buscar`**: carga el catálogo una vez y lo pinta en tarjetas — nombre del sitio grande,
  título del recorrido debajo, foto de portada, minutos andando y fecha de revisión. Arriba, un
  cuadro de texto que lo estrecha al escribir. Cada tarjeta lleva a `/g?slug=…`, que no cambia.
- **`lib/pure/search.ts`** (nuevo, puro, con tests `node --test`): `normalize()` baja a minúsculas
  y quita acentos (NFD), y el filtro exige que **todas** las palabras aparezcan en `venue_name` o
  `title`, para que «hospital occidente» encuentre «Hospital General de Occidente».
- **Sin salidas muertas**: si no hay nada publicado, se dice. Si no cuadra el texto, se dice y se
  deja «Ver todos» a un toque.
- Sin paginación en pantalla: el endpoint pagina para que se pueda añadir después.
- Textos nuevos en `lib/i18n/es.ts`.

## Queda al criterio de quien lo construya

La redacción exacta de los textos y el detalle de la tarjeta dentro de los tokens que ya existen.
