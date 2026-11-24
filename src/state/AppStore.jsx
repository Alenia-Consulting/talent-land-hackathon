import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/cliente.js'

const CLAVE = 'antesala:v1'

const estadoInicial = {
  estado: 'cargando', // cargando | listo | error
  error: null,
  avisoSync: null, // último fallo al guardar en el backend
  usuaria: null,
  cuentaCliente: null,
  categorias: [],
  lugares: [],
  nuevoLugar: null, // lugar del cliente que aún no tiene guía y se va a grabar (puede ser null)
  trabajo: null, // procesado en curso { fase, pct, texto }
}

// Los ajustes de la persona usuaria se recuerdan en el móvil («Se guarda solo en tu móvil»).
// Lo demás (lugares, guías) vive en el backend.
const PERSISTIDAS = ['usuaria']

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function mapearLugar(estado, lugarId, fn) {
  return { ...estado, lugares: estado.lugares.map((l) => (l.id === lugarId ? fn(l) : l)) }
}

export function datosPendientes(lugar) {
  const faltan = []
  for (const p of lugar?.pasos || []) {
    for (const d of p.faltan || []) {
      if (!String(p.completado?.[d] ?? '').trim()) faltan.push({ paso: p.nombre, dato: d })
    }
  }
  return faltan
}

function reducer(estado, accion) {
  switch (accion.tipo) {
    case 'CARGADO': {
      const { datos, guardado } = accion
      return {
        ...estado,
        estado: 'listo',
        error: null,
        categorias: datos.categorias || [],
        nuevoLugar: datos.nuevoLugar || null,
        usuaria: guardado?.usuaria ? { ...datos.usuaria, ...guardado.usuaria } : datos.usuaria,
        cuentaCliente: datos.cuentaCliente,
        lugares: datos.lugares || [],
        trabajo: null,
      }
    }
    case 'ERROR_CARGA':
      return { ...estado, estado: 'error', error: accion.mensaje }
    case 'SET_USUARIA':
      return { ...estado, usuaria: { ...estado.usuaria, ...accion.cambios } }
    case 'SET_COMODIDAD':
      return {
        ...estado,
        usuaria: { ...estado.usuaria, comodidad: { ...estado.usuaria.comodidad, ...accion.cambios } },
      }
    case 'AGREGAR_LUGAR': {
      const resto = estado.lugares.filter((l) => l.id !== accion.lugar.id)
      return { ...estado, lugares: [accion.lugar, ...resto] }
    }
    case 'ACTUALIZAR_LUGAR':
      return mapearLugar(estado, accion.lugarId, (l) => ({ ...l, ...accion.cambios }))
    case 'ACTUALIZAR_PASO':
      return mapearLugar(estado, accion.lugarId, (l) => ({
        ...l,
        pasos: l.pasos.map((p, i) => (i === accion.indice ? { ...p, ...accion.cambios } : p)),
      }))
    case 'COMPLETAR_DATO':
      return mapearLugar(estado, accion.lugarId, (l) => ({
        ...l,
        pasos: l.pasos.map((p, i) =>
          i === accion.indice ? { ...p, completado: { ...p.completado, [accion.dato]: accion.valor } } : p,
        ),
      }))
    case 'PUBLICAR': {
      const lugar = estado.lugares.find((l) => l.id === accion.lugarId)
      if (!lugar || datosPendientes(lugar).length > 0) return estado // publicar exige no tener datos pendientes
      const publicado = mapearLugar(estado, accion.lugarId, (l) => ({
        ...l,
        estado: 'publicada',
        revisada: accion.fecha || hoy(),
      }))
      const ids = estado.cuentaCliente?.guiasIds || []
      return {
        ...publicado,
        cuentaCliente: ids.includes(accion.lugarId)
          ? estado.cuentaCliente
          : { ...estado.cuentaCliente, guiasIds: [accion.lugarId, ...ids] },
      }
    }
    case 'ERROR_SYNC':
      return { ...estado, avisoSync: accion.mensaje }
    case 'SET_ANALISIS':
      return { ...estado, trabajo: accion.trabajo }
    case 'REGISTRAR_VISITA': {
      const fecha = accion.fecha || hoy()
      const historial = [{ lugarId: accion.lugarId, fecha }, ...(estado.usuaria.historial || [])].slice(0, 30)
      return mapearLugar({ ...estado, usuaria: { ...estado.usuaria, historial } }, accion.lugarId, (l) => ({
        ...l,
        visitas30d: (l.visitas30d || 0) + 1,
      }))
    }
    default:
      return estado
  }
}

function leerGuardado() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

function guardar(estado) {
  try {
    const parte = {}
    for (const k of PERSISTIDAS) parte[k] = estado[k]
    localStorage.setItem(CLAVE, JSON.stringify(parte))
  } catch {
    // almacenamiento lleno o bloqueado: la app sigue funcionando sin recordar
  }
}

const Contexto = createContext(null)

export function AppStoreProvider({ children }) {
  const [estado, dispatch] = useReducer(reducer, estadoInicial)
  const temporizador = useRef(null)
  const ultimo = useRef(estado)
  const pendientes = useRef(new Map()) // lugarId:indice → { cambios, t }
  const { pathname } = useLocation()
  ultimo.current = estado

  const cargar = useCallback(async () => {
    try {
      const datos = await api.cargarInicial()
      dispatch({ tipo: 'CARGADO', datos, guardado: leerGuardado() })
    } catch (e) {
      dispatch({ tipo: 'ERROR_CARGA', mensaje: e.message })
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const fallo = useCallback((e) => dispatch({ tipo: 'ERROR_SYNC', mensaje: e.message }), [])

  // Los cambios de un paso se agrupan y se mandan al backend al dejar de escribir.
  const enviarPaso = useCallback(
    (lugarId, indice, cambios) => {
      const k = `${lugarId}:${indice}`
      const previo = pendientes.current.get(k)
      clearTimeout(previo?.t)
      const unido = { ...previo?.cambios, ...cambios }
      if (cambios.completado) unido.completado = { ...previo?.cambios?.completado, ...cambios.completado }
      const t = setTimeout(() => {
        pendientes.current.delete(k)
        api.actualizarPaso(lugarId, indice, unido).catch(fallo)
      }, 600)
      pendientes.current.set(k, { cambios: unido, t })
    },
    [fallo],
  )

  // Todas las pantallas usan este dispatch: aplica el cambio en local y lo manda al backend.
  const despachar = useCallback(
    (accion) => {
      dispatch(accion)
      switch (accion.tipo) {
        case 'ACTUALIZAR_PASO':
          enviarPaso(accion.lugarId, accion.indice, accion.cambios)
          break
        case 'COMPLETAR_DATO':
          enviarPaso(accion.lugarId, accion.indice, { completado: { [accion.dato]: accion.valor } })
          break
        case 'PUBLICAR': {
          const lugar = ultimo.current.lugares.find((l) => l.id === accion.lugarId)
          if (lugar && datosPendientes(lugar).length === 0) {
            // Antes de publicar se vacían los cambios de pasos que aún esperan.
            const esperas = [...pendientes.current.entries()].filter(([k]) => k.startsWith(`${accion.lugarId}:`))
            for (const [k, v] of esperas) {
              clearTimeout(v.t)
              pendientes.current.delete(k)
            }
            Promise.all(esperas.map(([k, v]) => api.actualizarPaso(accion.lugarId, Number(k.split(':')[1]), v.cambios)))
              .then(() => api.publicar(accion.lugarId))
              .catch(fallo)
          }
          break
        }
        case 'REGISTRAR_VISITA':
          api.registrarVisita(accion.lugarId).catch(fallo)
          break
        default:
      }
    },
    [enviarPaso, fallo],
  )

  // Persistencia local (solo ajustes de la persona usuaria) con debounce, y copia al backend.
  useEffect(() => {
    if (estado.estado !== 'listo') return undefined
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      guardar(estado)
      api.guardarUsuaria(estado.usuaria).catch(() => {})
    }, 300)
    return () => clearTimeout(temporizador.current)
  }, [estado.usuaria, estado.estado])

  // Modo tenue y tamaño de texto: ajustes de la persona usuaria, no del cliente que graba y revisa.
  useEffect(() => {
    const esCliente = /^\/(cliente|grabar|revisar|panel|publicar)/.test(pathname)
    const c = estado.usuaria?.comodidad
    const raiz = document.documentElement
    if (c?.modoTenue && !esCliente) raiz.setAttribute('data-tema', 'tenue')
    else raiz.removeAttribute('data-tema')
    raiz.setAttribute('data-tamano', esCliente ? '1' : String(c?.tamanoTexto ?? 1))
  }, [estado.usuaria, pathname])

  const valor = useMemo(() => ({ estado, dispatch: despachar, cargar }), [estado, despachar, cargar])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** Lugar por id (o undefined si todavía no existe, como el nuevo antes de subir el vídeo). */
export function useLugar(id) {
  const { estado } = useAppStore()
  return estado.lugares.find((l) => l.id === id)
}

export function useAppStore() {
  const v = useContext(Contexto)
  if (!v) throw new Error('useAppStore debe usarse dentro de AppStoreProvider')
  return v
}
