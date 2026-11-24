import { Link } from 'react-router-dom'

/** Portada con acceso a los dos recorridos: persona usuaria y sitio (cliente). */
export default function Inicio() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <p className="sec" style={{ margin: 0 }}>Antesala</p>
      <h1 style={{ fontSize: 40 }}>Que ninguna visita sea la primera.</h1>
      <p className="lectura">Mira un sitio antes de ir. Con su recorrido, sus clips y su ruido real.</p>
      <section aria-label="Elige un perfil" style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        <Link className="btn grande bloque" to="/onboarding/1">Soy una persona que va a visitar un sitio</Link>
        <Link className="btn grande bloque sec" to="/buscar">Buscar un sitio</Link>
        <Link className="btn grande bloque sec" to="/cliente">Tengo un sitio y quiero crear su guía</Link>
      </section>
    </main>
  )
}
