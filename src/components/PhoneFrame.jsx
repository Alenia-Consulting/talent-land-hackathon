// Móvil: 390×844 centrado en escritorio; a pantalla completa en un móvil de verdad.
export default function PhoneFrame({ children, etiqueta }) {
  return (
    <div className="phone-wrap">
      <div className="phone" role="region" aria-label={etiqueta || 'Pantalla de Antesala'}>
        {children}
      </div>
    </div>
  )
}
