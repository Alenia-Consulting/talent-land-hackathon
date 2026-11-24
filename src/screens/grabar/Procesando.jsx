import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { api } from '../../api/cliente.js'
import { PARTES_POR_DEFECTO } from '../../config.js'
import { leerPartes, leerVideoPendiente, limpiarVideoPendiente } from '../../services/videoPendiente.js'

const FASES = [
  ['subir', 'Subir el vídeo'],
  ['fotogramas', 'Sacar los fotogramas'],
  ['ruido', 'Medir el ruido'],
  ['tramos', 'Repartir los tramos'],
  ['ia', 'Escribir la guía'],
  ['montar', 'Montar la guía'],
]

export default function Procesando() {
  const { estado, dispatch } = useAppStore()
  const navegar = useNavigate()
  const iniciado = useRef(false)
  const montado = useRef(true)
  const [progreso, setProgreso] = useState({ fase: 'subir', pct: 0, texto: 'Empezando' })
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const pendiente = leerVideoPendiente()

  useEffect(() => {
    montado.current = true
    if (iniciado.current || !pendiente) return undefined
    iniciado.current = true
    const { blob, opciones } = pendiente
    api
      .analizarVideo(blob, {
        lugarId: estado.nuevoLugar?.id,
        partes: leerPartes(estado.nuevoLugar?.partes || PARTES_POR_DEFECTO),
        cortes: opciones.cortes,
      onProgreso: (p) => {
        if (!montado.current) return
        setProgreso(p)
        dispatch({ tipo: 'SET_ANALISIS', trabajo: p })
      },
    })
      .then((lugar) => {
        dispatch({ tipo: 'AGREGAR_LUGAR', lugar })
        dispatch({ tipo: 'SET_ANALISIS', trabajo: null })
        limpiarVideoPendiente()
        if (montado.current) navegar(`/revisar/${lugar.id}`, { replace: true })
      })
      .catch((e) => {
        dispatch({ tipo: 'SET_ANALISIS', trabajo: null })
        iniciado.current = false
        if (montado.current) setError(e.message || 'No se pudo procesar el vídeo.')
      })
    return () => {
      montado.current = false
    }
  }, [pendiente, intento, estado.nuevoLugar, dispatch, navegar])

  if (!pendiente) {
    return (
      <Pantalla titulo="No hay vídeo que procesar" volver="/grabar">
        <p className="lectura">Primero sube o graba un vídeo del recorrido.</p>
        <div className="apilado">
          <Button to="/grabar/subir" icono="subir" grande bloque>Subir un vídeo</Button>
        </div>
      </Pantalla>
    )
  }

  const indice = FASES.findIndex(([id]) => id === progreso.fase)
  const total = Math.round(((indice + progreso.pct / 100) / FASES.length) * 100)

  return (
    <Pantalla titulo="Estamos montando tu guía" subtitulo="Paso 3 de 3. Deja esta pantalla abierta unos segundos: el borrador se abre solo.">
      {error ? (
        <>
          <div className="aviso error" role="alert">
            <Icon nombre="alerta" />
            <span>{error}</span>
          </div>
          <div className="apilado">
            <Button icono="repetir" grande bloque onClick={() => {
              setError('')
              setIntento((n) => n + 1)
            }}>Volver a intentarlo</Button>
            <Button to="/grabar/subir" icono="subir" variante="sec" bloque>Subir otro vídeo</Button>
          </div>
        </>
      ) : (
        <>
          <div
            className="progreso"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={total}
            aria-label="Progreso total"
          >
            <span style={{ width: `${total}%` }} />
          </div>
          <p role="status" className="sec" style={{ marginTop: 8 }}>{progreso.texto}</p>
          <ul className="lista-limpia" style={{ marginTop: 16 }}>
            {FASES.map(([id, nombre], i) => {
              const hecha = i < indice
              const activa = i === indice
              return (
                <li key={id} className={`tarea${hecha ? ' hecha' : ''}${activa ? ' activa' : ''}`}>
                  <span className="tarea-marca">{hecha && <Icon nombre="check" size={16} />}</span>
                  <span>{nombre}</span>
                </li>
              )
            })}
            <li className="tarea prevista">
              <span className="tarea-marca" />
              <span>Difuminar caras · previsto</span>
            </li>
          </ul>
          <p className="sec" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', marginTop: 16 }}>TUS PARTES</p>
          <div className="envuelto">
            {leerPartes(estado.nuevoLugar?.partes || PARTES_POR_DEFECTO).map((p) => <span key={p} className="chip" style={{ cursor: 'default' }}>{p}</span>)}
          </div>
        </>
      )}
    </Pantalla>
  )
}
