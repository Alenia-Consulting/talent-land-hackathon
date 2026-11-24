import Icon from './Icon.jsx'
import { usaFoto } from '../state/medio.js'

/** Miniatura de un paso: la foto subida, el fotograma real, la ilustración de ejemplo o, si no hay nada, el color. */
export default function StepThumb({ paso, tamano = 72, redondeo = 16 }) {
  const estilo = { width: tamano, height: tamano, borderRadius: redondeo }
  const foto = (usaFoto(paso) && paso.fotoSubida) || paso?.fotoDataUrl || paso?.imagen
  if (foto) {
    return <img className="thumb" src={foto} alt="" style={{ ...estilo, objectFit: 'cover' }} />
  }
  return (
    <span className="thumb thumb-color" style={{ ...estilo, background: paso?.color || 'var(--salvia)' }} aria-hidden="true">
      <Icon nombre="puerta" size={Math.round(tamano / 3)} />
    </span>
  )
}
