import { NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAppStore } from '../state/AppStore.jsx'

// Escritorio a ancho completo: Panel y Cliente · Guías.
export default function DesktopShell({ children }) {
  const { estado } = useAppStore()
  const { persona, organizacion } = estado.cuentaCliente
  return (
    <div className="escritorio">
      <header className="escritorio-cabecera">
        <NavLink to="/" aria-label="Antesala, ir al inicio">
          <Logo />
        </NavLink>
        <nav aria-label="Principal" className="escritorio-nav">
          <NavLink to="/cliente">Inicio</NavLink>
          <NavLink to="/cliente/guias">Guías</NavLink>
        </nav>
        <span className="sec escritorio-persona">
          {persona} · {organizacion.nombre}
        </span>
      </header>
      <main className="escritorio-main">{children}</main>
    </div>
  )
}
