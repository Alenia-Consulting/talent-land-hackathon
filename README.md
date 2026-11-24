# Antesala · frontend

> «Que ninguna visita sea la primera.»

Interfaz de Antesala: la persona usuaria mira un sitio **antes de visitarlo** (guía paso a paso, clip real, ruido medido) y el sitio graba, revisa y publica su guía.
Vite 8 + React 19 (JSX) + react-router 7. Sin TypeScript, sin librería de UI.

## Arrancar

```bash
npm install
cp .env.example .env     # API_URL = dónde está el backend
npm run dev              # http://localhost:5173 (Vite reenvía /api al backend)
npm run build            # genera dist/
npm run lint
```

Sin backend, la app muestra «No se pudo cargar Antesala». El contrato está en [docs/API.md](docs/API.md).

## Estructura

```
src/
├── api/cliente.js     única puerta al backend (fetch + subida con progreso)
├── config.js          umbrales de luz de la cámara, filtro de voz, partes por defecto
├── state/             AppStore (Context + useReducer), formato, medio
├── services/          imagenes (reducir foto), speech (voz), videoPendiente (relevo del vídeo)
├── components/        Button, Icon, NoiseBadge, SitePlayer, PhoneFrame, DesktopShell…
├── screens/           onboarding, usuaria, guia, cliente, grabar, revisar
└── styles/            tokens, base, componentes, pantallas
docs/                  API.md, antesala-ui.md (diseño) y el PDF de pantallas
```

Diseño y reglas de lectura fácil: [docs/antesala-ui.md](docs/antesala-ui.md).

Rutas: `/` · `/onboarding/1-4` · `/buscar` · `/buscar/resultados` · `/guia/:lugarId` (+ `/paso/:n`, `/paso/:n/sonido`, `/recorrido`) · `/cliente` · `/cliente/guias` · `/grabar` (+ `/comprobar`, `/grabando`, `/subir`, `/procesando`) · `/revisar/:lugarId` · `/panel/:lugarId` · `/publicar/:lugarId`.

## Principios
- **Calma**: nada suena, se mueve ni avanza sin que la persona lo pida. Se respeta `prefers-reduced-motion`.
- **Real**: todo sale del vídeo. Lo no implementado figura como «previsto» (difuminado de caras, pictogramas, códigos por email, mapa).
- **Control**: botones de ≥ 56 px, siempre icono + texto, siempre en el mismo sitio.
- El ruido nunca se indica solo con color: barras + palabra + tono.
