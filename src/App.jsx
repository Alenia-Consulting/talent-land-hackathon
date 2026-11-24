import { Link, Route, Routes } from 'react-router-dom'
import { useAppStore } from './state/AppStore.jsx'
import Inicio from './screens/Inicio.jsx'
import Bienvenida from './screens/onboarding/Bienvenida.jsx'
import Necesidades from './screens/onboarding/Necesidades.jsx'
import Comodidad from './screens/onboarding/Comodidad.jsx'
import Cuenta from './screens/onboarding/Cuenta.jsx'
import BuscarInicio from './screens/usuaria/BuscarInicio.jsx'
import BuscarResultados from './screens/usuaria/BuscarResultados.jsx'
import GuiaInicio from './screens/guia/GuiaInicio.jsx'
import GuiaPaso from './screens/guia/GuiaPaso.jsx'
import GuiaSonido from './screens/guia/GuiaSonido.jsx'
import GuiaRecorrido from './screens/guia/GuiaRecorrido.jsx'
import ClienteInicio from './screens/cliente/ClienteInicio.jsx'
import ClienteGuias from './screens/cliente/ClienteGuias.jsx'
import Preparar from './screens/grabar/Preparar.jsx'
import Comprobar from './screens/grabar/Comprobar.jsx'
import Grabando from './screens/grabar/Grabando.jsx'
import SubirVideo from './screens/grabar/SubirVideo.jsx'
import Procesando from './screens/grabar/Procesando.jsx'
import Borrador from './screens/revisar/Borrador.jsx'
import Panel from './screens/revisar/Panel.jsx'
import Publicar from './screens/revisar/Publicar.jsx'

function Estado({ titulo, children }) {
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px' }}>
      <h1>{titulo}</h1>
      {children}
    </main>
  )
}

function NoEncontrada() {
  return (
    <Estado titulo="No encontramos esta página">
      <p className="lectura">La dirección no existe. Vuelve al inicio para elegir una pantalla.</p>
      <Link className="btn grande" to="/">
        Ir al inicio
      </Link>
    </Estado>
  )
}

export default function App() {
  const { estado, cargar } = useAppStore()

  if (estado.estado === 'cargando') {
    return (
      <Estado titulo="Cargando Antesala">
        <p className="lectura" role="status">
          Un momento.
        </p>
      </Estado>
    )
  }

  if (estado.estado === 'error') {
    return (
      <Estado titulo="No se pudo cargar Antesala">
        <p className="lectura">{estado.error}</p>
        <button type="button" className="btn grande" onClick={() => cargar()}>
          Volver a intentarlo
        </button>
      </Estado>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/onboarding/1" element={<Bienvenida />} />
        <Route path="/onboarding/2" element={<Necesidades />} />
        <Route path="/onboarding/3" element={<Comodidad />} />
        <Route path="/onboarding/4" element={<Cuenta />} />
        <Route path="/buscar" element={<BuscarInicio />} />
        <Route path="/buscar/resultados" element={<BuscarResultados />} />
        <Route path="/guia/:lugarId" element={<GuiaInicio />} />
        <Route path="/guia/:lugarId/paso/:n" element={<GuiaPaso />} />
        <Route path="/guia/:lugarId/paso/:n/sonido" element={<GuiaSonido />} />
        <Route path="/guia/:lugarId/recorrido" element={<GuiaRecorrido />} />
        <Route path="/cliente" element={<ClienteInicio />} />
        <Route path="/cliente/guias" element={<ClienteGuias />} />
        <Route path="/grabar" element={<Preparar />} />
        <Route path="/grabar/comprobar" element={<Comprobar />} />
        <Route path="/grabar/grabando" element={<Grabando />} />
        <Route path="/grabar/subir" element={<SubirVideo />} />
        <Route path="/grabar/procesando" element={<Procesando />} />
        <Route path="/revisar/:lugarId" element={<Borrador />} />
        <Route path="/panel/:lugarId" element={<Panel />} />
        <Route path="/publicar/:lugarId" element={<Publicar />} />
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
      {estado.avisoSync && (
        <p className="aviso error" role="alert" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, margin: 0 }}>
          No se pudo guardar el último cambio: {estado.avisoSync}
        </p>
      )}
    </>
  )
}
