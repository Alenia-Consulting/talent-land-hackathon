import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Switch from '../../components/Switch.jsx'
import { useAppStore } from '../../state/AppStore.jsx'

const TAMANOS = [
  { visible: 'A', nombre: 'Normal', px: 18 },
  { visible: 'AA', nombre: 'Grande', px: 22 },
  { visible: 'AAA', nombre: 'Muy grande', px: 26 },
]

export default function Comodidad() {
  const { estado, dispatch } = useAppStore()
  const { comodidad, necesidades } = estado.usuaria
  const poner = (cambios) => dispatch({ tipo: 'SET_COMODIDAD', cambios })
  const px = TAMANOS[comodidad.tamanoTexto]?.px ?? 22

  return (
    <Pantalla
      titulo="Ponlo a tu gusto"
      volver="/onboarding/2"
      subtitulo={necesidades.length > 0 ? 'Ya hemos activado lo que te ayuda. Cámbialo si quieres.' : 'Se guarda solo en este móvil.'}
      pie={<Button to="/onboarding/4" icono="der" grande bloque>Siguiente</Button>}
    >
      <section className="tarjeta" aria-labelledby="vista">
        <p id="vista" className="sec" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 8px' }}>
          VISTA PREVIA · RECEPCIÓN
        </p>
        <p style={{ margin: 0, fontSize: px, lineHeight: 1.4 }}>Llegas al mostrador azul. Dices tu nombre.</p>
      </section>

      <section aria-labelledby="tam" style={{ marginTop: 16 }}>
        <h2 id="tam">Tamaño del texto</h2>
        <div className="envuelto" role="group" aria-labelledby="tam">
          {TAMANOS.map((t, i) => (
            <button key={t.nombre} type="button" className="chip" aria-label={t.nombre} aria-pressed={comodidad.tamanoTexto === i} onClick={() => poner({ tamanoTexto: i })}>
              <span aria-hidden="true" style={{ fontSize: 14 + i * 3, fontWeight: 700 }}>{t.visible}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 16 }}>
        <Switch etiqueta="Modo tenue" descripcion="Colores oscuros y suaves" activo={comodidad.modoTenue} onChange={(v) => poner({ modoTenue: v })} />
        <Switch etiqueta="Leer en voz alta" descripcion="Al abrir cada paso" activo={comodidad.leerEnVozAlta} onChange={(v) => poner({ leerEnVozAlta: v })} />
        <Switch etiqueta="Aviso antes de cada sonido" descripcion="Siempre activado. Nada suena sin avisar." activo onChange={() => {}} />
        <p className="sec" style={{ fontSize: 15 }}>Pictogramas, un dibujo junto a cada texto: previsto, todavía no disponible.</p>
      </div>
    </Pantalla>
  )
}
