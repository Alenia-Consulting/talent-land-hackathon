import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

/**
 * Botón con icono + texto (en la guía no hay botones solo con icono).
 * variante: primario | sec | grabar. Con `to` es un enlace de la app; con `href`, un enlace externo.
 */
export default function Button({
  icono,
  children,
  variante = 'primario',
  grande = false,
  bloque = false,
  to,
  href,
  disabled = false,
  type = 'button',
  className = '',
  ...resto
}) {
  const clases = ['btn', variante === 'sec' ? 'sec' : '', variante === 'grabar' ? 'grabar' : '', grande ? 'grande' : '', bloque ? 'bloque' : '', className]
    .filter(Boolean)
    .join(' ')
  const contenido = (
    <>
      {icono && <Icon nombre={icono} />}
      <span>{children}</span>
    </>
  )
  if (to && !disabled) return <Link className={clases} to={to} {...resto}>{contenido}</Link>
  if (href && !disabled) return <a className={clases} href={href} {...resto}>{contenido}</a>
  return (
    <button type={type} className={clases} disabled={disabled} {...resto}>
      {contenido}
    </button>
  )
}
