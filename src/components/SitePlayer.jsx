import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Button from './Button.jsx'
import StepThumb from './StepThumb.jsx'
import { usaFoto } from '../state/medio.js'

/**
 * Reproduce un tramo [inicio, fin] del vídeo del lugar (lo sirve el backend). No corta nada: salta a `inicio` y se detiene en `fin`.
 * Calma: nunca arranca solo y el vídeo va sin sonido salvo que `sonido` sea true
 * (la pantalla Guía-3 avisa siempre antes). Con sonido, el audio pasa por un filtro paso bajo
 * (el ambiente se oye, las conversaciones no) y sube poco a poco (~2 s).
 *
 * Props: videoUrl (URL del vídeo, la da el backend en lugar.videoUrl), inicio, fin, paso (para el póster), sonido, filtroHz, controles, onFin, onEstado(reproduciendo).
 * `ref` expone reproducir(), pausar() y reiniciar().
 */
export default function SitePlayer({
  videoUrl,
  inicio = 0,
  fin,
  paso,
  sonido = false,
  filtroHz = 450,
  controles = true,
  onFin,
  onEstado,
  ref,
}) {
  const videoRef = useRef(null)
  const audio = useRef(null) // { ctx, ganancia }
  const [url, setUrl] = useState(null)
  const [estadoVideo, setEstadoVideo] = useState(videoUrl ? 'cargando' : 'sin-video')
  const [reproduciendo, setReproduciendo] = useState(false)

  const cambiarEstado = useCallback(
    (valor) => {
      setReproduciendo(valor)
      onEstado?.(valor)
    },
    [onEstado],
  )

  // El vídeo lo sirve el backend: el navegador lo pide al reproducir (necesita soportar Range).
  useEffect(() => {
    if (!videoUrl) {
      setUrl(null)
      setEstadoVideo('sin-video')
      return
    }
    setUrl(videoUrl)
    setEstadoVideo('listo')
  }, [videoUrl])

  // Se detiene al salir de la pantalla.
  useEffect(() => {
    const v = videoRef.current
    return () => {
      v?.pause()
      audio.current?.ctx.close().catch(() => {})
      audio.current = null
    }
  }, [])

  // Sonido: filtro paso bajo + rampa de ganancia. El grafo se crea la primera vez que se pide sonido.
  useEffect(() => {
    const v = videoRef.current
    if (!v || estadoVideo !== 'listo') return
    if (sonido) {
      if (!audio.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()
        const origen = ctx.createMediaElementSource(v)
        const filtro = ctx.createBiquadFilter()
        filtro.type = 'lowpass'
        filtro.frequency.value = filtroHz
        const ganancia = ctx.createGain()
        ganancia.gain.value = 0
        origen.connect(filtro).connect(ganancia).connect(ctx.destination)
        audio.current = { ctx, ganancia }
      }
      v.muted = false
      const { ctx, ganancia } = audio.current
      ctx.resume?.()
      const ahora = ctx.currentTime
      ganancia.gain.cancelScheduledValues(ahora)
      ganancia.gain.setValueAtTime(0.0001, ahora)
      ganancia.gain.linearRampToValueAtTime(0.8, ahora + 2)
    } else if (audio.current) {
      const { ctx, ganancia } = audio.current
      ganancia.gain.cancelScheduledValues(ctx.currentTime)
      ganancia.gain.setValueAtTime(0, ctx.currentTime)
    } else {
      v.muted = true
    }
  }, [sonido, filtroHz, estadoVideo, url])

  const pausar = useCallback(() => {
    videoRef.current?.pause()
  }, [])

  const reproducir = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    const tope = fin ?? v.duration
    if (v.currentTime < inicio || v.currentTime >= tope - 0.05) v.currentTime = inicio
    audio.current?.ctx.resume?.()
    try {
      await v.play()
    } catch {
      cambiarEstado(false)
    }
  }, [inicio, fin, cambiarEstado])

  const reiniciar = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = inicio
    return reproducir()
  }, [inicio, reproducir])

  useImperativeHandle(ref, () => ({ reproducir, pausar, reiniciar }), [reproducir, pausar, reiniciar])

  // Al cambiar de tramo, el vídeo vuelve a su inicio y queda en pausa.
  useEffect(() => {
    const v = videoRef.current
    if (!v || estadoVideo !== 'listo') return
    v.pause()
    if (v.readyState >= 1) v.currentTime = inicio
  }, [inicio, fin, estadoVideo])

  // Vigila el final del tramo mientras reproduce.
  useEffect(() => {
    if (!reproduciendo) return undefined
    const v = videoRef.current
    let id
    const vigilar = () => {
      if (fin != null && v.currentTime >= fin) {
        v.pause()
        v.currentTime = inicio
        onFin?.()
        return
      }
      id = requestAnimationFrame(vigilar)
    }
    id = requestAnimationFrame(vigilar)
    return () => cancelAnimationFrame(id)
  }, [reproduciendo, fin, inicio, onFin])

  if (estadoVideo !== 'listo') {
    const esFoto = usaFoto(paso)
    const imagen = (esFoto && paso.fotoSubida) || paso?.fotoDataUrl || paso?.imagen
    return (
      <div className="player">
        <div className="player-marco">
          {imagen ? (
            <img className="player-foto" src={imagen} alt={paso ? `Foto: ${paso.nombre}` : 'Foto del sitio'} />
          ) : (
            paso && <StepThumb paso={paso} tamano={160} redondeo={0} />
          )}
        </div>
        <p className="sec player-aviso" role="status">
          {estadoVideo === 'cargando' ? 'Cargando el clip…' : esFoto ? 'Foto del sitio.' : 'Este lugar no tiene clip.'}
        </p>
      </div>
    )
  }

  return (
    <div className="player">
      <div className="player-marco">
        <video
          crossOrigin="anonymous"
          ref={videoRef}
          src={url}
          poster={paso?.fotoDataUrl}
          muted
          playsInline
          preload="auto"
          onPlay={() => cambiarEstado(true)}
          onPause={() => cambiarEstado(false)}
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = inicio
          }}
          aria-label={paso ? `Clip: ${paso.nombre}` : 'Clip del sitio'}
        />
      </div>
      {controles && (
        <div className="player-controles">
          {reproduciendo ? (
            <Button icono="pausa" variante="sec" onClick={pausar}>Pausar</Button>
          ) : (
            <Button icono="play" onClick={reproducir}>Ver el clip</Button>
          )}
          <Button icono="repetir" variante="sec" onClick={reiniciar}>Repetir</Button>
        </div>
      )}
    </div>
  )
}
