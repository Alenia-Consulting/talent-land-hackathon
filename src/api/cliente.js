// Única puerta del front al backend. El contrato completo está en docs/API.md.
// Todas las rutas cuelgan de VITE_API_URL (vacío = mismo origen; en desarrollo Vite reenvía /api).
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ErrorApi extends Error {
  constructor(mensaje, { status = 0, code = 'red' } = {}) {
    super(mensaje)
    this.status = status
    this.code = code
  }
}

async function pedir(ruta, { metodo = 'GET', cuerpo, signal } = {}) {
  let resp
  try {
    resp = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal,
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Comprueba que está en marcha.')
  }
  let datos = null
  try {
    datos = await resp.json()
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (!resp.ok) {
    throw new ErrorApi(datos?.error || `El servidor respondió con un error (${resp.status}).`, {
      status: resp.status,
      code: datos?.code || 'http',
    })
  }
  return datos
}

export const api = {
  /** { usuaria, cuentaCliente, categorias, lugares, nuevoLugar } */
  cargarInicial: () => pedir('/bootstrap'),
  guardarUsuaria: (cambios) => pedir('/usuaria', { metodo: 'PATCH', cuerpo: cambios }),
  registrarVisita: (lugarId) => pedir(`/lugares/${encodeURIComponent(lugarId)}/visitas`, { metodo: 'POST' }),
  actualizarPaso: (lugarId, indice, cambios) =>
    pedir(`/lugares/${encodeURIComponent(lugarId)}/pasos/${indice}`, { metodo: 'PATCH', cuerpo: cambios }),
  publicar: (lugarId) => pedir(`/lugares/${encodeURIComponent(lugarId)}/publicar`, { metodo: 'POST' }),

  /**
   * Sube el vídeo y espera a que el backend lo procese. Devuelve el lugar (borrador).
   * opciones: { lugarId?, partes: string[], cortes?: number[], onProgreso({ fase, pct, texto }), signal }
   */
  async analizarVideo(archivo, { lugarId, partes, cortes, onProgreso, signal } = {}) {
    const datos = new FormData()
    datos.append('video', archivo)
    datos.append('meta', JSON.stringify({ lugarId, partes, cortes }))
    const { trabajoId } = await subir(`${BASE}/api/trabajos`, datos, (pct) =>
      onProgreso?.({ fase: 'subir', pct, texto: 'Subiendo el vídeo' }),
    )
    for (;;) {
      if (signal?.aborted) throw new ErrorApi('Cancelado.', { code: 'cancelado' })
      const t = await pedir(`/trabajos/${encodeURIComponent(trabajoId)}`, { signal })
      if (t.estado === 'error') throw new ErrorApi(t.error || 'No se pudo procesar el vídeo.', { code: t.code || 'trabajo' })
      if (t.estado === 'listo') return t.lugar
      onProgreso?.({ fase: t.fase, pct: t.pct ?? 0, texto: t.texto || '' })
      await new Promise((r) => setTimeout(r, 1000))
    }
  },
}

// fetch no informa del avance de una subida: se usa XMLHttpRequest.
function subir(url, datos, onPct) {
  return new Promise((resolver, rechazar) => {
    const x = new XMLHttpRequest()
    x.open('POST', url)
    x.responseType = 'json'
    x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100))
    x.onerror = () => rechazar(new ErrorApi('No hay conexión con el servidor. Comprueba que está en marcha.'))
    x.onload = () =>
      x.status >= 200 && x.status < 300
        ? resolver(x.response)
        : rechazar(new ErrorApi(x.response?.error || `No se pudo subir el vídeo (${x.status}).`, { status: x.status, code: x.response?.code || 'http' }))
    x.send(datos)
  })
}
