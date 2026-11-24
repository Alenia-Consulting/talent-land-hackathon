import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Pantalla, { SinGuia } from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import NoiseBadge from '../../components/NoiseBadge.jsx'
import SitePlayer from '../../components/SitePlayer.jsx'
import { FILTRO_VOZ_HZ } from '../../config.js'
import { videoUrlDe } from '../../state/medio.js'
import { useLugar } from '../../state/AppStore.jsx'
import { hablar, parar, vozDisponible } from '../../services/speech.js'

const LUZ = { tenue: 'Luz tenue', normal: 'Luz normal', fuerte: 'Luz fuerte' }

export default function GuiaPaso() {
  const { lugarId, n } = useParams()
  const lugar = useLugar(lugarId)
  const [leyendo, setLeyendo] = useState(false)

  useEffect(() => {
    parar()
    setLeyendo(false)
    return () => parar()
  }, [lugarId, n])

  if (!lugar || !lugar.pasos[Number(n) - 1]) {
    return (
      <SinGuia
        titulo="No encontramos este paso"
        texto="Este paso no existe. Vuelve al inicio de la guía."
        acciones={<Button to={`/guia/${lugarId}`} icono="casa" grande bloque>Ir al inicio de la guía</Button>}
      />
    )
  }

  const total = lugar.pasos.length
  const i = Number(n) - 1
  const paso = lugar.pasos[i]
  const videoUrl = videoUrlDe(lugar, paso)
  const hayAudio = Boolean(videoUrl) && paso.ruido !== null && paso.ruido !== undefined

  async function leer() {
    if (leyendo) {
      parar()
      setLeyendo(false)
      return
    }
    setLeyendo(true)
    await hablar(`${paso.nombre}. ${paso.texto}`)
    setLeyendo(false)
  }

  return (
    <Pantalla
      volver={`/guia/${lugar.id}`}
      etiquetaVolver="Inicio de la guía"
      pie={
        <>
          <div className="rejilla-2">
            {i > 0 ? (
              <Button to={`/guia/${lugar.id}/paso/${i}`} icono="izq" variante="sec">Anterior</Button>
            ) : (
              <span />
            )}
            {i < total - 1 ? (
              <Button to={`/guia/${lugar.id}/paso/${i + 2}`} icono="der">Siguiente</Button>
            ) : (
              <Button to={`/guia/${lugar.id}`} icono="check">Terminar</Button>
            )}
          </div>
        </>
      }
    >
      <div className="paso-cabecera">
        <span className="sec">Paso {i + 1} de {total}</span>
        <NoiseBadge nivel={paso.ruido} mostrarTono />
      </div>
      <h1>{paso.nombre}</h1>
      <SitePlayer
        key={`${lugar.id}-${i}`}
        videoUrl={videoUrl}
        inicio={paso.inicio ?? 0}
        fin={paso.fin}
        paso={paso}
        filtroHz={FILTRO_VOZ_HZ}
      />
      <p className="texto-guia" style={{ marginTop: 16 }}>{paso.texto}</p>
      <p>
        <span className="chip-luz"><Icon nombre="sol" size={18} /> {LUZ[paso.luz] || 'Luz normal'}</span>
      </p>
      {paso.detalles?.length > 0 && (
        <ul className="detalles">{paso.detalles.map((d) => <li key={d}>{d}</li>)}</ul>
      )}
      {paso.ayuda && (
        <p className="texto-guia"><strong>Pide ayuda a:</strong> {paso.ayuda}</p>
      )}

      <div className="apilado">
        {hayAudio ? (
          <Button to={`/guia/${lugar.id}/paso/${i + 1}/sonido`} icono="volumen" variante="sec" bloque>Escuchar el sitio</Button>
        ) : (
          <Button icono="sinSonido" variante="sec" bloque disabled>
            {paso.ruido === null || paso.ruido === undefined ? 'Sin sonido en este paso' : 'Sonido no disponible'}
          </Button>
        )}
        {vozDisponible() && (
          <Button icono="voz" variante="sec" bloque onClick={leer} aria-pressed={leyendo}>
            {leyendo ? 'Parar la voz' : 'Leer en voz alta'}
          </Button>
        )}
      </div>
    </Pantalla>
  )
}
