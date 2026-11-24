import { Link, useParams } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import NoiseBadge from '../../components/NoiseBadge.jsx'
import StepThumb from '../../components/StepThumb.jsx'
import OrigenGuia from '../../components/OrigenGuia.jsx'
import { haceTiempo } from '../../state/formato.js'
import { datosPendientes, useLugar } from '../../state/AppStore.jsx'

export default function Borrador() {
  const { lugarId } = useParams()
  const lugar = useLugar(lugarId)

  if (!lugar) {
    return (
      <Pantalla titulo="Todavía no hay borrador" volver="/cliente">
        <p className="lectura">Sube el vídeo del recorrido y la IA monta el borrador.</p>
        <div className="apilado">
          <Button to="/grabar" icono="camara" grande bloque>Grabar un recorrido</Button>
          <Button to="/grabar/subir" icono="subir" variante="sec" bloque>Subir un vídeo</Button>
        </div>
      </Pantalla>
    )
  }

  const pendientes = datosPendientes(lugar)
  const creada = lugar.creadoEn ? haceTiempo(lugar.creadoEn) : ''
  return (
    <Pantalla
      titulo={lugar.nombre}
      volver="/cliente"
      subtitulo={[`${lugar.pasos.length} pasos`, lugar.duracionVideo ? `${lugar.duracionVideo} de vídeo` : '', creada ? `creada ${creada}` : ''].filter(Boolean).join(' · ')}
      pie={
        <>
          <Button to={`/panel/${lugar.id}`} icono="editar" grande bloque>
            {lugar.estado === 'publicada' ? 'Editar la guía' : 'Completar y publicar'}
          </Button>
          <Button to={`/guia/${lugar.id}`} icono="ojo" variante="sec" bloque>Ver como persona usuaria</Button>
        </>
      }
    >
      <OrigenGuia lugar={lugar} />
      {lugar.resumen && <p className="lectura">{lugar.resumen}</p>}

      {pendientes.length > 0 ? (
        <div className="aviso" role="status">
          <Icon nombre="alerta" />
          <span>
            {lugar.origen === 'gemini' ? 'La IA ha dejado ' : 'Han quedado '}{pendientes.length === 1 ? '1 dato' : `${pendientes.length} datos`} en blanco porque no salían en el vídeo. Complétalos antes de publicar.
          </span>
        </div>
      ) : (
        lugar.estado !== 'publicada' && (
          <div className="aviso" role="status">
            <Icon nombre="check" />
            <span>No falta ningún dato. Ya puedes publicar.</span>
          </div>
        )
      )}

      <ol className="lista-limpia" style={{ marginTop: 16 }}>
        {lugar.pasos.map((p, i) => {
          const faltan = (p.faltan || []).filter((d) => !String(p.completado?.[d] ?? '').trim())
          return (
            <li key={`${p.nombre}-${i}`}>
              <Link className="tarjeta tarjeta-enlace" to={`/panel/${lugar.id}?paso=${i + 1}`}>
                <StepThumb paso={p} />
                <div>
                  <h3>{i + 1}. {p.nombre}</h3>
                  <div className="envuelto" style={{ marginBottom: 6 }}>
                    <NoiseBadge nivel={p.ruido} />
                    {faltan.length > 0 && <span className="etiqueta-ambar">Falta: {faltan.join(', ')}</span>}
                  </div>
                  <p className="sec">{p.texto}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
      {lugar.alertas?.length > 0 && (
        <section style={{ marginTop: 16 }} aria-labelledby="alertas-b">
          <h2 id="alertas-b">Avisos</h2>
          <ul className="detalles">{lugar.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}
    </Pantalla>
  )
}
