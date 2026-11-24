# Antesala · Pantallas UI — resumen de traspaso

> Resumen para continuar el trabajo en Claude Code.
> Fuente: el lienzo de diseño «Antesala · Pantallas UI» (https://claude.ai/artifact/SZgGjHrqBd5M9zLbG1XSA4), versión `1795524644-08e0`, leído el 24 nov 2026.
> Lo creó otra persona de la organización. Victor Franco tiene permiso de edición, pero no es el propietario.
> **Ojo:** no hay historial de conversación del diseño. Las «decisiones» de este documento salen de lo que muestran las pantallas, no de actas.

---

## 1. Objetivo

**Antesala**, con el lema *«Que ninguna visita sea la primera»*, es una app para ver y oír un sitio real **antes de ir**: dentista, centro de salud, museo, trámites… Está pensada para personas autistas, con discapacidad sensorial o cognitiva, o que se agobian en lugares nuevos, y para quien las acompaña.

- Contexto: **Hackathon IA First**, Marca v1, noviembre de 2026.
- Hay dos tipos de usuario:
  1. **Persona usuaria** (o acompañante): busca un sitio y recorre su guía paso a paso, con un clip, un texto en lectura fácil, el nivel de ruido y el sonido real del sitio.
  2. **Establecimiento** (cliente que paga): graba con el móvil un recorrido de unos 2 minutos. La **IA monta un borrador** de la guía, una persona lo revisa y lo publica. Después lo comparte por QR, enlace o SMS de cita.

---

## 2. Stack

### Lo que hay ahora (prototipo)

- Es un **lienzo de diseño de Claude** (artifact tipo *Design*) con 20 artboards.
- Cada pantalla es un archivo `.dc.html`, un *Design Component*:
  - HTML con estilos en línea.
  - Plantillas `{{hole}}`, `<sc-for>` y `<sc-if>`.
  - Lógica en `class Component extends DCLogic { renderVals() {...} }`, con estado local mediante `this.state` y `setState`.
- `canvas.json` es el índice: posición y tamaño de cada artboard, títulos y bloques.
- Fuentes de Google Fonts: **Bricolage Grotesque** (títulos) y **Atkinson Hyperlegible Next** (texto).
- No usa sistema de diseño instalado (`designSystems: []`). Los colores están escritos a mano en cada archivo.
- Tamaños: móvil **390×844**; escritorio **1280×900**, fluido (`expand: "fill"`).
- Las imágenes son ilustraciones SVG que simulan fotos y clips. No hay assets reales.

### Stack de producción

**Sin decidir.** Las pantallas sugieren estos requisitos:

- **Web o PWA**, sin instalación: «Gratis. Sin instalar nada» y la URL `antesala.app/alameda`.
- Login **sin contraseña** con código por email (OTP de 6 cifras). La cuenta es opcional.
- Preferencias guardadas **en el dispositivo** («Se guarda solo en tu móvil»).
- Captura de vídeo desde el móvil, con un máximo de 2:00 y marcadores por zona.
- **Pipeline de IA** de vídeo y audio:
  - cortar y estabilizar los clips;
  - difuminar caras;
  - filtrar voces dejando el ambiente;
  - medir el ruido por zona;
  - redactar el texto en lectura fácil;
  - generar la voz (TTS);
  - detectar datos que faltan.
- Generar el QR y el cartel imprimible.
- Panel web para el establecimiento: varios centros, métricas y facturación.

---

## 3. Estructura de archivos

```
project/
├── canvas.json                     # índice del lienzo (posiciones, títulos, bloques)
├── Main.dc.html                    # Guía de marca (1280×1040)
│
│ ── Establecimiento · Inicio y grabar desde la app ──
├── Cliente-Guias-Escritorio.dc.html  # Escritorio: tabla de guías, KPIs, plan (filtro y búsqueda funcionan)
├── Cliente-Inicio.dc.html          # Móvil: «Hola, Lucía», grabar, pendientes, métricas, guías
├── Grabar-1-Preparar.dc.html       # Consejos (luz, poca gente, despacio, cartel) + partes del recorrido
├── Grabar-2-Comprobar.dc.html      # Cámara: la IA avisa de luz, caras, sonido y estabilidad
├── Grabar-3-Grabando.dc.html       # Grabando: timeline de partes, «Llegué a: …», deshacer/pausar
├── Grabar-4-Procesando.dc.html     # La IA monta la guía (progreso por tareas)
│
│ ── Establecimiento · Revisar y publicar ──
├── Revisar-1-Borrador.dc.html      # Móvil: borrador con 2 datos que faltan
├── Revisar-2-Publicar.dc.html      # Publicada: QR, enlace, SMS, cartel, sello
├── Panel-Escritorio.dc.html        # Escritorio: editor de paso (clip, texto, ayuda, ruido) + checklist
│
│ ── Persona usuaria · Onboarding, buscar y la guía ──
├── Onb-1-Bienvenida.dc.html        # «Mira el sitio antes de ir»
├── Onb-2-Necesidades.dc.html       # Para mí / acompaño + 5 necesidades (interactivo)
├── Onb-3-Comodidad.dc.html         # Tamaño de texto, modo tenue, voz, pictogramas (interactivo + vista previa)
├── Onb-4-Cuenta.dc.html            # Cuenta opcional, email → código
├── Buscar-1-Inicio.dc.html         # Búsqueda, QR, próxima visita, categorías, cerca de ti
├── Buscar-2-Resultados.dc.html     # Resultados «Dentista» con filtros sensoriales
├── Guia-1-Inicio.dc.html           # Portada de la guía: qué ver antes + voz
├── Guia-2-Paso.dc.html             # Paso 3/5 «Sala de espera»
├── Guia-3-Sonido.dc.html           # Aviso antes de reproducir sonido (modal)
└── Guia-4-Recorrido.dc.html        # Recorrido completo en pausa (modo tenue)
```

### Flujos enlazados (prototipo)

- **Onboarding:** Onb-1 → Onb-2 → Onb-3 → Onb-4 → Buscar-1. Desde Onb-1 a Onb-3, «Saltar» lleva a Buscar-1.
- **Búsqueda:** Buscar-1 → Buscar-2 (solo la categoría Dentista) → Guia-1.
- **Guía:** Guia-1 → Guia-2 o Guia-4; Guia-2 → Guia-3 → «Ahora no» vuelve a Guia-2; Guia-4 → Guia-2.
- **Grabación:** Cliente-Inicio → Grabar-1 → Grabar-2 → Grabar-3 → Grabar-4 → Revisar-1 → Revisar-2.
- **Escritorio:** Cliente-Guias-Escritorio → Panel-Escritorio. Su botón «Nueva guía» lleva a Grabar-1.

---

## 4. Decisiones tomadas (según el diseño)

### Marca y principios

- Tres principios:
  - **Calma:** nada suena, se mueve ni avanza sin que la persona lo pida.
  - **Real:** todo sale del vídeo del sitio; nada inventado.
  - **Control:** botones grandes, siempre en el mismo sitio; ella marca el ritmo.
- Símbolo: una **puerta en arco con una luz** dentro. El sello para recepción dice «Este centro tiene Antesala».

### Colores

Saturación baja a propósito. Todos los textos tienen contraste de 4,5:1 o más.

| Token | Hex | Uso |
|---|---|---|
| Pino | `#1F5D50` | acción |
| Tinta | `#15302B` | texto |
| Salvia | `#DDEBE5` | superficie |
| Niebla | `#F4F6F3` | fondo |
| Ámbar | `#F2B45A` | aviso amable |
| Coral | `#C24E33` | solo para grabar |
| Texto secundario | `#4F625C` | — |
| Línea | `#DCE3DE` / `#E6EBE8` | — |

**Modo tenue:**

| Token | Hex |
|---|---|
| bg | `#101C19` |
| surface | `#1A2925` |
| text | `#E6EEEA` |
| muted | `#B9C8C2` |
| primary | `#8FD1BC` |
| line | `#2B3D38` |

El modo tenue no usa negro ni blanco puros. Se activa con un toque y se recuerda.

### Nivel de ruido

Nunca se indica solo con color: lleva barras, palabra y tono.

| Nivel | Fondo | Texto |
|---|---|---|
| Tranquilo | `#DDEBE5` | `#1F5D50` |
| Medio | `#FBE7C6` | `#774604` |
| Ruidoso | `#F6D5CA` | `#8A2E14` |

### Tipografía y componentes

- Tipografía: títulos con Bricolage Grotesque; texto con Atkinson Hyperlegible Next. Lectura fácil a 20–22 px.
- Botones:
  - 56 px de alto como mínimo (el CTA principal mide 58–60 px), radio de 18 px;
  - **siempre icono + texto**: nada de botones solo con icono dentro de la guía;
  - zonas táctiles de 44 px o más.
- Accesibilidad:
  - elementos reales (`button`, `a`, `label`, `input`);
  - `aria-pressed` en los toggles y `aria-label` en los iconos;
  - los SVG decorativos llevan `aria-hidden`.

### Producto

- **Sonido**: nunca se reproduce sin aviso previo, y ese aviso no se puede desactivar. Empieza bajito y sube poco a poco. Antes se dice qué se va a oír.
- **Privacidad**:
  - caras difuminadas y voces filtradas automáticamente;
  - sin diagnósticos ni datos de salud;
  - preferencias guardadas en local;
  - cuenta opcional, sin contraseñas.
- **IA con persona humana al mando**: la IA hace el borrador y deja en blanco lo que no se ve en el vídeo. **Nada se publica sin aprobación humana.**
- **Grabación guiada**: máximo 2:00; parar 3 s en cada zona (ahí salen la foto y la medición de sonido); marcar «Llegué a…»; se comprueban luz, caras, sonido y estabilidad antes de grabar.
- **Estructura de la guía**: pasos con nombre (Entrada, Recepción, Sala de espera, Consulta, Salida). Cada paso tiene:
  - un clip sin sonido;
  - un texto en lectura fácil, en frases cortas, en segunda persona;
  - el nivel de ruido;
  - a quién pedir ayuda;
  - «Escuchar el sitio» y «Leer en voz alta».
- **Onboarding adaptativo**: «Para mí» o «Acompaño a alguien» cambia los textos a tercera persona. Hay 5 necesidades: ver, oír, entender, sentidos, orientarse. Cada una activa ajustes.
- **Confianza**: se muestra la fecha de revisión de la guía y la etiqueta «Validada con una asociación de autismo». Se puede filtrar por espera tranquila, hora tranquila, con sonido y validada.
- **Negocio** (datos de ejemplo): plan «Medio» por 790 €/año, que incluye actualizar las guías. Para más de 10 centros, hablar con ventas. Hay métricas de visitas, % que escucharon el sitio y accesos por QR.
- Datos de ejemplo: Clínica Dental Alameda (Málaga), usuaria «Lucía M.», grupo Clínicas Alameda con 3 centros (Alameda, El Palo, Teatinos).

---

## 5. Tareas pendientes

### A. Incoherencias en el diseño

- [ ] **Coral de grabación**: la marca dice `#C24E33`, pero en `Grabar-3-Grabando` el punto y el botón de parar usan `#E0694F`. Unificar.
- [ ] **Ámbar**: `Revisar-2` y `Cliente-Inicio` usan `#C98A2B`, que no está en la paleta. Decidir si es un token nuevo, por ejemplo «ámbar oscuro».
- [ ] **Texto del paso «Sala de espera»**:
  - `Guia-2`: «Esperas a que tu nombre salga en la pantalla».
  - `Revisar-1`: «Esperas a que digan tu nombre».
  - Elegir uno de los dos.
- [ ] **Recepción**: en `Revisar-1` aparece «Ruidoso», pero en `Guia-4` la Recepción del recorrido no muestra su nivel. Revisar la coherencia del nivel de ruido entre pantallas.
- [ ] **Enlace erróneo**: en `Cliente-Inicio`, «Recorrido principal · Borrador» lleva a `Revisar-2-Publicar` (pantalla de *publicada*). Debería ir a `Revisar-1-Borrador` o al Panel.
- [ ] **Paso a paso**: `Guia-2` muestra el paso 3 de 5, pero `Guia-4` muestra «Paso 2 terminado → siguiente: paso 3». La secuencia funciona, pero conviene comprobar que es intencionado.

### B. Enlaces y acciones sin destino (`href="#"` o botón sin acción)

- [ ] `Guia-2`: «Anterior», «Siguiente», «Leer en voz alta».
- [ ] `Guia-4`: «Repetir la recepción».
- [ ] `Buscar-1`: categorías distintas de Dentista, «Ver mapa», botón QR y buscador sin acción.
- [ ] `Buscar-2`: el toggle Lista/Mapa es estático; «Pídele que tenga Antesala».
- [ ] `Onb-1`: botón «Escuchar».
- [ ] `Onb-4`: «Cómo cuidamos tus datos»; tras introducir el código no hay destino.
- [ ] `Grabar-1`: «Volver», «Editar» partes, «+ Añadir», «Descargar cartel», «Ya tengo un vídeo grabado».
- [ ] `Grabar-3`: «Llegué a», «Deshacer», «Pausar» (solo funciona el botón de terminar).
- [ ] `Revisar-1`: «Volver», «Ver como persona usuaria» y las tarjetas de cada paso. Debería existir una pantalla móvil para editar un paso.
- [ ] `Revisar-2`: «Copiar», «Añadir al SMS», «Cartel», «Cerrar».
- [ ] `Cliente-Inicio`: barra inferior (Guías, QR, Cuenta), selector de centro, «¿Ha cambiado algo?».
- [ ] Escritorio: navegación superior (Inicio, Centros, Plan y factura), pasos del Panel, «Añadir paso», «Aprobar y publicar» (está desactivado a propósito, porque faltan datos).

### C. Estado compartido que el prototipo no tiene

- [ ] Las necesidades de `Onb-2` deberían preactivar los ajustes de `Onb-3`, que dice «Ya hemos activado lo que te ayuda». Ahora son independientes.
- [ ] El **modo tenue** y el **tamaño de texto** deberían mantenerse en todas las pantallas. Ahora cada pantalla tiene su propio toggle o prop (`tenue`), y `Guia-2` solo lo acepta como prop.
- [ ] Los chips de `Guia-1` («qué quieres ver antes») deberían filtrar o resaltar contenido en la guía.

### D. Pantallas que faltan (probables)

- [ ] Editor de paso en móvil (desde `Revisar-1`).
- [ ] Mapa de resultados.
- [ ] Escáner QR.
- [ ] Ajustes y cuenta de la persona usuaria; compartir con familia o apoyo.
- [ ] Recordatorio «el día antes» (notificación).
- [ ] Último paso y fin de la guía (Salida), y estado vacío o de error.
- [ ] Subir un vídeo ya grabado.
- [ ] Establecimiento: Centros, Plan y factura, alta y onboarding del cliente.
- [ ] Resto de categorías y del estado «Revisar cambios» (guía caducada).

### E. Hacia producción (Claude Code)

- [ ] Elegir el stack. Sugerencia: PWA con React, Next o SvelteKit; backend con almacenamiento de vídeo y colas para el pipeline de IA.
- [ ] Extraer los **tokens de diseño** (tabla del punto 4) a CSS variables o a un tema, con modo claro y tenue.
- [ ] Convertir cada `.dc.html` en componentes reutilizables: Button, Chip, NoiseBadge, StepCard, Toggle, ProgressDots, Header.
- [ ] Definir el modelo de datos: `Centro`, `Guía` (borrador, publicada, revisar cambios), `Paso` (clip, foto, texto LF, ruido, ayuda, audio), `PreferenciasUsuaria` (local).
- [ ] Pipeline de IA:
  - cortar y estabilizar;
  - difuminar caras;
  - aislar voces;
  - medir dB por zona y clasificarlo en tres niveles;
  - texto en lectura fácil;
  - TTS;
  - detectar huecos.
- [ ] Auth por OTP de email y cuenta opcional.
- [ ] Generar el QR y un enlace corto (`antesala.app/<slug>`), más el cartel PDF.
- [ ] Probar la accesibilidad con lector de pantalla, zoom de texto y `prefers-reduced-motion`.
- [ ] Sustituir las ilustraciones SVG por clips y fotos reales.

---

## 6. Cómo obtener los archivos

Los `.dc.html` viven en el artifact, no en un repositorio. Para trabajar en Claude Code:

- pide a Claude que lea y exporte cada archivo del artifact (no requiere ser propietario, basta con permiso de edición);
- o copia el HTML desde el lienzo.

Las pantallas usan `./support.js`, el runtime del lienzo, que no se incluye: fuera del lienzo no renderizan igual. Tómalas como **especificación visual**, no como código final.
