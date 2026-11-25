# Grabar por partes: una toma por sitio

Diseño · 25 nov 2026

## Por qué

Grabar falla demasiado, y cada fallo cuesta una vuelta entera andando por un hospital. Hoy el
grabador obliga a una sola toma continua: eliges las partes, pulsas Grabar una vez, y vas
marcando «Llegué a: X» mientras caminas, quieta tres segundos en cada llegada. Si paras a mitad,
si marcas la última parte justo antes de parar, o si el encoder acaba un poco antes de lo que
dice el reloj, se pierde la grabación entera.

La persona que graba es el cuello de botella del producto. Que una grabación falle no es un error
técnico: es un centro que decide no volver a intentarlo.

### Los tres fallos, que son el mismo

1. **«El paso X no tiene imagen en el vídeo»** (`api/media/pipeline.py:99`). El móvil envía como
   duración el **tiempo de reloj entre pulsar Grabar y Parar** (`performance.now()`, en
   `client/lib/useRecorder.ts:67`), no la duración real del fichero. El encoder casi siempre acaba
   antes: tarda en arrancar y pierde fotogramas. La API se fía de ese número, calcula que el
   último paso va desde su marca hasta ese final, y pide un tramo que ya no existe en el fichero.
   Cero fotogramas, y la subida entera se cae.

2. **Los tres segundos quieto** (`PAUSE_MS`, `client/lib/pure/marks.ts`) existen únicamente para
   que haya fotogramas limpios que recortar en un vídeo que hay que cortar. El botón «Parar»
   queda bloqueado mientras dura la pausa.

3. **«Repite la grabación»** al parar a mitad (`whyNotSendable`) es la consecuencia de 1 y 2: si
   la última marca cae a menos de tres segundos del final, ese paso se quedaría sin foto, y la
   única salida que ofrece el producto es repetirlo todo.

Los tres salen de la misma decisión: **un vídeo que hay que cortar en trozos usando aritmética
entre el reloj del móvil y el fichero**. Si cada parte es su propia toma, no hay nada que cortar.

## Qué se construye

Una lista de partes donde cada una se graba cuando la persona está lista, por separado, en el
orden del recorrido.

```
  Hospital Trinidad · Recorrido principal
  ─────────────────────────────────────────
  ✓  1 Entrada          18 s · Repetir
  ●  2 Recepción        [ Grabar ] ▸
  ○  3 Sala de espera
  ─────────────────────────────────────────
  [ Terminar ]        1 de 3 grabadas
```

Pulsas «Grabar» en la parte que toca, se abre la cámara, grabas, pulsas Parar y vuelves a la
lista. Esa fila queda grabada y se sube mientras caminas a la siguiente. No hay marcas, ni
«Llegué a», ni pausa obligatoria, ni cortar nada: **la toma entera es la parte**, y la foto sale
de su mitad.

Una parte que no grabes sencillamente no está en la guía. Puedes volver otro día y añadirla: el
grabador ya sabe entrar con `?guia=ID` sobre una guía que existe.

## Objetivos

- Grabar una parte, pararla, y decidir cuándo empieza la siguiente.
- Que ninguna grabación ya hecha se pierda por un fallo en otra: un fallo afecta a una fila y se
  reintenta esa fila.
- Que desaparezca la clase entera de fallos de recorte: sin marcas no hay aritmética que falle.
- Que las guías ya grabadas dejen de romperse por la duración mal medida.
- Guía lista en menos de 5 minutos desde que se termina (invariante de producto).

## No objetivos

- **Cambiar lo que ve el visitante.** Ya es correcto: por defecto ve todos los pasos seguidos
  (`stepsOfRoute(steps, null)`), y si la guía tiene varias tomas puede elegir una
  (`hasSeveralRoutes`). Esa es exactamente la petición: cada toma por separado y el recorrido
  entero.
- **El filtro del sonido y cómo se mide el ruido.** `audio.py` no se toca: lo que cambia es
  quién responde cuando no hay medida. Ver «El nivel de ruido».
- **La insignia de estado del panel.** Con varias tomas por guía gana sentido que cuente tomas
  listas, pero eso es trabajo del panel.
- **Borrar un recorrido desde el panel.** El endpoint que se añade aquí sirve para eso, pero la
  pantalla del panel es trabajo aparte: aquí solo lo usa el grabador para repetir una toma.
- Tocar `docker/`, `kubernetes/`, `.github/` ni `AGENTS.md`.

## Anti-objetivos

Cosas que harían fracasar esto aunque funcione:

- Que una toma ya grabada se pierda **con el grabador abierto**. Mientras la pantalla siga viva
  se reintenta la subida, y si no hay manera se ofrece descargar el vídeo al móvil, que ya existe.
  Cerrar la pestaña sí pierde lo que no se haya subido: guardar las tomas en el propio móvil
  (IndexedDB) y recuperarlas al volver a entrar es más trabajo que todo el resto del cambio, y se
  deja fuera a propósito. La pantalla lo dice en vez de prometer lo que no cumple.
- Cualquier aritmética nueva entre el reloj del móvil y el fichero de vídeo. La causa raíz actual
  es exactamente eso; sustituirla por otra versión del mismo truco no arregla nada.
- Romper los invariantes de producto: nada de sonido automático, nada de animaciones ni
  transiciones bruscas, botones grandes en la misma posición, y la IA no decide el recorrido.
- Un flujo que exija cobertura continua. Si se cae la red a mitad del pasillo, lo grabado se
  queda en el móvil y se reintenta.

## Restricciones

- **Safari de iPhone y Chrome de Android.** `MediaRecorder` se comporta distinto en cada uno; es
  lo que ya sufre el código actual.
- **`AGENTS.md`:** dependencias nuevas solo con confirmación del equipo; ficheros de 500 líneas
  como máximo; PR de ~400 modificaciones; tests dentro de `api/test/` (pytest) y `client/test/`
  (`node --test`); cobertura ≥ 85 %.
- **Contrato:** `contracts/openapi.json` y `client/lib/api-types.ts` se regeneran desde el código,
  nunca a mano.
- **Coordinación:** Heitor está trabajando ahora mismo en `routes` (PRs #24–#27 y el PoC que
  reduce a 1 las secciones a grabar). Este cambio se apoya en su modelo sin modificarlo, pero hay
  que avisarle antes de empezar.

## Caminos considerados

**A — Lista de partes, una toma por parte (elegido).** Cada toma es un `Route` con una sola marca
en el segundo 0, de modo que su paso abarca la toma entera. Usa la API tal y como está hoy.
*A favor:* ataca los tres fallos en la raíz; un fallo pasa de perder la sesión a perder una fila;
el visitante obtiene las dos vistas sin trabajo extra. *En contra:* una pulsación de grabar/parar
por parte en lugar de una por recorrido; casi todas las guías pasan a tener varias tomas, así que
el selector de la portada aparecerá mucho más a menudo.

**B — Lista de partes, todo se sube al final.** Igual, con una sola barra de progreso.
*En contra:* la persona espera al final en vez de mientras camina, y un fallo de subida se lleva
la sesión entera en vez de una fila. Descartado: el reintento por fila es la mitad del valor.

**C — Seguir con una sola toma continua**, quitando la pausa de 3 s y arreglando la duración.
Es el cambio más barato. Descartado por dos razones: no da grabar la entrada y la recepción por
separado, que es lo que se pidió, ni deja al visitante ver cada toma; y pausar entre partes
exigiría `MediaRecorder.pause()`, irregular en Safari de iPhone, que además mete huecos en la
línea de tiempo que las marcas no conocen — cambiaría unos fallos de cuentas por otros.

## Cómo se hace

### 1. La API mide la duración, no se la cree

`media/video_io.py` ya abre el fichero para leer fotogramas. La duración real se mide ahí y es la
que manda:

- Al recibir el vídeo, la API mide la duración del fichero y esa medida **sustituye** al número
  del móvil: no solo lo recorta. El reloj del móvil puede quedarse corto además de largo — al
  llegar al tope de 120 s, `useRecorder` guarda exactamente 120 mientras el fichero puede durar
  120,4 — y recortar solo hacia abajo perdería esa cola en silencio.
- La medida **se persiste**: en `route.video_duration_seconds` y en la suma que la guía mantiene.
  Son los números que lee el panel y los que acompañan a `walking_minutes` en la portada pública;
  dejarlos con la cifra del móvil sería arreglar el corte y seguir enseñando el dato falso.
- **`photo_second` se recalcula en la ingesta** al centro del paso, cuando ya se conoce la
  duración real. Hoy lo fija `_steps_from_marks` como «marca + 1,5 s», que con una marca en el
  segundo 0 pone la portada en el segundo 1,5 de la toma: el instante justo después de pulsar
  Grabar, con el móvil todavía moviéndose, y ya sin los tres segundos de quietud que antes
  garantizaban un fotograma limpio.
- Si un paso se queda sin fotogramas, se usa **el último fotograma legible del fichero** en lugar
  de tirar la subida entera. Una foto de un segundo antes es infinitamente mejor que perder la
  grabación.
- Lo que **no** se rescata: un paso sin ningún fotograma no se queda con un clip vacío. Un mp4 de
  cero fotogramas es una tarjeta rota en el reproductor, peor que un error honesto. Si el fichero
  entero no da ni un fotograma, eso sí es `ProcessingFailed`.

Esto se arregla **aunque no se tocase nada más**, porque también muerde a las guías ya grabadas.
Va primero y por separado.

### 2. Una toma es una parte

Cada toma se envía como un `Route` con **una sola marca, en el segundo 0**. `add_route` ya numera
los pasos continuando la numeración de la guía, así que «paso 3 de 7» sigue significando algo.

- La primera toma crea la guía (`POST /guides`), las siguientes la amplían
  (`POST /guides/{id}/routes`), y cada una sube su vídeo a su propia ruta.
- **El orden lo marca la lista, no el momento de grabar.** Cada toma lleva su posición, que es
  su sitio en el plan. La pantalla te lleva por ellas en orden, porque es un recorrido y se anda
  de la entrada a la recepción, pero una parte grabada fuera de orden cae en su sitio igual.
  Permitirlo es menos código que prohibirlo.
- El título de la ruta es el nombre de la parte («Entrada»), que es lo que el visitante verá en el
  selector. Para la primera toma hace falta un campo opcional `route_title` en `GuideCreate`,
  porque hoy `create` nombra la ruta 1 con el título de la guía. Es aditivo: no rompe a nadie,
  pero regenera el contrato.

### 3. Cuándo se sube cada toma

**Al salir de esa parte**: cuando se pulsa «Grabar» en la siguiente o «Terminar». Hasta entonces
la fila ofrece «Repetir».

El único momento en que alguien quiere repetir una toma es justo después de hacerla; esperar a
ese momento cuesta nada y sigue solapando la subida con la caminata a la siguiente parte. Se puede
ver lo grabado pulsando la fila.

### 4. Lo que desaparece

Con A sobra toda la maquinaria de marcas del grabador: `PAUSE_MS`, `markAt`, `whyNotSendable`, la
pausa obligatoria, el `StepRail`, y el «Llegué a: X» del `CoachCard`. Se borra, no se deja
apagada: sostener dos caminos de grabación es el doble de superficie donde fallar.

Las marcas siguen existiendo en el contrato y en la API —cada toma manda una— y las guías
grabadas antes con varias marcas por vídeo se siguen leyendo igual.

### 5. Mientras una toma se sube

El estado de cada fila sale de `routes[].processing_status`, que ya está en el contrato. La guía
irá pasando por `pending → processing → done` una vez por toma; eso ya ocurre hoy al añadir
recorridos y no se toca.

**«Terminar» no se queda esperando** a que acabe la última subida: la guía ya existe, y la
pantalla final enseña qué tomas están listas y cuáles siguen subiendo, con reintento por fila. Lo
contrario sería una pantalla de carga delante de una persona que ya ha terminado su trabajo.

La insignia de estado del panel se queda como está. Que diga «3 de 5 tomas listas» es una mejora
del panel, no de este cambio.

### 6. El nivel de ruido lo dice quien graba

Con una toma por parte, `audio.classify` se queda sin con qué comparar: necesita dos sitios
medidos en la misma llamada y ahora recibe uno, así que devuelve vacío para todos. Eso no es «un
dato menos»: `levelOf` (`client/app/g/sound-sheet.tsx:22`) convierte vacío en `quiet`, de modo que
la hoja que **es** el invariante 1 anunciaría «este sitio es tranquilo» justo antes de reproducir
el ambiente real de urgencias. Rompe el aviso de ruido y rompe «la IA no inventa».

Dos cambios, y ninguno toca `audio.py`:

- **Al terminar cada toma, la fila pregunta cómo sonaba**: Tranquilo / Normal / Ruidoso, un toque.
  Se guarda con `noise_level_source = "manual"`, que el modelo ya distingue de `measured`. Lo dice
  quien estuvo de pie allí, que sabe más que una media entre dos tomas cuyo micro ajustó la
  ganancia por su cuenta. `MarkIn` gana un `noise_level` opcional para que viaje con la toma.
- **Un nivel desconocido se dice, no se maquilla.** `levelOf` deja de inventar `quiet`, y la hoja
  tiene un cuarto texto para cuando no se sabe. Esto arregla además un fallo que ya existe hoy:
  cualquier paso cuyo nivel no se pudo medir se anuncia como tranquilo.

Si la persona no contesta, el nivel queda vacío y el centro puede ponerlo desde el panel, que ya
edita ese campo. Vacío es una respuesta honesta; `quiet` inventado no lo es.

### 7. Cuánto dura una parte

El límite pasa de 120 segundos por grabación a **45 segundos por parte**. Con una toma por parte,
el límite de antes se multiplicaba por el número de partes: una guía de ocho habría permitido
dieciséis minutos de vídeo, con una llamada de vídeo a Gemini por toma, y eso no cabe en el
objetivo de «lista en menos de 5 minutos» ni en una factura razonable.

Una parte es una entrada, un mostrador, una sala: 45 segundos sobran para enseñarla andando, y
ocho partes siguen cabiendo en seis minutos de vídeo.

### 8. Lo que no cambia

Los avisos de luz y movimiento, el límite de duración y de tamaño, la cámara, el difuminado de
caras, el borrado del vídeo original, la pantalla de permisos y el panel.

## Qué pasa si una toma sale mal

Una toma recién grabada que todavía está en el móvil se repite sin más: se descarta y se vuelve a
grabar. Una que ya llegó a la API necesita borrarse, y para eso hace falta un endpoint que hoy no
existe: la API solo sabe borrar guías enteras.

### `DELETE /guides/{guide_id}/routes/{route_id}` → 204

Copia la forma de `delete_guide`, que ya resuelve el mismo problema: **los ficheros primero**. Si
el almacenamiento se niega, el recorrido se queda y se puede volver a borrar, en lugar de dejar
clips y fotos de personas que ya nadie puede alcanzar. Responde 502 si el almacenamiento falla,
igual que el borrado de guías.

Decisiones que tomo yo, por si hay que discutirlas:

- **Los pasos que quedan se renumeran desde 1**, y las posiciones de los recorridos también. La
  numeración es una sola para toda la guía precisamente para que «paso 3 de 7» signifique algo;
  dejar huecos la rompería.
- **No se puede borrar el último recorrido de una guía publicada** → 409. Dejaría un enlace
  público, posiblemente ya impreso en un QR, apuntando a una guía sin nada que enseñar. Borrar
  uno de varios sí se permite: quien lo hace es el propio centro, que es la revisión humana que
  pide el invariante.
- **La duración de la guía se recalcula** como suma de los recorridos que quedan, igual que hace
  `add_route`.

### Un recorrido sabe en qué posición va

Para que se pueda repetir **cualquier** toma sin arrastrar las que vinieron después, un recorrido
nuevo tiene que poder entrar en un hueco concreto en vez de añadirse siempre al final.

`RouteCreate` gana un campo opcional `position`. Con él, el recorrido entra en esa posición y los
siguientes se corren; sin él, se añade al final, que es lo que hace hoy. Es aditivo: nada de lo
que existe cambia de comportamiento.

Y la numeración deja de depender del orden de llegada. Pasa a ser una regla derivada, en un único
sitio:

> La posición de un paso sale de recorrer los recorridos en orden y, dentro de cada uno, sus
> pasos en orden. Se recalcula después de insertar y después de borrar.

Esa regla sustituye al `max(position) + 1` de `add_route`, y es la misma que usa el borrado para
no dejar huecos. Un helper, dos llamadas.

### Repetir desde el grabador

La fila ofrece «Repetir». Si la toma sigue en el móvil, se descarta y se vuelve a grabar. Si ya
se envió, son dos pasos encadenados: **borrar ese recorrido y crear el nuevo en la misma
posición**. Las demás tomas no se tocan, ni las anteriores ni las siguientes.

Entre el borrado y la subida del vídeo nuevo, la guía tiene esa parte vacía. Es el mismo hueco que
ya existe entre crear un recorrido y subirle el vídeo, y el panel ya lo sabe mostrar: el paso
aparece sin medios hasta que termina el procesado.

Si el borrado funciona y la grabación nueva falla, lo que queda es una guía con una parte menos,
no una guía rota: la pantalla lo dice y ofrece volver a grabar esa parte.

## Lo que queda al constructor

- La redacción exacta de los textos, dentro del tono de lectura fácil que ya usa el producto.
- El detalle visual de la fila y de sus estados, con los tokens y componentes que ya existen.
- Cómo se saca la miniatura de la toma en el móvil.
- El reparto en ficheros, respetando el límite de 500 líneas (`grabar/page.tsx` ya va por 400).
