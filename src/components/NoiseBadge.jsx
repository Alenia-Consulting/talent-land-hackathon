// El ruido nunca se indica solo con color: siempre barras + palabra + tono.
const NIVELES = {
  tranquilo: { palabra: 'Tranquilo', barras: 1, tono: 'sonido bajo' },
  medio: { palabra: 'Medio', barras: 2, tono: 'sonido normal' },
  ruidoso: { palabra: 'Ruidoso', barras: 3, tono: 'sonido alto' },
}

export default function NoiseBadge({ nivel, mostrarTono = false }) {
  const n = NIVELES[nivel]
  if (!n) {
    return (
      <span className="ruido ruido-sin" aria-label="Ruido: sin sonido">
        <span aria-hidden="true">Sin sonido</span>
      </span>
    )
  }
  return (
    <span className={`ruido ruido-${nivel}`} aria-label={`Ruido: ${n.palabra.toLowerCase()}, ${n.tono}`}>
      <span className="ruido-barras" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= n.barras ? 'llena' : ''} style={{ height: 6 + i * 4 }} />
        ))}
      </span>
      <span aria-hidden="true">
        {n.palabra}
        {mostrarTono ? ` · ${n.tono}` : ''}
      </span>
    </span>
  )
}
