import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { PARTES_POR_DEFECTO } from '../../config.js'
import { dejarVideo, leerPartes } from '../../services/videoPendiente.js'
import { minutosSegundos } from '../../state/formato.js'

const MAX_SEGUNDOS = 120

function tipoSoportado() {
  const tipos = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  return tipos.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || ''
}

export default function Grabando() {
  const { estado } = useAppStore()
  const navegar = useNavigate()
  const partes = leerPartes(estado.nuevoLugar?.partes || PARTES_POR_DEFECTO)

  const videoRef = useRef(null)
  const flujoRef = useRef(null)
  const grabadorRef = useRef(null)
  const trozos = useRef([])
  const segundosRef = useRef(0)
  const marcasRef = useRef([]) // instante en que se llegó a cada parte (a partir de la 2.ª)

  const [fase, setFase] = useState('preparando') // preparando | listo | grabando | pausa | error
  const [error, setError] = useState('')
  const [segundos, setSegundos] = useState(0)
  const [marcas, setMarcas] = useState([])

  const cerrarFlujo = useCallback(() => {
    flujoRef.current?.getTracks().forEach((t) => t.stop())
    flujoRef.current = null
  }, [])

  useEffect(() => {
    let vivo = true
    async function abrir() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setError('Este navegador no puede grabar. Usa un vídeo que ya tengas grabado.')
        setFase('error')
        return
      }
      try {
        const f = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
        if (!vivo) {
          f.getTracks().forEach((t) => t.stop())
          return
        }
        flujoRef.current = f
        videoRef.current.srcObject = f
        videoRef.current.play().catch(() => {})
        setFase('listo')
      } catch {
        setError('No hay permiso para la cámara o el micrófono. Actívalo en el navegador o usa un vídeo que ya tengas.')
        setFase('error')
      }
    }
    abrir()
    return () => {
      vivo = false
      if (grabadorRef.current && grabadorRef.current.state !== 'inactive') {
        grabadorRef.current.onstop = null
        grabadorRef.current.stop()
      }
      cerrarFlujo()
    }
  }, [cerrarFlujo])

  const terminar = useCallback(() => {
    const g = grabadorRef.current
    if (!g || g.state === 'inactive') return
    g.onstop = () => {
      const blob = new Blob(trozos.current, { type: g.mimeType || 'video/webm' })
      cerrarFlujo()
      dejarVideo(blob, { cortes: marcasRef.current.length === partes.length - 1 ? marcasRef.current : undefined })
      navegar('/grabar/procesando')
    }
    g.stop()
  }, [cerrarFlujo, navegar, partes.length])

  // Cronómetro: solo avanza mientras se graba.
  useEffect(() => {
    if (fase !== 'grabando') return undefined
    const id = setInterval(() => {
      segundosRef.current += 0.5
      setSegundos(segundosRef.current)
      if (segundosRef.current >= MAX_SEGUNDOS) terminar()
    }, 500)
    return () => clearInterval(id)
  }, [fase, terminar])

  function empezar() {
    const tipo = tipoSoportado()
    const g = new MediaRecorder(flujoRef.current, tipo ? { mimeType: tipo } : undefined)
    trozos.current = []
    g.ondataavailable = (e) => e.data.size > 0 && trozos.current.push(e.data)
    g.start(1000)
    grabadorRef.current = g
    setFase('grabando')
  }

  function pausarOContinuar() {
    const g = grabadorRef.current
    if (fase === 'grabando') {
      g.pause()
      setFase('pausa')
    } else {
      g.resume()
      setFase('grabando')
    }
  }

  function llegue() {
    if (marcasRef.current.length >= partes.length - 1) return
    marcasRef.current = [...marcasRef.current, segundosRef.current]
    setMarcas(marcasRef.current)
  }

  function deshacer() {
    marcasRef.current = marcasRef.current.slice(0, -1)
    setMarcas(marcasRef.current)
  }

  const parteActual = marcas.length // índice de la parte en la que estás
  const siguiente = partes[parteActual + 1]
  const grabando = fase === 'grabando' || fase === 'pausa'

  return (
    <Pantalla titulo={grabando ? 'Grabando' : 'Graba el recorrido'} volver={grabando ? undefined : '/grabar/comprobar'}>
      {fase === 'error' ? (
        <div className="aviso error" role="alert">
          <Icon nombre="alerta" />
          <div>
            <p style={{ margin: 0 }}>{error}</p>
            <div className="apilado"><Button to="/grabar/subir" icono="subir" variante="sec">Ya tengo un vídeo grabado</Button></div>
          </div>
        </div>
      ) : (
        <>
          {grabando && siguiente && (
            <div className="tarjeta" role="status" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 20, margin: '0 0 6px' }}>Siguiente parte: {siguiente}</h2>
              <p className="sec" style={{ margin: 0 }}>
                Cuando llegues, pulsa «Llegué» y quédate quieto 3 segundos. Así sale una foto clara y se mide el sonido.
              </p>
            </div>
          )}
          <div className="visor">
            <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
          </div>
          <div className="fila-espacio" style={{ margin: '12px 0' }}>
            <span className="fila">
              {grabando && <span className="punto-rec" aria-hidden="true" />}
              <span className="cronometro" role="timer" aria-label={`Llevas ${minutosSegundos(segundos)} de ${minutosSegundos(MAX_SEGUNDOS)}`}>
                {minutosSegundos(segundos)}
              </span>
            </span>
            <span className="sec">máximo {minutosSegundos(MAX_SEGUNDOS)}</span>
          </div>

          <div className="linea-partes" aria-hidden="true">
            {partes.map((p, i) => (
              <span key={p} className={i < parteActual ? 'hecha' : i === parteActual && grabando ? 'actual' : ''} />
            ))}
          </div>
          <ol className="envuelto lista-limpia" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 14 }} aria-label="Partes del recorrido">
            {partes.map((p, i) => (
              <li key={p} style={{ fontWeight: i === parteActual && grabando ? 700 : 400 }}>{i < parteActual ? '✓ ' : ''}{p}</li>
            ))}
          </ol>
          <p className="lectura" style={{ marginTop: 8 }}>
            {grabando ? <>Ahora: <strong>{partes[parteActual]}</strong></> : `${partes.length} partes: ${partes.join(', ')}.`}
          </p>

          <div className="apilado">
            {!grabando && (
              <Button icono="grabar" variante="grabar" grande bloque onClick={empezar} disabled={fase !== 'listo'}>
                Empezar a grabar
              </Button>
            )}
            {grabando && (
              <>
                {siguiente && (
                  <Button icono="pin" grande bloque onClick={llegue} disabled={fase === 'pausa'}>
                    Llegué a: {siguiente}
                  </Button>
                )}
                <div className="rejilla-2">
                  <Button icono="repetir" variante="sec" onClick={deshacer} disabled={marcas.length === 0}>Deshacer</Button>
                  <Button icono={fase === 'pausa' ? 'play' : 'pausa'} variante="sec" onClick={pausarOContinuar}>
                    {fase === 'pausa' ? 'Seguir' : 'Pausar'}
                  </Button>
                </div>
                <Button icono="parar" variante="grabar" grande bloque onClick={terminar}>Terminar</Button>
              </>
            )}
          </div>
        </>
      )}
    </Pantalla>
  )
}
