# Contrato de API (front ↔ backend)

El front solo habla con el backend a través de [`src/api/cliente.js`](../src/api/cliente.js).
Todas las rutas cuelgan de `/api`. En desarrollo Vite las reenvía a `API_URL` (por defecto `http://127.0.0.1:8787`).
En producción, sirve el front y la API en el mismo origen o define `VITE_API_URL` al compilar.

Errores: siempre JSON `{ "ok": false, "code": "…", "error": "texto que se muestra a la persona" }` con el estado HTTP que toque.
El front muestra `error` tal cual: debe estar en español y decir qué hacer.

## Lectura

### `GET /api/bootstrap`
Todo lo que necesita la app al arrancar.

```jsonc
{
  "usuaria": {
    "nombre": "Marta", "ciudad": "Málaga centro",
    "paraQuien": "mi",                      // "mi" | "otra"
    "necesidades": ["sentidos"],            // ver, oir, entender, sentidos, orientar
    "comodidad": { "modoTenue": true, "leerEnVozAlta": false, "pictogramas": false,
                   "tamanoTexto": 1,        // 0 | 1 | 2
                   "avisoAntesDeSonido": true },
    "intereses": ["ruido"],
    "cuenta": null,                         // o { "email": "…" }
    "proximaVisita": { "lugarId": "…", "texto": "Cena", "fecha": "2026-11-25", "hora": "21:00" },
    "historial": [{ "lugarId": "…", "fecha": "2026-11-20" }]
  },
  "cuentaCliente": { "persona": "Lucía", "organizacion": "…", "plan": "…",
                     "metricas30d": { "…": 0 }, "guiasIds": ["…"] },
  "categorias": [{ "id": "restaurantes", "label": "Restaurantes" }],
  "lugares": [ /* Lugar, ver abajo */ ],
  "nuevoLugar": { "id": "…", "nombre": "…", "categoria": "…", "direccion": "…",
                  "distanciaM": 450, "minutosAndando": 6,
                  "partes": ["Entrada", "Recepción", "Comedor", "Baños", "Salida"] }  // o null
}
```

`nuevoLugar` es el sitio de la cuenta cliente que **aún no tiene guía** y se va a grabar. Si no hay, `null`.

### Lugar

```jsonc
{
  "id": "…", "nombre": "…", "categoria": "restaurantes", "direccion": "…",
  "distanciaM": 450, "minutosAndando": 6,
  "estado": "publicada",                    // "publicada" | "borrador" | "revisar-cambios"
  "revisada": "2026-11-17",                 // fecha ISO; en borradores, fecha-hora ISO de creación
  "creadoEn": "2026-11-24T10:00:00Z",       // solo borradores
  "visitas30d": 12, "duracionVideo": "1:52",
  "etiquetas": ["Espera tranquila"], "horaTranquila": "17:00–19:00",
  "validada": true, "validadaPor": "Asociación …", "resumenCerca": "…",
  "resumen": "…", "alertas": ["…"],
  "origen": "gemini",                       // "gemini" | "local" | ausente. Solo informativo.
  "modelo": "…",
  "videoUrl": "https://…/video.mp4",        // ausente si el lugar no tiene vídeo (ver «Vídeo»)
  "pasos": [ /* Paso */ ]
}
```

### Paso

```jsonc
{
  "nombre": "Comedor", "texto": "Texto en lectura fácil.",
  "ruido": "medio",                         // "tranquilo" | "medio" | "ruidoso" | null (sin audio)
  "ruidoDbfs": -31.2,
  "luz": "normal",                          // "tenue" | "normal" | "fuerte"
  "detalles": ["…"], "ayuda": "…",          // ayuda: string | null
  "duracion": "0:18", "inicio": 36.0, "fin": 54.0,   // segundos dentro del vídeo
  "imagen": "https://…/1.jpg",              // foto de relleno; se usa si no hay fotoDataUrl
  "fotoDataUrl": "data:image/jpeg;base64,…",// fotograma real del vídeo (o URL)
  "fotoT": 40.5,
  "faltan": ["Hora de cierre"],             // datos que no salían en el vídeo (≤ 2)
  "completado": { "Hora de cierre": "23:00" },
  "revisado": false,
  "medio": "clip",                          // "clip" | "foto"
  "fotoSubida": "data:image/jpeg;base64,…"  // foto elegida por el cliente (≤ 960 px)
}
```

El **ruido lo mide el audio, nunca un modelo de lenguaje**. El front lo pinta con barras + palabra + tono.

## Escritura

| Método y ruta | Cuerpo | Respuesta | Cuándo |
|---|---|---|---|
| `PATCH /api/usuaria` | la `usuaria` completa | `{ ok: true }` | Al cambiar ajustes (espera de 300 ms; el front también los recuerda en el móvil) |
| `PATCH /api/lugares/:id/pasos/:indice` | cambios parciales del paso (`texto`, `inicio`, `fin`, `duracion`, `medio`, `fotoSubida`, `revisado`, `completado: { dato: valor }`…) | `{ ok: true }` | Al editar en el panel (agrupado, 600 ms tras dejar de escribir). `completado` se **fusiona** con lo ya guardado |
| `POST /api/lugares/:id/publicar` | — | `{ ok: true }` | Al publicar. Debe fallar (422, `code: "datos_pendientes"`) si queda algún `faltan` sin completar |
| `POST /api/lugares/:id/visitas` | — | `{ ok: true }` | Al empezar una guía |

## Vídeo y procesado

### `POST /api/trabajos` (multipart)
Campos: `video` (`.mp4`/`.mov`) y `meta` (JSON `{ "lugarId": "…"|undefined, "partes": ["Entrada", …], "cortes": [12.4, 30.1] | undefined }`).
`cortes` son los segundos donde la persona pulsó «Llegué a: X» al grabar; si vienen, sustituyen a la detección automática.
Respuesta: `{ "trabajoId": "…" }`. El front muestra el avance de la subida por su cuenta.

### `GET /api/trabajos/:id`
El front consulta cada segundo.

```jsonc
{ "estado": "procesando", "fase": "ruido", "pct": 40, "texto": "Midiendo el ruido" }
{ "estado": "listo", "lugar": { /* Lugar en estado "borrador" */ } }
{ "estado": "error", "code": "video_ilegible", "error": "Este vídeo no se puede leer. Conviértelo a MP4 (H.264)." }
```

`fase` ∈ `fotogramas | ruido | tramos | ia | montar` (la fase `subir` la pone el front). `pct` es 0–100 **dentro de la fase**.

### Vídeo del lugar
`lugar.videoUrl` debe admitir peticiones `Range` (el reproductor salta al `inicio` de cada paso) y, si está en otro origen,
enviar `Access-Control-Allow-Origin` (el front pide el vídeo con `crossOrigin="anonymous"` para poder filtrar el audio).

## Lo que el front NO hace
- No analiza vídeo (ni fotogramas, ni audio, ni luz de la guía): lo hace el backend.
- No habla con la IA ni guarda ninguna clave.
- No guarda vídeos ni guías en el navegador: solo recuerda los ajustes de la persona usuaria (`antesala:v1` en `localStorage`).
