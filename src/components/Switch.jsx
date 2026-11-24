import { useId } from 'react'

/** Interruptor con etiqueta visible. aria-pressed refleja el estado. */
export default function Switch({ activo, onChange, etiqueta, descripcion }) {
  const id = useId()
  return (
    <div className="switch-fila">
      <div>
        <div id={id} className="switch-etiqueta">
          {etiqueta}
        </div>
        {descripcion && <div className="sec switch-desc">{descripcion}</div>}
      </div>
      <button
        type="button"
        className="switch"
        aria-pressed={activo}
        aria-labelledby={id}
        onClick={() => onChange(!activo)}
      >
        <span className="sr-only">{activo ? 'Activado' : 'Desactivado'}</span>
      </button>
    </div>
  )
}
