# CLAUDE.md

Frontend de Antesala (Vite 8 + React 19, JSX, react-router 7, CSS propio). Léelo antes de tocar nada.

## Alcance
Solo interfaz. El análisis de vídeo, la IA, el almacenamiento y la API son del backend; el contrato está en `docs/API.md`
y es la frontera: no se cambia sin acordarlo. Toda llamada de red pasa por `src/api/cliente.js`.

## Comandos
`npm run dev` (:5173, reenvía `/api` a `API_URL`) · `npm run build` · `npm run lint` (oxlint).
Antes de dar algo por hecho: build y lint limpios y la ruta probada en el navegador.

## Convenciones
- Interfaz, textos, dominio y comentarios en español; APIs y librerías en inglés.
- Lectura fácil para la persona usuaria: frases cortas, una idea por frase, segunda persona, presente.
- Errores y vacíos dicen qué hacer, sin pedir perdón.
- Sin `// TODO` ni funciones vacías. Sin dependencias pesadas.
- Estado: `src/state/AppStore.jsx`. Su `dispatch` ya sincroniza con el backend `ACTUALIZAR_PASO`, `COMPLETAR_DATO`, `PUBLICAR` y `REGISTRAR_VISITA`.

## Diseño y accesibilidad
Referencia: `docs/antesala-ui.md` y el PDF. Pino `#1F5D50`, Tinta `#15302B`, Salvia `#DDEBE5`, Niebla `#F4F6F3`, Ámbar `#F2B45A`, Coral `#C24E33` **solo** para grabar.
Modo tenue sin negro ni blanco puros. Títulos en Bricolage Grotesque, texto en Atkinson Hyperlegible Next.
Botones ≥ 56 px, radio 18 px, siempre icono + texto. Ruido: barras + palabra + tono, nunca solo color.
Contraste ≥ 4,5:1, foco visible, `aria-pressed` en interruptores y chips, `lang="es"`.

## Principio «Real: nada inventado»
Lo no implementado se muestra como «previsto», nunca como hecho: difuminado de caras, pictogramas, códigos por email, mapa.
Con foto en lugar de clip no hay «Escuchar el sitio» en ese paso.

## Sin probar
Cámara y `MediaRecorder` reales, voz (`speechSynthesis`), impresión del cartel, teclado y lector de pantalla, fotos HEIC.
Con el backend real: subida y consulta de trabajos, vídeo con `Range` y CORS.
