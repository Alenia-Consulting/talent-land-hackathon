import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { segunPersona } from '../../state/formato.js'

export const NECESIDADES = [
  { id: 'ver', texto: 'Veo poco o nada', otra: 'Ve poco o nada', desc: 'Voz alta, letra grande, lector de pantalla', activa: { tamanoTexto: 2 } },
  { id: 'oir', texto: 'Oigo poco o nada', otra: 'Oye poco o nada', desc: 'El sonido en imagen y palabras, vibración', activa: {} },
  { id: 'entender', texto: 'Me cuesta leer o entender', otra: 'Le cuesta leer o entender', desc: 'Lectura fácil, pictogramas y voz', activa: { leerEnVozAlta: true } },
  { id: 'sentidos', texto: 'El ruido o la luz me agobian', otra: 'El ruido o la luz le agobian', desc: 'Modo tenue, zonas tranquilas primero', activa: { modoTenue: true } },
  { id: 'orientar', texto: 'Me pierdo o se me olvida el camino', otra: 'Se pierde o se le olvida el camino', desc: 'Pasos cortos, recordatorio, salida y ayuda', activa: {} },
]

export default function Necesidades() {
  const { estado, dispatch } = useAppStore()
  const { paraQuien, necesidades } = estado.usuaria

  function alternar(n) {
    const activa = necesidades.includes(n.id)
    dispatch({ tipo: 'SET_USUARIA', cambios: { necesidades: activa ? necesidades.filter((x) => x !== n.id) : [...necesidades, n.id] } })
    // Cada necesidad preactiva los ajustes de la pantalla siguiente.
    if (!activa && Object.keys(n.activa).length > 0) dispatch({ tipo: 'SET_COMODIDAD', cambios: n.activa })
  }

  return (
    <Pantalla
      titulo="¿Para quién preparas la visita?"
      volver="/onboarding/1"
      pie={
        <>
          <Button to="/onboarding/3" icono="der" grande bloque>Siguiente</Button>
          <Button to="/buscar" variante="sec" icono="buscar" bloque>Saltar</Button>
        </>
      }
    >
      <div className="envuelto" role="group" aria-label="¿Para quién es?">
        <button type="button" className="chip" aria-pressed={paraQuien === 'mi'} onClick={() => dispatch({ tipo: 'SET_USUARIA', cambios: { paraQuien: 'mi' } })}>
          Para mí
        </button>
        <button type="button" className="chip" aria-pressed={paraQuien === 'otra'} onClick={() => dispatch({ tipo: 'SET_USUARIA', cambios: { paraQuien: 'otra' } })}>
          Acompaño a alguien
        </button>
      </div>
      <h2 style={{ marginTop: 24 }}>{segunPersona(paraQuien, '¿Qué te cuesta en un sitio nuevo?', '¿Qué le cuesta en un sitio nuevo?')}</h2>
      <p className="sec">Elige las que quieras. Activamos lo que ayuda.</p>
      <ul className="lista-limpia" style={{ marginTop: 12 }}>
        {NECESIDADES.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="chip"
              style={{ width: '100%', minHeight: 72, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4, padding: '12px 16px', borderRadius: 18, fontSize: 18, lineHeight: 1.25, textAlign: 'left' }}
              aria-pressed={necesidades.includes(n.id)}
              onClick={() => alternar(n)}
            >
              <span style={{ fontWeight: 700 }}>{segunPersona(paraQuien, n.texto, n.otra)}</span>
              <span className="sec" style={{ fontSize: 15, fontWeight: 400 }}>{n.desc}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="sec" style={{ fontSize: 15, marginTop: 16 }}>Sin diagnósticos. Se guarda solo en tu móvil.</p>
    </Pantalla>
  )
}
