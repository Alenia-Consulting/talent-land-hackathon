import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { fechaCorta, distancia } from '../../state/formato.js'

export default function BuscarInicio() {
  const { estado } = useAppStore()
  const navegar = useNavigate()
  const [q, setQ] = useState('')
  const { usuaria, lugares, categorias, nuevoLugar } = estado

  const visita = usuaria.proximaVisita
  const lugarVisita = visita && lugares.find((l) => l.id === visita.lugarId && l.estado === 'publicada')
  const cerca = lugares
    .filter((l) => l.estado === 'publicada')
    .sort((a, b) => (a.distanciaM ?? 1e9) - (b.distanciaM ?? 1e9))
    .slice(0, 4)

  function buscar(e) {
    e.preventDefault()
    navegar(`/buscar/resultados?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <Pantalla titulo="¿A dónde vas a ir?" subtitulo={`Hola, ${usuaria.nombre}.`}>
      <form onSubmit={buscar} role="search">
        <div className="campo">
          <label htmlFor="q">Buscar un sitio</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Restaurante, dentista…" />
        </div>
        <Button type="submit" icono="buscar" bloque>Buscar</Button>
      </form>

      {visita && (
        <section aria-labelledby="proxima" style={{ marginTop: 24 }}>
          <h2 id="proxima">Tu próxima visita</h2>
          <div className="tarjeta">
            <p className="fila"><Icon nombre="reloj" /> <strong>{visita.texto}</strong></p>
            <p className="sec">{fechaCorta(visita.fecha)} a las {visita.hora}</p>
            {lugarVisita ? (
              <Button to={`/guia/${lugarVisita.id}`} icono="ojo" bloque>Repasar</Button>
            ) : (
              <>
                <p className="etiqueta-ambar">Aún no tiene guía</p>
                <p className="sec" style={{ marginTop: 8 }}>
                  {nuevoLugar?.nombre || 'Este sitio'} todavía no tiene guía de Antesala. Cuando la publique, aparecerá aquí.
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="cats" style={{ marginTop: 24 }}>
        <h2 id="cats">Busca por tipo de sitio</h2>
        <div className="rejilla-2">
          {categorias.map((c) => (
            <Link key={c.id} className="chip" style={{ minHeight: 56, justifyContent: 'center', borderRadius: 18, fontWeight: 700, textDecoration: 'none' }} to={`/buscar/resultados?cat=${c.id}`}>
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="cerca" style={{ marginTop: 24 }}>
        <div className="fila-espacio">
          <h2 id="cerca" style={{ margin: 0 }}>Cerca de ti</h2>
          <Link to="/buscar/resultados?vista=mapa">Ver mapa</Link>
        </div>
        <ul className="lista-limpia" style={{ marginTop: 12 }}>
          {cerca.map((l) => (
            <li key={l.id}>
              <Link className="tarjeta tarjeta-enlace" to={`/guia/${l.id}`}>
                <Icon nombre="pin" />
                <div>
                  <h3>{l.nombre}</h3>
                  <p className="sec">{distancia(l.distanciaM)} · {l.minutosAndando} min andando</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p style={{ marginTop: 24 }}>
        <Link to="/onboarding/3">Cambiar mis ajustes</Link>
      </p>
    </Pantalla>
  )
}
