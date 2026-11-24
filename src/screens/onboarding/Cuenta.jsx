import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import { useAppStore } from '../../state/AppStore.jsx'

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// La cuenta es opcional. Todavía no se envían códigos: el correo solo se guarda en este móvil.
export default function Cuenta() {
  const { estado, dispatch } = useAppStore()
  const navegar = useNavigate()
  const [correo, setCorreo] = useState(estado.usuaria.cuenta?.email || '')
  const [error, setError] = useState('')

  function guardar(e) {
    e.preventDefault()
    if (!CORREO.test(correo.trim())) {
      setError('Escribe un email con este formato: nombre@ejemplo.es')
      return
    }
    dispatch({ tipo: 'SET_USUARIA', cambios: { cuenta: { email: correo.trim(), creada: false } } })
    navegar('/buscar')
  }

  return (
    <Pantalla
      titulo="¿Guardamos tus visitas?"
      volver="/onboarding/3"
      subtitulo="Es opcional. Todo funciona igual sin cuenta."
      pie={
        <>
          <Button to="/buscar" icono="buscar" variante="sec" grande bloque>Seguir sin cuenta</Button>
          <p className="sec" style={{ fontSize: 15, textAlign: 'center', margin: 0 }}>No pedimos datos de salud.</p>
        </>
      }
    >
      <section className="tarjeta" aria-labelledby="previsto">
        <h2 id="previsto" style={{ fontSize: 18 }}>Con cuenta (previsto)</h2>
        <ul className="lista-limpia">
          <li>Te recordamos repasar la guía el día antes</li>
          <li>Tus sitios guardados en cualquier móvil</li>
          <li>Compartirla con tu familia o apoyo</li>
        </ul>
      </section>
      <form style={{ marginTop: 16 }} onSubmit={guardar} noValidate>
        <div className="campo">
          <label htmlFor="correo">Tu email</label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            placeholder="nombre@correo.com"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value)
              setError('')
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'error-correo' : undefined}
          />
          {error && <span id="error-correo" role="alert">{error}</span>}
        </div>
        <Button type="submit" icono="check" bloque>Guardar el email</Button>
        <p className="sec" style={{ fontSize: 15, textAlign: 'center' }}>
          Sin contraseñas que recordar. Por ahora solo se guarda en este móvil: no enviamos códigos.
        </p>
      </form>
    </Pantalla>
  )
}
