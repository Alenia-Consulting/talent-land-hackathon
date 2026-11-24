// Cada paso muestra un clip del vídeo o, si el cliente lo elige, una foto subida (paso.fotoSubida + paso.medio === 'foto').

/** ¿Este paso enseña la foto subida en lugar del clip? */
export function usaFoto(paso) {
  return Boolean(paso?.fotoSubida) && paso?.medio === 'foto'
}

/** URL del vídeo que debe usar el reproductor en este paso (nada si el paso usa foto). */
export function videoUrlDe(lugar, paso) {
  return usaFoto(paso) ? undefined : lugar?.videoUrl
}
