# Cómo trabajamos en Antesala

Procedimiento de equipo para el hackathon. Las reglas de la organización están en
[`AGENTS.md`](AGENTS.md); el contexto técnico del proyecto, en [`CLAUDE.md`](CLAUDE.md).
Documentación en español, **código y commits en inglés**.

## 1. Reparto y propiedad del código

Seis personas sobre el mismo repositorio. Cada rol es dueño de unas carpetas: si necesitas tocar
las de otra persona, avísale antes. Así evitamos conflictos de merge en 48 horas.

| # | Rol | Entregable | Carpetas que posee |
|---|---|---|---|
| 1 | IA y API | `POST /api/guides`: vídeo → JSON de etapas | `api/ai/`, `api/services/`, `api/main.py` |
| 2 | Procesado de medios | Clips, sonido, caras, ruido, pictogramas | `api/media/` |
| 3 | Guía de la persona usuaria | Reproductor paso a paso, sonido, voz, recorrido completo | `client/app/` (guía pública) |
| 4 | Panel, integración y despliegue | Subir, editar, aprobar, QR, todo desplegado | `client/app/` (panel), `api/db/`, `api/migrations/` |
| 5 | Producto y validación | Pruebas con personas usuarias, lectura fácil, RGPD, licencias | `docs/` |
| 6 | Pitch y coordinación | Presentación, plan B de la demo, control del tiempo | — |

**Compartido por todos:** `contracts/openapi.json`, generado del código de `api/` (lee
`contracts/README.md`). Es lo único que rompe a varias personas a la vez: un cambio que rompa va
en su propio PR y se avisa por el canal del equipo.

### Primer día

- Roles 1 y 3: el contrato ya está publicado en `contracts/openapi.json`, con los tipos
  TypeScript en `client/lib/api-types.ts` y el Swagger en `/api/docs`. Construid contra eso.
- Roles 5 y 6: grabar **2–3 vídeos de prueba** reales (recorrido andando despacio, poca gente).
- Rol 4: el esqueleto ya despliega. Toca la **primera migración real** (`guides` y `steps` en
  `api/db/models.py`), que desbloquea a los roles 1 y 3.

## 2. Ciclo de trabajo

```bash
# 1. Partir siempre de development actualizado
git fetch origin
git checkout -b add-noise-detection origin/development

# 2. Trabajar en commits pequeños
git commit -m "(feat) Add RMS noise level calculation"

# 3. Mantener la rama al día (a diario, mínimo)
git pull --rebase origin development
#    Si hay conflicto, acepta los cambios nuevos de la rama padre.

# 4. Subir y abrir PR contra development
git push -u origin add-noise-detection
```

Una rama por feature o fix. **Nunca** se trabaja directamente sobre `development` ni `main`.
Cuando el PR se mergea y la funcionalidad se valida, borra la rama.

`main` significa producción: hay que hablar antes con el equipo técnico de Alenia.

### Mensajes de commit

`(TYPE) [TICKET:] IMPERATIVE-AND-SHORT-MESSAGE`, en inglés:

```
(feat) Add face blurring to the media pipeline
(fix) Prevent autoplay when the step has sound
(chore) Pin ffmpeg-python to 0.2.0
(docs) Describe the guide JSON contract
```

## 3. Pull Requests

- Contra `development`, nunca contra `main`.
- **~400 modificaciones como máximo.** Si prevés más, divídelo en varios PR.
- Un PR hace una cosa. No mezcles refactor con feature.
- ¿Primer PR? Pide guía al equipo técnico de Alenia antes de abrirlo.

Plantilla para la descripción (cópiala a mano: `.github/` es carpeta protegida y no la tocamos):

```markdown
## Qué hace
Una o dos frases.

## Cómo probarlo
1. ...
2. ...

## Checklist
- [ ] Tests pasados, con la salida pegada abajo
- [ ] Cobertura ≥ 85 % (`--cov-fail-under=85` en el CI de `api/`)
- [ ] Ningún fichero supera 500 líneas
- [ ] No toco docker/, kubernetes/, .github/ ni AGENTS.md
- [ ] Sin secretos en el diff
- [ ] Si toco reproductor, audio, IA o medios: repasados los invariantes de producto de CLAUDE.md §1
```

## 4. Definición de «hecho»

Una tarea está terminada cuando:

1. Funciona al arrancar la app de verdad, no solo en los tests.
2. Pasan los tests y se pega **la salida real** en el PR:
   `pytest test/ --cov=. --cov-fail-under=85` en `api/`, o `npm run typecheck && npm run build &&
   npm test` en `client/`. La cobertura queda en ≥ 85 %.
3. Los tests viven en `api/test/` o `client/test/`, con el framework de cada app: **pytest** en
   `api/` y **`node --test`** (runner nativo de Node 24, no jest) en `client/`. Fuera de esas
   carpetas no cuentan.
4. Está mergeado a `development` y visible en staging.

Si algo no está, se dice. No damos por buena una funcionalidad sin haberla ejecutado.

## 5. Accesibilidad: lo que revisamos siempre

Antes de mergear cualquier cosa que toque la guía pública, comprueba los **invariantes de
producto** de [`CLAUDE.md`](CLAUDE.md) §1. Los tres que más se escapan:

- Ningún clip arranca con sonido. Nunca.
- Aviso del nivel de ruido **antes** de que suene, y fade-in.
- Sin animaciones ni transiciones bruscas; botones grandes en la misma posición en todos los pasos.

El rol 5 valida la lectura fácil. Antesala genera un primer borrador, **no sustituye la validación
de la norma UNE 153101**.

## 6. Datos, privacidad y licencias

- El vídeo original **se borra** tras procesarlo. Solo se conservan clips y fotos con caras
  difuminadas y audio filtrado.
- Al grabar: poca gente y cartel de aviso en el sitio.
- **ARASAAC** es CC BY-NC-SA: hay que citar la autoría y **no permite uso comercial** sin permiso.
  Para el modelo B2B hace falta autorización o pictogramas propios. El rol 5 lo gestiona.
- Secretos solo en `api/.env` (ignorado por git). `api/.env.example` lleva los placeholders.
  Si se filtra un token, se rota inmediatamente.

## 7. La demo (90 segundos)

| Tramo | Qué se enseña |
|---|---|
| 20 s | El problema: una guía hecha a mano que costó semanas a un hospital |
| 40 s | En directo: grabamos de la puerta a la mesa del jurado, subimos y aparece el recorrido |
| 15 s | Revisión: corregimos una frase, aprobamos, aparece el QR |
| 15 s | Usuario: el jurado escanea el QR y pulsa «Escuchar el sitio» |

**Plan B:** vídeo grabado de la demo completa, por si fallan la wifi o la API. Lo prepara el rol 6
y tiene que estar listo **antes** de la última noche.

Cierre: *«Lo que hoy cuesta semanas a un hospital, ahora cuesta 5 minutos. Antesala: que ninguna
visita sea la primera.»*

## 8. Si te atascas

- Dudas de infraestructura, CI, Docker o Kubernetes, o necesitas tocar una carpeta protegida:
  Pierre Bourdois o Franco Gil (`@alenia.io`).
- ¿Necesitas que alguien pruebe la UI o la API? Canal **Alenia All** en Microsoft Teams.
