import PhoneFrame from './PhoneFrame.jsx'
import Button from './Button.jsx'

/** Pantalla móvil: «Volver» siempre arriba a la izquierda, acciones siempre abajo. */
export default function Pantalla({ titulo, volver, etiquetaVolver = 'Volver', subtitulo, children, pie }) {
  return (
    <PhoneFrame etiqueta={titulo}>
      <div className="pantalla">
        {volver && (
          <div className="pantalla-volver">
            <Button to={volver} icono="izq" variante="sec">{etiquetaVolver}</Button>
          </div>
        )}
        <main className="pantalla-cuerpo">
          {titulo && <h1>{titulo}</h1>}
          {subtitulo && <p className="lectura sec">{subtitulo}</p>}
          {children}
        </main>
        {pie && <footer className="pantalla-pie">{pie}</footer>}
      </div>
    </PhoneFrame>
  )
}

/** Mensaje cuando no hay lugar o no hay guía: dice qué hacer. */
export function SinGuia({ titulo = 'Aún no hay guía', texto, acciones }) {
  return (
    <Pantalla titulo={titulo} volver="/buscar">
      <p className="lectura">{texto}</p>
      <div className="apilado">{acciones}</div>
    </Pantalla>
  )
}
