// Iconos de trazo en línea. Siempre decorativos (aria-hidden): el texto del botón dice la acción.
const TRAZOS = {
  puerta: 'M6 21V10a6 6 0 0 1 12 0v11M3 21h18',
  play: 'M8 5v14l11-7z',
  pausa: 'M8 5v14M16 5v14',
  volumen: 'M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  sinSonido: 'M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
  voz: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  camara: 'M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  grabar: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
  parar: 'M7 7h10v10H7z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  izq: 'M15 5l-7 7 7 7',
  der: 'M9 5l7 7-7 7',
  copiar: 'M9 9h11v11H9zM5 15V4h11',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v6h-3',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  mapa: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  casa: 'M4 11l8-7 8 7M6 10v10h12V10',
  sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  luna: 'M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z',
  alerta: 'M12 4l9 16H3zM12 10v4M12 17.5v.01',
  cerrar: 'M6 6l12 12M18 6L6 18',
  subir: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  editar: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  mas: 'M12 5v14M5 12h14',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  repetir: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  ojo: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  enlace: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ia: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  imprimir: 'M7 9V4h10v5M7 17H4v-6h16v6h-3M7 14h10v6H7z',
}

export default function Icon({ nombre, size = 24, ...resto }) {
  const d = TRAZOS[nombre]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      <path d={d} />
    </svg>
  )
}

export const NOMBRES_ICONO = Object.keys(TRAZOS)
