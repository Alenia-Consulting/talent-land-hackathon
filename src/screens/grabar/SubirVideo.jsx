import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { dejarVideo } from '../../services/videoPendiente.js'

const ES_VIDEO = /\.(mp4|mov)$/i

function tamano(bytes) {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`
}

export default function SubirVideo() {
  const { estado } = useAppStore()
  const navegar = useNavigate()
  const entrada = useRef(null)
  const [archivo, setArchivo] = useState(null)
  const [url, setUrl] = useState(null)
  const [encima, setEncima] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!archivo) {
      setUrl(null)
      return undefined
    }
    const u = URL.createObjectURL(archivo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [archivo])

  function elegir(f) {
    if (!f) return
    if (!ES_VIDEO.test(f.name) && !/^video\/(mp4|quicktime)$/.test(f.type)) {
      setError('Ese archivo no es un vídeo MP4 o MOV. Elige un archivo .mp4 o .mov.')
      return
    }
    setError('')
    setArchivo(f)
  }

  function usar(f) {
    dejarVideo(f)
    navegar('/grabar/procesando')
  }

  return (
    <Pantalla
      titulo="Sube tu vídeo"
      volver="/grabar"
      subtitulo={`Un recorrido de unos 2 minutos${estado.nuevoLugar ? ` de ${estado.nuevoLugar.nombre}` : ''}.`}
      pie={
        <Button icono="check" grande bloque disabled={!archivo} onClick={() => usar(archivo)}>
          Usar este vídeo
        </Button>
      }
    >
      <div
        className={`zona-soltar${encima ? ' encima' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault()
          setEncima(false)
          elegir(e.dataTransfer.files?.[0])
        }}
      >
        <Icon nombre="subir" size={36} />
        <p className="lectura" style={{ margin: 0 }}>Arrastra aquí tu vídeo</p>
        <input
          ref={entrada}
          type="file"
          accept=".mp4,.mov,video/mp4,video/quicktime"
          className="sr-only"
          id="archivo-video"
          onChange={(e) => elegir(e.target.files?.[0])}
        />
        <Button icono="lista" variante="sec" onClick={() => entrada.current.click()}>Elegir un archivo</Button>
        <span className="sec">MP4 o MOV</span>
      </div>

      {error && (
        <div className="aviso error" role="alert" style={{ marginTop: 16 }}>
          <Icon nombre="alerta" />
          <span>{error}</span>
        </div>
      )}

      {archivo && url && (
        <section aria-label="Vista previa" style={{ marginTop: 16 }}>
          <video src={url} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 18 }} aria-label="Vista previa del vídeo" />
          <p className="sec" style={{ marginTop: 8 }}>{archivo.name} · {tamano(archivo.size)}</p>
        </section>
      )}

    </Pantalla>
  )
}
