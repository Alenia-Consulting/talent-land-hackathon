import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import Pantalla from '../../components/Pantalla.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import Logo from '../../components/Logo.jsx'
import { useLugar } from '../../state/AppStore.jsx'
import { copiarTexto, fechaCorta } from '../../state/formato.js'

export default function Publicar() {
  const { lugarId } = useParams()
  const lugar = useLugar(lugarId)
  const enlace = `${window.location.origin}/guia/${lugarId}`
  const [qr, setQr] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    // El QR se genera aquí, sin servicios externos.
    QRCode.toDataURL(enlace, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''))
  }, [enlace])

  if (!lugar || lugar.estado !== 'publicada') {
    return (
      <Pantalla titulo="La guía aún no está publicada" volver="/cliente">
        <p className="lectura">Completa los datos que faltan y aprueba la guía. Después aparece el enlace y el QR.</p>
        <div className="apilado">
          <Button to={`/panel/${lugarId}`} icono="editar" grande bloque>Completar y publicar</Button>
        </div>
      </Pantalla>
    )
  }

  async function copiar(texto, mensaje) {
    setAviso((await copiarTexto(texto)) ? mensaje : 'No se pudo copiar. Selecciona el enlace y cópialo a mano.')
  }

  return (
    <Pantalla
      titulo="Tu guía ya está en marcha"
      volver="/cliente"
      pie={
        <>
          <Button to={`/guia/${lugar.id}`} icono="ojo" grande bloque>Ver la guía</Button>
          <Button to="/cliente" icono="casa" variante="sec" bloque>Volver al inicio</Button>
        </>
      }
    >
      <p className="lectura">Compártela antes de cada cita. Quien la abra no necesita instalar nada.</p>
      <p className="sec"><strong>{lugar.nombre}</strong> · revisada el {fechaCorta(lugar.revisada)}. La fecha se ve en la guía.</p>

      <div className="tarjeta" style={{ textAlign: 'center' }}>
        {qr ? (
          <img src={qr} width="240" height="240" alt={`Código QR que abre la guía de ${lugar.nombre}`} />
        ) : (
          <p className="sec">No se pudo crear el QR. Comparte el enlace.</p>
        )}
        <p style={{ wordBreak: 'break-all', margin: '8px 0 0' }}>
          <a href={enlace}>{enlace}</a>
        </p>
      </div>

      <div className="apilado">
        <Button icono="copiar" variante="sec" bloque onClick={() => copiar(enlace, 'Enlace copiado.')}>Copiar</Button>
        <Button
          icono="enlace"
          variante="sec"
          bloque
          onClick={() => copiar(`Antes de venir a ${lugar.nombre}, mira cómo es el sitio: ${enlace}`, 'Texto para el SMS copiado.')}
        >
          Añadir al SMS de cita
        </Button>
        <Button icono="imprimir" variante="sec" bloque onClick={() => window.print()}>Cartel para recepción</Button>
      </div>
      <p role="status" className="sec" style={{ minHeight: 28 }}>{aviso}</p>

      <div className="cartel" aria-hidden="true">
        <Logo tamano={96} />
        <h1 style={{ fontSize: 64, margin: '32px 0' }}>Este centro tiene Antesala</h1>
        <p style={{ fontSize: 32 }}>Mira cómo es {lugar.nombre} antes de venir.</p>
        {qr && <img src={qr} width="420" height="420" alt="" />}
        <p style={{ fontSize: 22 }}>{enlace}</p>
      </div>
      <div className="tarjeta" style={{ textAlign: 'center' }}>
        <Logo tamano={40} />
        <p style={{ margin: '8px 0 0', fontWeight: 700 }}>Este centro tiene Antesala</p>
      </div>
      <p className="sec fila" style={{ fontSize: 15 }}>
        <Icon nombre="check" size={18} /> Cada vez que cambie algo en el sitio, actualiza la guía.
      </p>
    </Pantalla>
  )
}
