// Every user-facing string of the recording app lives here, so translating means copying this file.

import type { CameraErrorKind } from "../pure/cameraError.ts";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const es = {
  home: { record: "Grabar un recorrido" },
  intro: {
    title: "Graba el recorrido",
    lead: "Vas a grabar un vídeo corto (máximo 2 minutos) del camino que seguirá una persona: entrada, recepción, espera, consulta y salida.",
    tips: [
      "Camina despacio.",
      "Enciende todas las luces.",
      "Graba cuando haya poca gente.",
      "Empieza en la puerta de entrada.",
    ],
    next: "Continuar",
  },
  permisos: {
    title: "Necesitamos la cámara",
    lead: "Usaremos la cámara trasera y el micrófono. El vídeo no se envía hasta que lo confirmes.",
    action: "Activar cámara",
    starting: "Abriendo la cámara…",
    resumed: "La cámara se cerró al salir de la app. Actívala de nuevo para continuar.",
  },
  listo: {
    hint: "Colócate en la puerta de entrada y pulsa «Empezar».",
    start: "Empezar",
  },
  grabando: { stop: "Parar", remaining: "Tiempo restante" },
  alerts: {
    luz: "Poca luz. Enciende las luces.",
    movimiento: "Más despacio",
  },
  revision: {
    title: "Revisa el vídeo",
    retry: "Repetir",
    send: "Enviar",
    noAlerts: "Sin avisos de calidad.",
    interrupted: "La grabación se detuvo porque la app pasó a segundo plano.",
    limit: "Se alcanzó el límite de 2 minutos.",
    alertsTitle: "Avisos durante la grabación",
    darkSegments: (n: number) => plural(n, "tramo oscuro", "tramos oscuros"),
    fastSegments: (n: number) => plural(n, "tramo rápido", "tramos rápidos"),
  },
  enviando: { title: "Enviando el vídeo…", keepOpen: "No cierres esta pantalla." },
  hecho: { title: "¡Listo!", lead: "El vídeo se envió correctamente.", again: "Grabar otro" },
  error: {
    title: "Algo ha fallado",
    retryCamera: "Reintentar",
    retrySend: "Reintentar envío",
    download: "Descargar vídeo y datos",
    uploadFailed: "No se pudo enviar el vídeo. Comprueba la conexión e inténtalo de nuevo.",
    recorderFailed: "No se pudo iniciar la grabación en este navegador.",
    camera: {
      insecure: "La cámara solo funciona en una conexión segura (HTTPS). Abre la página con https://.",
      unsupported: "Este navegador no permite acceder a la cámara. Prueba con Safari o Chrome.",
      denied: "Permiso de cámara denegado. Actívalo en Ajustes del navegador y vuelve a intentarlo.",
      busy: "La cámara está en uso por otra aplicación. Ciérrala y vuelve a intentarlo.",
      notfound: "No se encontró una cámara en este dispositivo.",
      unknown: "No se pudo abrir la cámara.",
    } satisfies Record<CameraErrorKind, string>,
  },
  debug: { title: "Depuración" },
} as const;
