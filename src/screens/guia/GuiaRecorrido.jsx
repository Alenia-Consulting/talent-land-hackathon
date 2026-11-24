import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Pantalla, { SinGuia } from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import NoiseBadge from '../../components/NoiseBadge.jsx'
import SitePlayer from '../../components/SitePlayer.jsx'
import { FILTRO_VOZ_HZ } from '../../config.js'
import { videoUrlDe } from '../../state/medio.js'
import { useLugar } from '../../state/AppStore.jsx'

// Recorrido completo: un paso cada vez, con pausa entre pasos. Nunca arranca solo y nunca con sonido.
export default function GuiaRecorrido() {
  const { lugarId } = useParams()
  const lugar = useLugar(lugarId)
  const [i, setI] = useState(0)
  const [fase, setFase] = useState('espera') // espera | reproduciendo | pausa
  const reproductor = useRef(null)

  if (!lugar) {
    return (
      <SinGuia
        texto="Este sitio aún no tiene guía."
        acciones={<Button to="/buscar" icono="buscar" grande bloque>Buscar otro sitio</Button>}
      />
    )
  }

  const total = lugar.pasos.length
  const paso = lugar.pasos[i]
  const ultimo = i === total - 1
  const videoUrl = videoUrlDe(lugar, paso)

  function ver() {
    if (!videoUrl) {
      setFase('pausa') // lugar de ejemplo sin clip
      return
    }
    setFase('reproduciendo')
    reproductor.current?.reproducir()
  }

  function repetir() {
    setFase('reproduciendo')
    reproductor.current?.reiniciar()
  }

  function siguiente() {
    setI((v) => v + 1)
    setFase('espera')
  }

  return (
    <Pantalla
      volver={`/guia/${lugar.id}`}
      etiquetaVolver="Salir del recorrido"
      pie={
        fase === 'espera' ? (
          <Button icono="play" grande bloque onClick={ver}>Ver el paso {i + 1}</Button>
        ) : fase === 'reproduciendo' ? (
          <Button icono="pausa" grande bloque variante="sec" onClick={() => reproductor.current?.pausar()}>Pausar</Button>
        ) : ultimo ? (
          <Button to={`/guia/${lugar.id}`} icono="check" grande bloque>Terminar</Button>
        ) : (
          <Button icono="der" grande bloque onClick={siguiente}>Seguir · paso {i + 2}</Button>
        )
      }
    >
      <div className="paso-cabecera">
        <span className="sec">Paso {i + 1} de {total}</span>
        <NoiseBadge nivel={paso.ruido} />
      </div>
      <h1>{paso.nombre}</h1>
      <SitePlayer
        ref={reproductor}
        key={`${lugar.id}-${i}`}
        videoUrl={videoUrl}
        inicio={paso.inicio ?? 0}
        fin={paso.fin}
        paso={paso}
        controles={false}
        filtroHz={FILTRO_VOZ_HZ}
        onEstado={(r) => r && setFase('reproduciendo')}
        onFin={() => setFase('pausa')}
      />
      <p className="texto-guia" style={{ marginTop: 16 }}>{paso.texto}</p>

      {fase === 'pausa' && (
        <div className="tarjeta" role="status">
          <h2 style={{ marginTop: 0 }}>Paso {i + 1} terminado · {paso.nombre}</h2>
          <p className="texto-guia"><strong>Cuando quieras, seguimos.</strong></p>
          <p className="texto-guia" style={{ marginBottom: 0 }}>
            {ultimo ? 'Este era el último paso.' : `Lo siguiente es: ${lugar.pasos[i + 1].nombre}. No pasa nada hasta que pulses.`}
          </p>
          {videoUrl && (
            <Button icono="repetir" variante="sec" bloque onClick={repetir}>Repetir {paso.nombre}</Button>
          )}
        </div>
      )}
    </Pantalla>
  )
}
