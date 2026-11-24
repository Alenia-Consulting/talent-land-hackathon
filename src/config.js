// Constantes del front. Lo que cambie con el negocio o el backend va en la respuesta de /api/bootstrap (config).

/** Luminancia media (0–255) de la cámara en vivo para avisar de poca o demasiada luz al grabar. */
export const UMBRALES_LUZ = { oscuro: 55, deslumbra: 205 }

/** Corte del filtro paso bajo al «Escuchar el sitio»: se oye el ambiente, no las conversaciones. */
export const FILTRO_VOZ_HZ = 450

/** Partes del recorrido que se ofrecen al grabar si el sitio no define las suyas. */
export const PARTES_POR_DEFECTO = ['Entrada', 'Recepción', 'Sala', 'Baños', 'Salida']
