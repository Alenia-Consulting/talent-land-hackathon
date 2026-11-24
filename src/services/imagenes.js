// Foto subida por el cliente: se reduce en el navegador para que quepa en localStorage.
const MAX_LADO = 960
const MAX_ORIGINAL_MB = 25

export class ErrorImagen extends Error {}

/** Devuelve un dataURL JPEG de como máximo 960 px de lado. */
export async function reducirImagen(archivo) {
  if (!archivo?.type?.startsWith('image/')) {
    throw new ErrorImagen('Ese archivo no es una imagen. Elige un JPG, PNG o WebP.')
  }
  if (archivo.size > MAX_ORIGINAL_MB * 1024 * 1024) {
    throw new ErrorImagen(`La foto pesa más de ${MAX_ORIGINAL_MB} MB. Elige una más pequeña.`)
  }
  let bitmap
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    throw new ErrorImagen('Esta foto no se puede leer en este navegador. Prueba con un JPG o PNG.')
  }
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#fff' // los PNG con transparencia se ven sobre blanco
  ctx.fillRect(0, 0, ancho, alto)
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close?.()
  return lienzo.toDataURL('image/jpeg', 0.82)
}
