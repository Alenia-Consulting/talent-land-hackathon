export function fechaCorta(iso) {
  if (!iso) return 'sin revisar'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** 450 → «450 m»; 1200 → «1,2 km». */
export function distancia(m) {
  if (m == null) return ''
  return m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`
}

/** «revisada hace 1 semana». `hoy` permite fijar la fecha de referencia. */
export function haceTiempo(iso, hoy = new Date()) {
  if (!iso) return 'sin revisar'
  const d = String(iso).length > 10 ? new Date(iso) : new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  const ms = Math.max(0, hoy - d)
  if (String(iso).length > 10) {
    const min = Math.round(ms / 60000)
    if (min < 1) return 'ahora mismo'
    if (min < 60) return `hace ${min} min`
    if (min < 1440) return `hace ${Math.round(min / 60)} h`
  }
  const dias = Math.round(ms / 86400000)
  if (dias < 2) return 'hace 1 día'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) {
    const s = Math.round(dias / 7)
    return `hace ${s} ${s === 1 ? 'semana' : 'semanas'}`
  }
  const m = Math.round(dias / 30)
  return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`
}

/** Elige la frase según sea para la propia persona o para quien acompaña. */
export function segunPersona(paraQuien, paraMi, paraOtra) {
  return paraQuien === 'otra' ? paraOtra : paraMi
}

export function minutosSegundos(s) {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export const ETIQUETA_ESTADO = {
  publicada: 'Publicada',
  borrador: 'Borrador',
  'revisar-cambios': 'Revisar cambios',
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}
