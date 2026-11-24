import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Pantalla, { SinGuia } from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import NoiseBadge from '../../components/NoiseBadge.jsx'
import SitePlayer from '../../components/SitePlayer.jsx'
import { FILTRO_VOZ_HZ } from '../../config.js'
import { videoUrlDe } from '../../state/medio.js'
import { useLugar } from '../../state/AppStore.jsx'

const AVISO = {
  tranquilo: 'Este sonido es tranquilo. Se oye poco.',
  medio: 'Este sonido es medio. Se oye bastante.',
  ruidoso: 'Este sonido es ruidoso. Puede molestar. Si quieres, ponte cascos o baja el volumen antes.',
}

// Nada suena sin que la persona lo pida: el aviso se muestra siempre antes y no se puede desactivar.
export default function GuiaSonido() {
  const { lugarId, n } = useParams()
  const lugar = useLugar(lugarId)
  const [escuchando, setEscuchando] = useState(false)
  const reproductor = useRef(null)

  useEffect(() => {
    if (escuchando) reproductor.current?.reiniciar()
  }, [escuchando])

  const paso = lugar?.pasos[Number(n) - 1]
  if (!paso || !videoUrlDe(lugar, paso) || !paso.ruido) {
    return (
      <SinGuia
        titulo="No hay sonido aquí"
        texto="Este paso no tiene sonido guardado."
        acciones={<Button to={`/guia/${lugarId}/paso/${n}`} icono="izq" grande bloque>Volver al paso</Button>}
      />
    )
  }
  const volver = `/guia/${lugar.id}/paso/${Number(n)}`

  return (
    <Pantalla titulo={`Sonido: ${paso.nombre}`} volver={volver} etiquetaVolver="Volver al paso">
      <div className="tarjeta">
        <p className="fila"><NoiseBadge nivel={paso.ruido} mostrarTono /></p>
        <p className="texto-guia" role="status">{AVISO[paso.ruido]}</p>
        <ul className="detalles">
          <li>Se oye el ambiente del sitio.</li>
          <li>Las voces se filtran: no se entienden las conversaciones.</li>
          <li>Empieza bajito y sube poco a poco.</li>
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
          <SitePlayer
            ref={reproductor}
            key={`${lugar.id}-${n}`}
            videoUrl={videoUrlDe(lugar, paso)}
            inicio={paso.inicio ?? 0}
            fin={paso.fin}
            paso={paso}
            sonido={escuchando}
            controles={escuchando}
            filtroHz={FILTRO_VOZ_HZ}
          />
      </div>

      <div className="apilado">
        {escuchando ? (
          <Button icono="sinSonido" grande bloque onClick={() => setEscuchando(false)}>Parar el sonido</Button>
        ) : (
          <>
            <Button icono="volumen" grande bloque onClick={() => setEscuchando(true)}>Escuchar ahora</Button>
            <Button to={volver} icono="cerrar" variante="sec" bloque>Ahora no</Button>
          </>
        )}
      </div>
      <p className="sec fila" style={{ marginTop: 12, fontSize: 15 }}>
        <Icon nombre="alerta" size={18} /> Puedes parar cuando quieras.
      </p>
    </Pantalla>
  )
}
