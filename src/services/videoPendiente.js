// Relevo del vídeo entre pantallas (subir/grabar → procesando).
// Vive en memoria: un Blob grande no cabe en el estado ni en la URL.
let pendiente = null
let partesElegidas = null

/** opciones: { cortes?: number[], simular?: boolean } */
export function dejarVideo(blob, opciones = {}) {
  pendiente = { blob, opciones }
}

export function leerVideoPendiente() {
  return pendiente
}

export function limpiarVideoPendiente() {
  pendiente = null
}

/** Partes del recorrido que la persona ajustó en «Preparar». null = las del sitio. */
export function fijarPartes(partes) {
  partesElegidas = partes
}

export function leerPartes(porDefecto) {
  return partesElegidas && partesElegidas.length > 0 ? partesElegidas : porDefecto
}

