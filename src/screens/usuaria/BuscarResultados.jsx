import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { copiarTexto, distancia, haceTiempo } from '../../state/formato.js'

const FILTROS = [
  ['espera', 'Espera tranquila', (l) => l.etiquetas?.includes('Espera tranquila')],
  ['hora', 'Hora tranquila', (l) => Boolean(l.horaTranquila)],
  ['sonido', 'Con sonido del sitio', (l) => l.etiquetas?.includes('Con sonido del sitio')],
  ['validada', 'Validada', (l) => Boolean(l.validada)],
]

const sinTildes = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function BuscarResultados() {
  const { estado } = useAppStore()
  const [params] = useSearchParams()
  const cat = params.get('cat') || ''
  const q = (params.get('q') || '').trim()
  const [activos, setActivos] = useState([])
  const [aviso, setAviso] = useState('')
  const [vista, setVista] = useState(params.get('vista') === 'mapa' ? 'mapa' : 'lista')
  const { lugares, categorias, nuevoLugar, usuaria } = estado
  const hoy = new Date()

  const etiquetaCat = categorias.find((c) => c.id === cat)?.label
  const coincide = (l) =>
    (!cat || l.categoria === cat) &&
    (!q || sinTildes(`${l.nombre} ${l.direccion} ${l.categoria}`).includes(sinTildes(q)))

  const publicados = lugares
    .filter((l) => l.estado === 'publicada' && coincide(l))
    .filter((l) => activos.every((id) => FILTROS.find(([f]) => f === id)[2](l)))
    .sort((a, b) => (a.distanciaM ?? 1e9) - (b.distanciaM ?? 1e9))

  // El sitio sin guía aparece como «Aún no tiene guía» hasta que se publica.
  const nuevoPublicado = Boolean(nuevoLugar) && lugares.some((l) => l.id === nuevoLugar.id && l.estado === 'publicada')
  const mostrarSinGuia = Boolean(nuevoLugar) && !nuevoPublicado && coincide(nuevoLugar) && activos.length === 0

  function alternar(id) {
    setActivos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  }

  async function copiarPeticion() {
    const ok = await copiarTexto(
      `Hola, voy a ir a ${nuevoLugar.nombre}. ¿Podéis tener una guía de Antesala para ver el sitio antes de ir?`,
    )
    setAviso(ok ? 'Mensaje copiado. Pégalo en un correo o en un mensaje al sitio.' : 'No se pudo copiar el mensaje.')
  }

  return (
    <Pantalla titulo={etiquetaCat || (q ? `«${q}»` : 'Resultados')} volver="/buscar">
      <div className="fila-espacio" style={{ marginBottom: 12 }}>
        <p className="sec" style={{ margin: 0 }}>
          {publicados.length + (mostrarSinGuia ? 1 : 0)} sitios cerca de {usuaria?.ciudad || 'ti'}
        </p>
        <div className="envuelto" role="group" aria-label="Vista">
          <button type="button" className="chip" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>Lista</button>
          <button type="button" className="chip" aria-pressed={vista === 'mapa'} onClick={() => setVista('mapa')}>Mapa</button>
        </div>
      </div>
      {vista === 'mapa' && (
        <div className="aviso" role="status" style={{ marginBottom: 12 }}>
          <Icon nombre="mapa" />
          <span>El mapa está previsto. Por ahora puedes ver los sitios en la lista.</span>
        </div>
      )}
      <div className="envuelto" role="group" aria-label="Filtros">
        {FILTROS.map(([id, texto]) => (
          <button key={id} type="button" className="chip" aria-pressed={activos.includes(id)} onClick={() => alternar(id)}>
            {texto}
          </button>
        ))}
      </div>

      <ul className="lista-limpia" style={{ marginTop: 16 }}>
        {publicados.map((l) => (
          <li key={l.id}>
            <Link className="tarjeta tarjeta-enlace" to={`/guia/${l.id}`}>
              <Icon nombre="pin" />
              <div>
                <h3>{l.nombre}</h3>
                <p className="sec">{distancia(l.distanciaM)} · {l.pasos.length} pasos · revisada {haceTiempo(l.revisada, hoy)}</p>
                <div className="envuelto" style={{ marginTop: 6 }}>
                  {(l.etiquetas || []).slice(0, 3).map((e) => <span key={e} className="chip-luz">{e}</span>)}
                  {l.horaTranquila && <span className="chip-luz">Hora tranquila: {l.horaTranquila}</span>}
                </div>
                {l.validada && l.validadaPor && <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: 15 }}>Validada con {l.validadaPor.replace(/^Asociación/, 'una asociación')}</p>}
              </div>
            </Link>
          </li>
        ))}
        {mostrarSinGuia && (
          <li className="tarjeta">
            <h3>{nuevoLugar.nombre}</h3>
            <p className="sec">{distancia(nuevoLugar.distanciaM)} · {nuevoLugar.minutosAndando} min andando</p>
            <p className="etiqueta-ambar">Aún no tiene guía</p>
            <div style={{ marginTop: 12 }}>
              <Button icono="copiar" variante="sec" bloque onClick={copiarPeticion}>Pídele que tenga Antesala</Button>
            </div>
          </li>
        )}
      </ul>
      <p role="status" className="sec">{aviso}</p>
      {!mostrarSinGuia && (
        <p className="sec" style={{ marginTop: 16 }}>¿Tu sitio no aparece? Pídele que tenga Antesala.</p>
      )}

      {publicados.length === 0 && !mostrarSinGuia && (
        <div className="tarjeta">
          <p className="lectura">No hay sitios con esos filtros. Quita algún filtro o prueba otra categoría.</p>
          <Button to="/buscar" icono="buscar" variante="sec" bloque>Buscar otra cosa</Button>
        </div>
      )}
    </Pantalla>
  )
}
