import { useEffect, useRef, useState } from 'react'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { UMBRALES_LUZ } from '../../config.js'

// Solo se comprueba lo que se puede medir de verdad: la luz con la cámara y el sonido con el micrófono.
export default function Comprobar() {
  const umbrales = UMBRALES_LUZ
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [luz, setLuz] = useState(null) // luminancia 0–255
  const [nivelSonido, setNivelSonido] = useState(null) // dBFS

  useEffect(() => {
    let vivo = true
    let flujo
    let ctxAudio
    let temporizador
    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Usa un vídeo que ya tengas grabado.')
        return
      }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
      } catch {
        setError('No hay permiso para la cámara o el micrófono. Actívalo en el navegador o usa un vídeo que ya tengas.')
        return
      }
      if (!vivo) {
        flujo.getTracks().forEach((t) => t.stop())
        return
      }
      const v = videoRef.current
      v.srcObject = flujo
      v.play().catch(() => {})

      const lienzo = document.createElement('canvas')
      lienzo.width = 48
      lienzo.height = 27
      const ctx = lienzo.getContext('2d', { willReadFrequently: true })

      let analizador
      if (flujo.getAudioTracks().length > 0) {
        ctxAudio = new (window.AudioContext || window.webkitAudioContext)()
        analizador = ctxAudio.createAnalyser()
        analizador.fftSize = 1024
        ctxAudio.createMediaStreamSource(flujo).connect(analizador)
      }
      const muestras = new Float32Array(1024)
      temporizador = setInterval(() => {
        if (v.videoWidth) {
          ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height)
          const d = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data
          let suma = 0
          for (let i = 0; i < d.length; i += 4) suma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
          setLuz(suma / (d.length / 4))
        }
        if (analizador) {
          analizador.getFloatTimeDomainData(muestras)
          let s = 0
          for (const m of muestras) s += m * m
          setNivelSonido(10 * Math.log10(s / muestras.length + 1e-12))
        }
      }, 500)
    }
    iniciar()
    return () => {
      vivo = false
      clearInterval(temporizador)
      ctxAudio?.close().catch(() => {})
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  let textoLuz = 'Midiendo la luz…'
  let luzBien = null
  if (luz !== null) {
    if (luz < umbrales.oscuro) {
      textoLuz = 'Hay poca luz. Enciende más luces.'
      luzBien = false
    } else if (luz > umbrales.deslumbra) {
      textoLuz = 'Hay demasiada luz. Evita apuntar a la ventana.'
      luzBien = false
    } else {
      textoLuz = 'La luz es buena.'
      luzBien = true
    }
  }
  const textoSonido =
    nivelSonido === null ? 'Sin micrófono' : nivelSonido < -60 ? 'No se oye nada. Comprueba el micrófono' : 'Normal para grabar'
  const valorLuz = luz === null ? 'Midiendo…' : luz < umbrales.oscuro ? 'Poca' : luz > umbrales.deslumbra ? 'Demasiada' : 'Buena'
  const titular = luzBien === false ? 'Casi listo. Un detalle con la luz' : luzBien ? 'Todo listo para grabar' : 'Comprobando…'

  return (
    <Pantalla
      titulo={error ? 'Comprueba la cámara' : titular}
      volver="/grabar"
      subtitulo="Paso 2 de 3 · Comprobando"
      pie={
        luzBien === false ? (
          <Button to="/grabar/grabando" icono="grabar" variante="sec" grande bloque disabled={Boolean(error)}>Grabar igualmente</Button>
        ) : (
          <Button to="/grabar/grabando" icono="grabar" variante="grabar" grande bloque disabled={Boolean(error)}>Ya está, empezar a grabar</Button>
        )
      }
    >
      {error ? (
        <div className="aviso error" role="alert">
          <Icon nombre="alerta" />
          <div>
            <p style={{ margin: 0 }}>{error}</p>
            <Button to="/grabar/subir" icono="subir" variante="sec">Ya tengo un vídeo grabado</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="visor">
            <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
          </div>
          <ul className="lista-limpia" style={{ marginTop: 16 }} aria-live="polite">
            <li className="tarjeta fila-espacio">
              <span className="fila"><Icon nombre={luzBien === false ? 'alerta' : 'sol'} /> <strong>Luz</strong></span>
              <span>{valorLuz}</span>
            </li>
            {luzBien === false && <li className="aviso"><Icon nombre="alerta" /><span>{textoLuz}</span></li>}
            <li className="tarjeta fila-espacio">
              <span className="fila"><Icon nombre="volumen" /> <strong>Sonido ambiente</strong></span>
              <span>{textoSonido}</span>
            </li>
          </ul>
        </>
      )}
    </Pantalla>
  )
}
