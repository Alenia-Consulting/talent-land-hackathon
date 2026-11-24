import { useState } from 'react'
import { Link } from 'react-router-dom'
import DesktopShell from '../../components/DesktopShell.jsx'
import Button from '../../components/Button.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { ETIQUETA_ESTADO, fechaCorta } from '../../state/formato.js'

const sinTildes = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ClienteGuias() {
  const { estado } = useAppStore()
  const { cuentaCliente, lugares } = estado
  const org = cuentaCliente.organizacion
  const plan = cuentaCliente.plan
  const m = cuentaCliente.metricas30d || {}
  const [filtro, setFiltro] = useState('todas')
  const [q, setQ] = useState('')

  const propios = lugares.filter((l) => l.organizacionId === org.id || cuentaCliente.guiasIds?.includes(l.id))
  const lista = propios
    .filter((l) => filtro === 'todas' || l.estado === filtro)
    .filter((l) => !q || sinTildes(l.nombre).includes(sinTildes(q)))
  const destino = (l) => (l.estado === 'borrador' ? `/revisar/${l.id}` : `/panel/${l.id}`)

  return (
    <DesktopShell>
      <div className="fila-espacio" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Guías de {org.nombre}</h1>
        <Button to="/grabar" icono="mas" grande>Nueva guía</Button>
      </div>

      <div className="kpis">
        <div className="tarjeta"><span className="numero-grande">{propios.filter((l) => l.estado === 'publicada').length}</span><p className="sec" style={{ margin: 0 }}>guías publicadas</p></div>
        <div className="tarjeta"><span className="numero-grande">{m.visitas ?? 0}</span><p className="sec" style={{ margin: 0 }}>visitas en 30 días</p></div>
        <div className="tarjeta"><span className="numero-grande">{m.escucharonSitio ?? 0}%</span><p className="sec" style={{ margin: 0 }}>escucharon el sitio</p></div>
        <div className="tarjeta"><span className="numero-grande">{m.accesosQr ?? 0}</span><p className="sec" style={{ margin: 0 }}>accesos por QR</p></div>
      </div>

      {propios.some((l) => l.estado !== 'publicada') && (
        <section className="tarjeta" aria-labelledby="atencion" style={{ marginBottom: 16 }}>
          <h2 id="atencion" style={{ fontSize: 20 }}>Necesitan tu atención</h2>
          <ul className="lista-limpia">
            {propios.filter((l) => l.estado !== 'publicada').map((l) => (
              <li key={l.id} className="fila-espacio">
                <span><strong>{l.nombre}</strong> · {ETIQUETA_ESTADO[l.estado]}</span>
                <Button to={destino(l)} variante="sec" icono="editar">Revisar</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fila" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="campo" style={{ margin: 0, minWidth: 260 }}>
          <label htmlFor="buscar-guia">Buscar una guía</label>
          <input id="buscar-guia" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="envuelto" role="group" aria-label="Filtrar por estado" style={{ alignSelf: 'flex-end' }}>
          {['todas', 'publicada', 'borrador', 'revisar-cambios'].map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
              {f === 'todas' ? 'Todas' : ETIQUETA_ESTADO[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="tarjeta" style={{ padding: 0, overflow: 'auto' }}>
        <table className="tabla">
          <caption className="sr-only">Guías del grupo</caption>
          <thead>
            <tr>
              <th scope="col">Sitio</th>
              <th scope="col">Estado</th>
              <th scope="col">Revisada</th>
              <th scope="col">Visitas 30 días</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.id}>
                <th scope="row"><Link to={destino(l)}>{l.nombre}</Link></th>
                <td>{ETIQUETA_ESTADO[l.estado]}</td>
                <td>{fechaCorta(l.revisada)}</td>
                <td>{l.visitas30d ?? 0}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan="4" className="sec">No hay guías con ese filtro. Quita el filtro o graba una nueva.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {plan && (
        <p className="sec" style={{ marginTop: 16 }}>
          Plan {plan.nombre}: {plan.precioAnual} €/año. Incluye: {plan.incluye?.toLowerCase()}.
        </p>
      )}
    </DesktopShell>
  )
}
