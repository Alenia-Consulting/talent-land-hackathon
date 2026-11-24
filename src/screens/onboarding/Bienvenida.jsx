import { useEffect, useState } from 'react'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Logo from '../../components/Logo.jsx'
import { hablar, parar, vozDisponible } from '../../services/speech.js'

const TEXTO = 'Verás y oirás cómo es cada parte del sitio de verdad. Así, cuando llegues, ya lo conoces.'

export default function Bienvenida() {
  const [leyendo, setLeyendo] = useState(false)
  useEffect(() => () => parar(), [])

  async function leer() {
    if (leyendo) {
      parar()
      setLeyendo(false)
      return
    }
    setLeyendo(true)
    await hablar(TEXTO)
    setLeyendo(false)
  }

  return (
    <Pantalla
      pie={
        <>
          <Button to="/onboarding/2" icono="der" grande bloque>Empezar</Button>
          <Button to="/buscar" variante="sec" icono="buscar" bloque>Saltar</Button>
        </>
      }
    >
      <div style={{ margin: '24px 0' }}><Logo tamano={56} /></div>
      <h1 style={{ fontSize: 36 }}>Mira el sitio antes de ir</h1>
      <p className="lectura">{TEXTO}</p>
      <p className="lectura sec">Gratis. Sin instalar nada. Sin cuenta, si no quieres.</p>
      {vozDisponible() && (
        <Button icono="voz" variante="sec" bloque onClick={leer} aria-pressed={leyendo}>
          {leyendo ? 'Parar la voz' : 'Escuchar'}
        </Button>
      )}
    </Pantalla>
  )
}
