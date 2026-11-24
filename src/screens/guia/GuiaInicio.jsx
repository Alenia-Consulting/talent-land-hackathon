import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Pantalla, { SinGuia } from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import NoiseBadge from '../../components/NoiseBadge.jsx'
import StepThumb from '../../components/StepThumb.jsx'
import Logo from '../../components/Logo.jsx'
import Switch from '../../components/Switch.jsx'
import { useAppStore, useLugar } from '../../state/AppStore.jsx'
import { fechaCorta } from '../../state/formato.js'
import { hablar, parar, vozDisponible } from '../../services/speech.js'

export default function GuiaInicio() {
  const { lugarId } = useParams()
  const lugar = useLugar(lugarId)
  const { estado, dispatch } = useAppStore()
  const comodidad = estado.usuaria.comodidad
  const [intereses, setIntereses] = useState([])
  const [leyendo, setLeyendo] = useState(false)

  useEffect(() => () => parar(), [])

  const INTERESES = [
    ['esperar', 'Dónde esperar', (p) => /espera|comedor|recepci/i.test(p.nombre)],
    ['ruido', 'Zonas con ruido', (p) => p.ruido && p.ruido !== 'tranquilo'],
    ['banos', 'Baños', (p) => /ba(ñ|n)os|aseo/i.test(p.nombre)],
    ['ayuda', 'A quién pedir ayuda', (p) => Boolean(p.ayuda)],
    ['salir', 'Por dónde salir', (p) => /salida/i.test(p.nombre)],
  ]
  function alternarInteres(id) {
    setIntereses((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  }

  if (!lugar) {
    return (
      <SinGuia
        texto="Este sitio aún no tiene guía de Antesala. Puedes pedirle que la haga."
        acciones={<Button to="/buscar" icono="buscar" grande bloque>Buscar otro sitio</Button>}
      />
    )
  }

  const borrador = lugar.estado === 'borrador'
  const pasosVistos = intereses.length === 0 ? lugar.pasos.map((p, i) => [p, i]) : lugar.pasos.map((p, i) => [p, i]).filter(([p]) => intereses.some((id) => INTERESES.find(([f]) => f === id)[2](p)))
  const resumenVoz = `${lugar.nombre}. ${lugar.resumen || lugar.resumenCerca || ''}`

  async function leer() {
    if (leyendo) {
      parar()
      setLeyendo(false)
      return
    }
    setLeyendo(true)
    await hablar(resumenVoz)
    setLeyendo(false)
  }

  return (
    <Pantalla
      titulo={lugar.nombre}
      volver="/buscar"
      subtitulo={lugar.direccion}
      pie={
        <>
          <Button
            to={`/guia/${lugar.id}/paso/1`}
            icono="der"
            grande
            bloque
            onClick={() => dispatch({ tipo: 'REGISTRAR_VISITA', lugarId: lugar.id })}
          >
            Empezar paso a paso
          </Button>
          <Button to={`/guia/${lugar.id}/recorrido`} icono="play" variante="sec" bloque>Ver el recorrido completo</Button>
        </>
      }
    >
      {borrador && (
        <div className="aviso" role="status">
          <Icon nombre="alerta" />
          <span>Es un borrador. Así lo verá la persona usuaria cuando se publique. <Link to={`/revisar/${lugar.id}`}>Volver a la revisión</Link></span>
        </div>
      )}
      <div className="fila-espacio" style={{ marginBottom: 12 }}>
        <Logo tamano={36} />
        <button type="button" className="btn sec" style={{ minHeight: 48 }} aria-pressed={Boolean(comodidad.modoTenue)} onClick={() => dispatch({ tipo: 'SET_COMODIDAD', cambios: { modoTenue: !comodidad.modoTenue } })}>
          <Icon nombre="luna" /> <span>Modo tenue</span>
        </button>
      </div>
      {(lugar.pasos[0]?.imagen || lugar.pasos[0]?.fotoDataUrl) && (
        <img src={lugar.pasos[0].fotoDataUrl || lugar.pasos[0].imagen} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 24, marginBottom: 12 }} />
      )}
      <div className="envuelto" style={{ marginBottom: 8 }}>
        <span className="chip" style={{ cursor: 'default' }}>{lugar.pasos.length} pasos</span>
        {lugar.minutosAndando != null && <span className="chip" style={{ cursor: 'default' }}>{lugar.minutosAndando} min andando</span>}
      </div>
      <p className="sec">
        {lugar.revisada ? `Revisada el ${fechaCorta(lugar.revisada)}` : 'Sin revisar todavía'}
        {lugar.validada && lugar.validadaPor ? ` · Validada por ${lugar.validadaPor}` : ''}
      </p>
      {lugar.etiquetas?.length > 0 && (
        <div className="envuelto" style={{ marginBottom: 12 }}>
          {lugar.etiquetas.map((e) => <span key={e} className="chip" style={{ cursor: 'default' }}>{e}</span>)}
        </div>
      )}
      {(lugar.resumen || lugar.resumenCerca) && <p className="lectura">{lugar.resumen || lugar.resumenCerca}</p>}
      {lugar.horaTranquila && <p className="lectura"><strong>Hora tranquila:</strong> {lugar.horaTranquila}</p>}
      {vozDisponible() && (
        <Button icono="voz" variante="sec" bloque onClick={leer} aria-pressed={leyendo}>
          {leyendo ? 'Parar la voz' : 'Leer en voz alta'}
        </Button>
      )}

      {lugar.alertas?.length > 0 && (
        <div className="aviso" style={{ marginTop: 16 }}>
          <Icon nombre="alerta" />
          <ul style={{ margin: 0, paddingLeft: 18 }}>{lugar.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>¿Qué quieres ver antes?</h2>
      <p className="sec">Elige lo que quieras. Puedes cambiarlo luego.</p>
      <div className="envuelto" role="group" aria-label="Qué quieres ver antes">
        {INTERESES.map(([id, texto]) => (
          <button key={id} type="button" className="chip" aria-pressed={intereses.includes(id)} onClick={() => alternarInteres(id)}>
            {intereses.includes(id) ? '✓ ' : ''}{texto}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Switch etiqueta="Leer cada paso en voz alta" descripcion="También funciona con el lector de pantalla" activo={Boolean(comodidad.leerEnVozAlta)} onChange={(v) => dispatch({ tipo: 'SET_COMODIDAD', cambios: { leerEnVozAlta: v } })} />
      </div>

      <h2 style={{ marginTop: 24 }}>Qué verás</h2>
      {pasosVistos.length === 0 && <p className="sec">Ningún paso encaja con lo que has elegido. Quita alguna opción para ver todos.</p>}
      <ol className="lista-limpia">
        {pasosVistos.map(([p, i]) => (
          <li key={`${p.nombre}-${i}`}>
            <Link className="tarjeta tarjeta-enlace" to={`/guia/${lugar.id}/paso/${i + 1}`}>
              <StepThumb paso={p} tamano={64} />
              <div>
                <h3>{i + 1}. {p.nombre}</h3>
                <NoiseBadge nivel={p.ruido} />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </Pantalla>
  )
}
