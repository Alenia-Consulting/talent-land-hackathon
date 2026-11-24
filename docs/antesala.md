# Antesala

**Que ninguna visita sea la primera.**

Antesala convierte un vídeo de 1–2 minutos grabado con el móvil en una **guía de anticipación** de un lugar: el recorrido paso a paso con **clips reales**, **el sonido real de cada zona**, fotos, pictogramas y textos en lectura fácil que se pueden **escuchar**. El establecimiento la revisa, la aprueba y la comparte con un QR.

> «Este centro tiene Antesala»: el nombre funciona también como sello para los lugares preparados.

---

## 1. ¿Por qué?

- **Ir a un sitio nuevo genera ansiedad** a muchas personas autistas. La estrategia que recomiendan los profesionales es la **anticipación**: ver antes cómo será el lugar, qué va a pasar y a quién pedir ayuda.
- **Hoy esas guías se hacen a mano.** Hospitales como el Virgen Macarena, Fundación Alcorcón, Puerta de Hierro (AdaptaTEA) o Vall d'Hebron las elaboran con fotos y pictogramas. Cuestan semanas, se quedan desactualizadas y solo existen en unos pocos centros.
- **El problema es de escala, no de conocimiento.** Ya se sabe qué funciona. Lo que falta es poder hacerlo en cualquier sitio, rápido y barato.
- **Hay marco legal.** La Ley 6/2022 reconoce la accesibilidad cognitiva como parte de la accesibilidad universal.

> En España hay unas 450.000 personas con TEA (Estrategia Española en TEA). La anticipación también ayuda a personas con discapacidad intelectual, ansiedad o deterioro cognitivo.

## 2. ¿Para quién?

| Perfil | Qué necesita | Qué obtiene |
|---|---|---|
| **Persona autista** (adolescente o adulta) | Saber qué se va a encontrar antes de ir | El recorrido real, paso a paso, con imagen y sonido |
| **Familia o persona de apoyo** | Preparar la visita juntos | Una guía para repasar en casa |
| **Establecimiento** (hospital, centro de salud, hotel, museo, oficina) | Ser accesible sin un proyecto de meses | Una guía en minutos, que controla y aprueba |
| **Asociaciones** (Autismo España, APSA…) | Garantizar la calidad | Pueden validar y recomendar guías |

**Quién paga:** los establecimientos (B2B). **Quién lo usa gratis:** las personas y las familias.

## 3. ¿En qué ayuda a la persona?

La persona **llega a un sitio que ya conoce**.

1. **Menos ansiedad.** Ha visto la entrada, la recepción y la sala de espera reales. Al llegar, las reconoce.
2. **Preparación sensorial.** Ha **oído** cómo suena cada zona. Si la recepción es ruidosa, lleva cascos, elige otra hora o sabe dónde hay un sitio tranquilo.
3. **Más autonomía.** Sabe dónde esperar, a quién pedir ayuda y por dónde salir, así que depende menos de otras personas.
4. **No abandona la cita.** Ir preparada aumenta la probabilidad de que vaya y se quede.
5. **La entiende a su manera.** Imágenes del sitio real, no dibujos genéricos. La puede repetir las veces que quiera, a su ritmo, con texto en lectura fácil y audio.

**Lo que no resuelve:** solo sirve donde haya guía, no todas las personas autistas la necesitan, y si el sitio cambia hay que actualizarla (por eso se muestra la fecha de la última revisión). No cambia el lugar, pero sí que la persona llegue sabiendo qué se va a encontrar.

---

## 4. ¿Cómo funcionará?

### Para el establecimiento

1. **Graba** con el móvil el recorrido de una persona que visita el sitio por primera vez: entrada, recepción, espera, consulta y salida. Andando despacio y, si es posible, con poca gente.
2. **Sube** el vídeo. Antesala detecta las etapas y monta un borrador del recorrido.
3. **Revisa y edita.** Corrige textos, ajusta dónde empieza y acaba cada clip y añade datos que no salen en el vídeo (horarios, a quién preguntar).
4. **Aprueba y publica.** Recibe un enlace y un QR para la web, el SMS de la cita o la recepción.

### Para la persona usuaria

Abre el enlace, sin instalar nada ni registrarse, y **elige qué quiere anticipar**: dónde esperar, zonas con ruido, baños, a quién pedir ayuda o la salida.

Cada **paso** del recorrido muestra:

| Elemento | Qué es |
|---|---|
| **Clip** | 3–6 segundos del tramo real (por ejemplo, de la puerta a la recepción), sin sonido por defecto |
| **Foto** | El momento más claro de ese tramo |
| **Texto** | Lectura fácil: «Entras por una puerta de cristal. Se abre sola.» |
| **Ruido** | Tranquilo, medio o ruidoso |
| **🔊 Escuchar el sitio** | El sonido real de esa zona, con aviso previo |
| **🗣 Leer en voz alta** | Una voz lee el texto del paso |
| **Pictograma** | Apoyo visual (opcional) |

**Ver recorrido completo:** reproduce todos los pasos seguidos, como un paseo, con **pausa entre pasos** y botón para avanzar. Nunca arranca con sonido.

### Lo que NO hace (a propósito)

- **No publica nada sin revisión humana.** La IA hace el borrador y el establecimiento decide.
- **No genera ni inventa espacios.** Todo lo que se ve y se oye es del vídeo real.
- **No graba a la persona usuaria.** El vídeo es del sitio, con caras difuminadas y voces no reconocibles.
- **No sustituye la validación de lectura fácil** de la norma UNE 153101. Facilita el primer borrador.

---

## 5. Parte técnica

### Arquitectura

```
[Móvil del establecimiento]
        │  sube vídeo (máx. 3 min)
        ▼
[Backend FastAPI]
  1. Gemini (vídeo)  ─► etapas del recorrido en JSON (inicio, fin, foto)
  2. Por cada etapa:
       ffmpeg      ─► corta el clip y lo estabiliza
       MediaPipe   ─► difumina las caras (clip y foto)
       ffmpeg      ─► audio de la zona: nivel de ruido + voces no reconocibles
       ARASAAC     ─► pictograma
  3. Guarda todo como borrador
        ▼
[Supabase] Storage (clips, fotos, audio) + Postgres (guías, pasos, estado)
        ▼
[Web Next.js]  panel de revisión  ·  guía pública (enlace / QR)
```

### Stack

| Capa | Herramienta | Por qué |
|---|---|---|
| Frontend | **Next.js + Tailwind** (PWA, mobile-first) | Rápido de construir y funciona como app sin instalarla |
| Backend | **Python + FastAPI** | ffmpeg, OpenCV y MediaPipe son nativos en Python |
| IA | **API de Gemini** (modelo Flash con entrada de vídeo) | Recibe vídeo y audio juntos y devuelve JSON con marcas de tiempo |
| Vídeo y audio | **ffmpeg** (versión con `libvidstab`, que incluyen los builds estáticos) | Cortar, estabilizar, filtrar audio y codificar |
| Privacidad | **MediaPipe Face Detection** + **OpenCV** | Difuminar caras fotograma a fotograma |
| Ruido | **numpy** | RMS del audio por segundo |
| Pictogramas | **API pública de ARASAAC** | El estándar en España |
| Voz | **Web Speech API** (navegador) | Lectura en voz alta gratis y sin backend |
| Reproductor | Etiqueta **`<video>` de HTML5** | Sin librerías y compatible con todo |
| Datos | **Supabase** | Base de datos, ficheros y login en un solo servicio |
| Despliegue | **Vercel** (front) + **Cloud Run o Railway** (back con ffmpeg) | Gratis o casi para una demo |

*Alternativa a Gemini:* extraer 1 fotograma por segundo y enviarlos a otro modelo de visión. Gemini lo simplifica porque procesa vídeo y audio juntos.

### Cómo se monta el recorrido, paso a paso

**1. Detectar las etapas (Gemini).** Se sube el vídeo y se pide el JSON de etapas (ver el formato más abajo). Instrucciones clave para el modelo:

- Dividir el recorrido en **4–8 etapas** con inicio y fin en segundos.
- Escribir en **lectura fácil**: frases cortas, una idea por frase, segunda persona y sin tecnicismos.
- **No inventar.** Si algo no se ve, el campo queda vacío para que lo complete el establecimiento.
- Elegir el segundo con la **foto más clara** de cada etapa.

**2. Cortar y estabilizar el clip** (vídeo grabado andando):

```bash
# cortar el tramo
ffmpeg -ss 12 -to 18 -i original.mp4 -an -c:v libx264 tramo.mp4
# estabilizar (dos pasadas)
ffmpeg -i tramo.mp4 -vf vidstabdetect=result=t.trf -f null -
ffmpeg -i tramo.mp4 -vf "vidstabtransform=input=t.trf:smoothing=15,scale=-2:720" estable.mp4
```

**3. Difuminar caras.** Con OpenCV se lee el clip fotograma a fotograma, MediaPipe detecta las caras y se aplica un desenfoque gaussiano a cada una. Para que vaya rápido, se trabaja a 720p y 15 fps. Se hace lo mismo con la foto fija.

**4. Preparar el sonido de la zona:**

```bash
# audio del tramo, sin procesar → para calcular el nivel de ruido
ffmpeg -ss 12 -to 18 -i original.mp4 -vn -ac 1 -ar 16000 tramo.wav
# versión para escuchar: filtro paso bajo para que las voces no se entiendan
ffmpeg -i tramo.wav -af "lowpass=f=700" -c:a aac sonido.m4a
```

- **Nivel de ruido:** RMS por segundo con numpy, promediado por etapa y clasificado como *tranquilo*, *medio* o *ruidoso* **respecto al resto del vídeo**. El micrófono del móvil no está calibrado, así que no damos decibelios.
- **Privacidad de voces:** el filtro paso bajo (unos 500–800 Hz, ajustar a oído) conserva el ambiente (murmullo, pitidos, puertas) y hace que las conversaciones sean ininteligibles. Aun así, mejor grabar con poca gente y avisar con un cartel.
- **No normalizar el volumen de cada clip por separado.** Si no, una sala ruidosa y una tranquila sonarían igual. Se aplica la misma ganancia a todo el vídeo.

**5. Unir clip y sonido:**

```bash
ffmpeg -i estable_difuminado.mp4 -i sonido.m4a -c:v libx264 -crf 28 -c:a copy \
       -movflags +faststart paso_1.mp4
```

`+faststart` hace que el clip empiece a reproducirse en el móvil sin descargarlo entero.

**6. Guardar** clips, fotos y JSON en Supabase con estado `borrador`. Al aprobarse pasa a `publicada` y se genera el QR (librería `qrcode` en Python o `qrcode.react` en el front).

**Objetivo de tiempo:** la guía lista en **menos de 5 minutos** desde la subida.

### Formato del paso (JSON)

Gemini devuelve los campos de texto y tiempos, y el backend añade los ficheros y el ruido:

> **Contrato vigente:** la fuente de verdad es `contracts/openapi.json`, que FastAPI genera del código; `contracts/README.md` explica cómo se usa y el Swagger está en `/api/docs`. Las claves están en **inglés** (`texto_facil` -> `easy_read_text`) porque `AGENTS.md` exige código en inglés. El JSON de ejemplo que sigue se mantiene como referencia de producto.
>
> **Cambio respecto a lo descrito arriba:** el recorrido ya no lo detecta la IA. La persona elige las partes antes de grabar y pulsa «Llegué a: X» al llegar a cada una; esas marcas son las que el móvil envía y las que el backend convierte en pasos. Gemini escribe el texto de cada paso, pero no decide dónde empieza ni acaba.

```json
{
  "orden": 2,
  "titulo": "Recepción",
  "inicio_seg": 12,
  "fin_seg": 18,
  "segundo_foto": 15,
  "texto_facil": "Llegas al mostrador azul. Dices tu nombre.",
  "que_esperar": ["Puede haber una fila", "Suena un pitido al llamar"],
  "a_quien_pedir_ayuda": "Persona del mostrador azul",
  "categoria": "recepcion",
  "clip_url": "…/paso_2.mp4",
  "foto_url": "…/paso_2.jpg",
  "sonido_disponible": true,
  "nivel_ruido": "ruidoso",
  "pictograma_url": "…/arasaac/2345.png"
}
```

### Reglas de diseño del reproductor (accesibilidad sensorial)

- **Nunca hay sonido automático.** Los clips arrancan en silencio y el sonido solo suena si la persona pulsa «Escuchar el sitio».
- **Aviso antes de sonar:** «Este sonido es *ruidoso*». El sonido empieza a volumen bajo y sube poco a poco (fade-in).
- **Sin animaciones, destellos ni transiciones bruscas.**
- **Botones grandes**, siempre en el mismo sitio en todos los pasos.
- **Control total:** pausar, repetir y avanzar cuando quiera. Nada avanza solo sin pausa entre pasos.
- La **fecha de la última revisión** siempre visible.

### Alcance del MVP

**Imprescindible para la demo:**

- [ ] Subir vídeo → recorrido en borrador
- [ ] Pasos con clip, foto, texto en lectura fácil y nivel de ruido
- [ ] «Escuchar el sitio» con aviso, y «Leer en voz alta»
- [ ] Caras difuminadas y voces filtradas
- [ ] Panel para editar y aprobar, con QR
- [ ] «Ver recorrido completo»

**Si sobra tiempo:**

- [ ] Estabilización del clip
- [ ] Pictogramas de ARASAAC
- [ ] Filtro «qué quiero anticipar»
- [ ] Ajustar inicio y fin del clip desde el panel
- [ ] Versión imprimible (PDF)

### Licencias y datos

- **ARASAAC:** licencia CC BY-NC-SA. Hay que citar la autoría y **no permite uso comercial sin autorización**. Para el modelo B2B hay que pedir permiso o usar pictogramas propios.
- **RGPD:** solo se guardan clips y fotos con caras difuminadas y audio filtrado. El vídeo original se borra después de procesarlo.

---

## 6. Competencia

| Existe | Qué hace | Nuestra diferencia |
|---|---|---|
| Guías hospitalarias (AdaptaTEA, Macarena…) | PDF con fotos y pictogramas hechos a mano | Minutos en vez de semanas, con vídeo y sonido real |
| **Scout+** | Ver y oír un recinto antes de ir, con contenido preparado por el recinto | Generación automática con IA a partir de un vídeo de móvil |
| **VirTEA** (Murcia) | Escenas genéricas (dentista, peluquería) | Tu sitio real, no uno genérico |
| PlanTEA (UCLM) | Agendas con pictogramas | Imagen y sonido del lugar real |

---

## 7. Reparto del equipo (6 personas)

| # | Rol | Entregable |
|---|---|---|
| 1 | IA y API | `POST /guia`: vídeo → JSON de etapas |
| 2 | Procesado de medios | Clips, sonido, caras, ruido y pictogramas |
| 3 | Guía de la persona usuaria | Reproductor paso a paso, sonido, voz y recorrido completo |
| 4 | Panel, integración y despliegue | Subir, editar, aprobar, QR y todo desplegado |
| 5 | Producto y validación | Pruebas con personas usuarias, lectura fácil, RGPD y licencias |
| 6 | Pitch y coordinación | Presentación, plan B de la demo y control del tiempo |

**Primer día:** cerrar el formato JSON (roles 1 y 3), grabar 2–3 vídeos de prueba (roles 5 y 6) y tener un despliegue vacío funcionando (rol 4).

---

## 8. La demo (90 segundos)

1. **Problema (20 s):** una guía de anticipación hecha a mano por un hospital, que tardó semanas.
2. **En directo (40 s):** grabamos el recorrido desde la puerta de la sala hasta la mesa del jurado, lo subimos y aparece el recorrido.
3. **Revisión (15 s):** corregimos una frase y aprobamos. Aparece el QR.
4. **Usuario (15 s):** el jurado escanea el QR, ve el paso «sala de espera» y pulsa **«Escuchar el sitio»**.

**Plan B:** un vídeo grabado de la demo completa por si fallan la wifi o la API.

**Mensaje final:** *«Lo que hoy cuesta semanas a un hospital, ahora cuesta 5 minutos. Antesala: que ninguna visita sea la primera.»*

---

## 9. Futuro: vista 3D

Para sitios complejos (un hospital grande), se podría añadir una **vista 3D de una sala concreta**, capturada con **Scaniverse** (gratis, exporta PLY o SPZ) y mostrada en la web con **Spark** (three.js). Siempre capturada del sitio real; **nunca generada con IA**, porque una guía de anticipación no puede inventar espacios. No entra en el MVP.
