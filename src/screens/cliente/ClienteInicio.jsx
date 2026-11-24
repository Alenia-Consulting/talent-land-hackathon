import { Link } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { ETIQUETA_ESTADO, fechaCorta } from '../../state/formato.js'

export default function ClienteInicio() {
  const { estado } = useAppStore()
  const { cuentaCliente, lugares } = estado
  const org = cuentaCliente.organizacion
  const m = cuentaCliente.metricas30d || {}
  const propios = lugares.filter((l) => l.organizacionId === org.id || cuentaCliente.guiasIds?.includes(l.id))
  const pendientes = propios.filter((l) => l.estado !== 'publicada')
  const publicadas = propios.filter((l) => l.estado === 'publicada')
  const destino = (l) => (l.estado === 'publicada' ? `/panel/${l.id}` : `/revisar/${l.id}`)

  return (
    <Pantalla
      titulo={`Hola, ${cuentaCliente.persona}`}
      subtitulo={org.nombre}
      pie={
        <div className="rejilla-2">
          <Button to="/cliente" icono="casa" variante="sec">Inicio</Button>
          <Button to="/cliente/guias" icono="lista" variante="sec">Guías</Button>
        </div>
      }
    >
      <Link className="btn grabar grande bloque" to="/grabar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
        <span className="fila"><Icon nombre="camara" /> <span>Grabar un recorrido</span></span>
        <span style={{ fontWeight: 400, fontSize: 16 }}>2 minutos con el móvil. Te guiamos.</span>
      </Link>
      {pendientes.length > 0 && (
        <section aria-labelledby="pend">
          <h2 id="pend">Para hoy</h2>
          <ul className="lista-limpia">
            {pendientes.map((l) => (
              <li key={l.id}>
                <Link className="tarjeta tarjeta-enlace" to={destino(l)}>
                  <Icon nombre="alerta" />
                  <div>
                    <h3>{l.nombre}</h3>
                    <p className="sec">{ETIQUETA_ESTADO[l.estado]} · {l.estado === 'borrador' ? 'Borrador listo para revisar' : '¿Ha cambiado algo?'}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="met" style={{ marginTop: 24 }}>
        <h2 id="met">Este mes</h2>
        <div className="rejilla-2">
          <div className="tarjeta"><span className="numero-grande">{m.visitas ?? 0}</span><p className="sec" style={{ margin: 0 }}>visitas a tus guías</p></div>
          <div className="tarjeta"><span className="numero-grande">{m.accesosQr ?? 0}</span><p className="sec" style={{ margin: 0 }}>accesos por QR</p></div>
        </div>
      </section>

      <section aria-labelledby="gu" style={{ marginTop: 24 }}>
        <div className="fila-espacio">
          <h2 id="gu" style={{ margin: 0 }}>Tus guías</h2>
          <Link to="/cliente/guias">Ver todas</Link>
        </div>
        <ul className="lista-limpia" style={{ marginTop: 12 }}>
          {publicadas.map((l) => (
            <li key={l.id}>
              <Link className="tarjeta tarjeta-enlace" to={destino(l)}>
                <Icon nombre="puerta" />
                <div>
                  <h3>{l.nombre}</h3>
                  <p className="sec">{ETIQUETA_ESTADO[l.estado]} · revisada el {fechaCorta(l.revisada)} · {l.visitas30d ?? 0} visitas</p>
                </div>
              </Link>
            </li>
          ))}
          {publicadas.length === 0 && <li className="sec">Todavía no tienes guías publicadas. Graba tu primer recorrido.</li>}
        </ul>
      </section>
    </Pantalla>
  )
}
