import { useState } from 'react'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAppStore } from '../../state/AppStore.jsx'
import { PARTES_POR_DEFECTO } from '../../config.js'
import { fijarPartes, leerPartes } from '../../services/videoPendiente.js'

const CONSEJOS = [
  ['sol', 'Luz normal, sin sol de frente', 'Enciende las luces de siempre. Si una ventana deslumbra, baja la persiana.'],
  ['cuenta', 'Con poca gente', 'Mejor a primera hora. Si hay gente, avisa con un cartel.'],
  ['pin', 'Camina despacio', 'Para 3 segundos en cada zona. Ahí sale la foto y se mide el sonido.'],
  ['imprimir', 'Pon el cartel de aviso', 'Avisa de que estás grabando.'],
]

export default function Preparar() {
  const { estado } = useAppStore()
  const [partes, setPartes] = useState(() => leerPartes(estado.nuevoLugar?.partes || PARTES_POR_DEFECTO))
  const [editando, setEditando] = useState(false)
  const [nueva, setNueva] = useState('')

  function cambiar(lista) {
    setPartes(lista)
    fijarPartes(lista)
  }

  function anadir(e) {
    e.preventDefault()
    const nombre = nueva.trim()
    if (!nombre || partes.length >= 12 || partes.includes(nombre)) return
    cambiar([...partes, nombre])
    setNueva('')
  }

  return (
    <Pantalla
      titulo="Antes de grabar"
      volver="/cliente"
      subtitulo={`Grabarás el camino de alguien que viene por primera vez a ${estado.nuevoLugar?.nombre || 'tu sitio'}. Mientras grabas, te iremos guiando.`}
      pie={
        <>
          <Button to="/grabar/comprobar" icono="camara" grande bloque>Abrir la cámara</Button>
          <Button to="/grabar/subir" icono="subir" variante="sec" bloque>Ya tengo un vídeo grabado</Button>
        </>
      }
    >
      <p className="sec" style={{ fontWeight: 700 }}>Paso 1 de 3</p>
      <ul className="lista-limpia">
        {CONSEJOS.map(([icono, titulo, texto]) => (
          <li key={titulo} className="tarjeta fila">
            <Icon nombre={icono} size={28} />
            <div>
              <h3 style={{ margin: 0 }}>{titulo}</h3>
              <p className="sec" style={{ margin: 0 }}>{texto}</p>
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="partes" style={{ marginTop: 24 }}>
        <div className="fila-espacio">
          <h2 id="partes" style={{ margin: 0 }}>Las partes de tu recorrido</h2>
          <Button icono="editar" variante="sec" onClick={() => setEditando((v) => !v)} aria-pressed={editando}>
            {editando ? 'Listo' : 'Editar'}
          </Button>
        </div>
        <p className="sec">Con estos nombres las verá la gente. Al grabar, marcarás cada una al llegar.</p>
        <ol className="lista-limpia" style={{ marginTop: 12 }}>
          {partes.map((p, i) => (
            <li key={p} className="tarjeta fila-espacio" style={{ padding: 14 }}>
              <span>
                <strong>{i + 1}.</strong> {p}
              </span>
              {editando && partes.length > 1 && (
                <Button icono="cerrar" variante="sec" onClick={() => cambiar(partes.filter((x) => x !== p))}>
                  Quitar
                </Button>
              )}
            </li>
          ))}
        </ol>
        {editando && (
          <form onSubmit={anadir} style={{ marginTop: 12 }}>
            <div className="campo">
              <label htmlFor="nueva-parte">Añadir una parte</label>
              <input id="nueva-parte" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Por ejemplo: Terraza" />
            </div>
            <Button type="submit" icono="mas" variante="sec" bloque>Añadir</Button>
          </form>
        )}
      </section>
    </Pantalla>
  )
}
