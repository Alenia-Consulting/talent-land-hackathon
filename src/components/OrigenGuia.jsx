import Icon from './Icon.jsx'

/** Origen de la guía, discreto: IA (Gemini) o medidas del vídeo (local). */
export default function OrigenGuia({ lugar }) {
  if (!lugar.origen) return null
  const texto =
    lugar.origen === 'gemini'
      ? `Borrador hecho con IA${lugar.modelo ? ` (${lugar.modelo})` : ''} y las medidas del vídeo.`
      : 'Borrador hecho solo con las medidas del vídeo, sin IA.'
  return (
    <p className="sec fila" style={{ fontSize: 15, margin: '8px 0' }}>
      <Icon nombre="ia" size={18} />
      <span data-origen={lugar.origen}>{texto}</span>
    </p>
  )
}
