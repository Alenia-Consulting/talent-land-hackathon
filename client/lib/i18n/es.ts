// Every user-facing string of the recording app lives here, so translating means copying this file.

import type { CameraErrorKind } from "../pure/cameraError.ts";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const es = {
  home: {
    record: "Grabar un recorrido",
    tagline: "Que ninguna visita sea la primera.",
    recordLead: "2 minutos con el móvil. Te guiamos.",
  },
  intro: {
    step: "Paso 1 de 3",
    title: "Antes de grabar",
    lead: "Grabarás el camino de alguien que viene por primera vez. Mientras grabas, te iremos guiando.",
    tips: [
      {
        icon: "luz",
        title: "Luz normal, sin sol de frente",
        body: "Enciende las luces de siempre. Si una ventana deslumbra, baja la persiana.",
      },
      {
        icon: "gente",
        title: "Con poca gente",
        body: "Mejor a primera hora. Las caras y las voces se ocultan solas.",
      },
      {
        icon: "andar",
        title: "Camina despacio",
        body: "Para 3 segundos en cada zona. Ahí sale la foto y se mide el sonido.",
      },
      {
        icon: "cartel",
        title: "Pon el cartel de aviso",
        body: "Avisa de que estás grabando antes de empezar.",
      },
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
  grabando: {
    stop: "Parar",
    remaining: "Tiempo restante",
    max: "máx. 2:00",
    nextPart: (parte: string) => `Siguiente parte: ${parte}`,
    nextHint:
      "Cuando llegues, pulsa «Llegué» y quédate quieto 3 segundos. Así sale una foto clara y se mide el sonido.",
    allDone: "Ya marcaste todas las partes. Para cuando quieras.",
  },
  // While the guide is being put together. Each line is a real stage of the pipeline, so a
  // person waiting knows what is happening to their recording and why it takes a minute.
  proceso: {
    step: "Paso 3 de 3",
    title: "Estamos montando tu guía",
    lead: "No cierres esta pantalla todavía.",
    stages: [
      "Las partes con tus nombres",
      "Clips cortados y estabilizados",
      "Difuminando las caras",
      "Filtrando las voces",
      "Midiendo el ruido de cada zona",
    ],
  },
  alerts: {
    luz: "Poca luz. Enciende las luces.",
    movimiento: "Más despacio",
  },
  revision: {
    title: "Revisa el vídeo",
    cannotSend: "Todavía no se puede enviar",
    retry: "Repetir",
    send: "Enviar",
    noAlerts: "Sin avisos de calidad.",
    interrupted: "La grabación se detuvo porque la app pasó a segundo plano.",
    limit: "Se alcanzó el límite de 2 minutos.",
    tooBig: "El vídeo pesa más de 50 MB y no se puede enviar. Repite la grabación.",
    alertsTitle: "Avisos durante la grabación",
    darkSegments: (n: number) => plural(n, "tramo oscuro", "tramos oscuros"),
    fastSegments: (n: number) => plural(n, "tramo rápido", "tramos rápidos"),
  },
  enviando: { title: "Enviando el vídeo…", keepOpen: "No cierres esta pantalla." },
  hecho: {
    title: "¡Listo!",
    // Only when the video did NOT get through. Saying it was sent would be a lie, and the person
    // would lose the only copy, so the download is offered instead.
    lead: "Se guardó el recorrido con sus partes. El vídeo no se ha enviado: descárgalo para no perderlo.",
    leadSent: "Se guardó el recorrido y se envió el vídeo. Ya puedes revisar la guía.",
    review: "Revisar la guía",
    again: "Grabar otro",
  },
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
  partes: {
    title: "¿Qué partes vas a grabar?",
    lead: "Elige las partes por las que vas a pasar, en orden. Durante la grabación pulsarás «Llegué a» cuando llegues a cada una.",
    guideTitle: "Nombre del recorrido",
    guideTitlePlaceholder: "Recorrido principal",
    venue: "Nombre del centro",
    venuePlaceholder: "Centro de Salud Oeste",
    chosen: "Partes elegidas",
    empty: "Todavía no has elegido ninguna parte.",
    remove: "Quitar",
    add: "Añadir",
    next: "Continuar",
    needTwo: "Elige al menos dos partes.",
    needVenue: "Escribe el nombre del centro.",
  },
  marcar: {
    action: (parte: string) => `Llegué a: ${parte}`,
    done: "Todas las partes marcadas",
    progress: (hechas: number, total: number) => `${hechas} de ${total} partes marcadas`,
    hint: "Quédate quieto 3 segundos al llegar.",
  },
  panel: {
    title: "Tus guías",
    lead: "Todas las guías de tus centros. Revisa las que avisan de cambios.",
    empty: "Todavía no hay ninguna guía. Graba un recorrido para empezar.",
    loading: "Cargando…",
    venue: "Centro",
    status: "Estado",
    open: "Abrir",
    record: "Grabar un recorrido",
    newGuide: "Nueva guía",
    search: "Buscar por guía o centro",
    searchEmpty: "Ninguna guía coincide con lo que buscas.",
    filters: { all: "Todas", published: "Publicadas", pending: "Pendientes" },
    needsAttention: "Necesitan tu atención",
    // Two of the four figures the design shows are real. Visits and "escucharon el sitio" are
    // sample data in the mock and nothing in this product measures them yet, so the cards are
    // here with the layout the design asks for and an empty figure. Filling them in would be
    // the panel telling the venue something nobody counted.
    stats: {
      published: "Guías publicadas",
      visits: "Visitas en 30 días",
      listened: "Escucharon el sitio",
      notMeasured: "aún no se mide",
    },
    lastReview: "Última revisión",
    never: "Sin revisar",
    review: "Revisar",
    edit: "Editar",
    statuses: { draft: "Borrador", needs_review: "Por revisar", published: "Publicada" },
    detail: {
      back: "Volver a las guías",
      reviewed: "Revisado",
      publish: "Aprobar y publicar",
      publishing: "Publicando…",
      published: "Publicada. Este es el enlace para la visita:",
      pending: (p: { steps_reviewed: number; steps_total: number; missing_data: number }) =>
        `${p.steps_reviewed} de ${p.steps_total} pasos revisados · ${plural(p.missing_data, "dato por completar", "datos por completar")}`,
      ready: "Todo revisado. Ya se puede publicar.",
      beforePublish: "Antes de publicar",
      reviewedCount: (hechos: number, total: number) => `${hechos} de ${total} pasos revisados`,
      blanks: (n: number) =>
        `La IA ha dejado ${plural(n, "dato en blanco", "datos en blanco")} porque no salían en el vídeo. Complétalos antes de publicar.`,
      // Said where the publish button is, because it is the promise the button keeps.
      nothingWithoutYou: "Nada se publica sin tu aprobación. La IA hace el borrador; tú decides.",
      blurred: "Caras difuminadas en todos los clips",
      filtered: "Voces filtradas",
      toComplete: (n: number) => plural(n, "dato por completar", "datos por completar"),
      fields: {
        easy_read_text: "Texto en lectura fácil",
        who_to_ask_for_help: "A quién pedir ayuda",
        duration_text: "Cuánto se tarda",
        noise_level: "Nivel de ruido",
      },
      noise: { quiet: "Tranquilo", medium: "Medio", noisy: "Ruidoso", unset: "Sin medir" },
      noiseManual: "corregido a mano",
      noiseMeasured: "medido",
      // Shown under a field the AI left empty. It says why it is empty and whose job it is now,
      // instead of looking like the model failed.
      missingHint: "No se veía en el vídeo: complétalo tú.",
      missing: (campo: string) => `Falta: ${campo}`,
      // What easy read actually asks for, next to the box where it is written.
      easyReadHints: ["Frases cortas", "Una idea por frase", "Segunda persona"],
      // El panel se guarda solo, así que no hay botón de guardar: hay un estado que decir.
      autosave: {
        pending: "Sin guardar",
        saving: "Guardando…",
        saved: "Guardado",
        error: "No se pudo guardar",
      },
      retry: "Reintentar",
      // La única decisión que queda en cada paso. Mientras falte algo, el botón lleva al hueco
      // en vez de quedarse apagado sin explicar por qué.
      markReviewed: "Marcar revisado",
      completeFirst: "Completar lo que falta",
      stepsLeft: (n: number) => plural(n, "paso por revisar", "pasos por revisar"),
      blanksLeft: (n: number) => plural(n, "dato en blanco", "datos en blanco"),
      goToStep: (n: number) => `Ir al paso ${n}`,
      publishedOn: (fecha: string) => `Publicada · revisada el ${fecha}`,
      publishedNoDate: "Publicada",
      seconds: (from: number, to: number) => `Del segundo ${from} al ${to}`,
    },
  },
  publica: {
    loading: "Cargando la guía…",
    notFound: "No encontramos esta guía. Puede que el enlace sea incorrecto.",
    reviewedAt: (fecha: string) => `Revisada el ${fecha}`,
    steps: "El recorrido, paso a paso",
    whatToExpect: "Qué vas a encontrar",
    whoToAsk: "Si necesitas ayuda",
    duration: "Cuánto se tarda",
    noise: { quiet: "Tranquilo", medium: "Medio", noisy: "Ruidoso" },
    noMedia: "Todavía no hay vídeo ni foto de esta parte.",
    missingSlug: "Falta el enlace de la guía.",
    stepCount: (n: number) => plural(n, "paso", "pasos"),
    // What the person picks before starting. The keys are the API's step interests.
    pickTitle: "¿Qué quieres ver antes?",
    pickLead: "Elige lo que quieras. Puedes cambiarlo luego.",
    interests: {
      where_to_wait: "Dónde esperar",
      noisy_areas: "Zonas con ruido",
      restrooms: "Baños",
      who_to_ask: "A quién pedir ayuda",
      exit: "Por dónde salir",
    },
    readAloud: "Leer cada paso en voz alta",
    readAloudHint: "También funciona con el lector de pantalla",
    start: "Empezar paso a paso",
    seeAll: "Ver recorrido completo",
    back: "Volver",
    dimMode: "Modo tenue",
    player: {
      position: (n: number, total: number) => `Paso ${n} de ${total}`,
      close: "Cerrar la guía",
      silent: "Sin sonido",
      replay: "Repetir el vídeo",
      listen: "Escuchar el sitio",
      readThis: "Leer en voz alta",
      // Los puntos del paso: el vídeo se para en la foto y se señalan con una flecha, como en el
      // diseño. Seguir lo decide la persona; nada arranca solo.
      pointsTitle: "Para orientarte",
      resume: "Seguir el vídeo",
      readPoint: (nombre: string) => `Leer: ${nombre}`,
      stopPoint: "Parar la lectura",
      stopReading: "Parar la lectura",
      previous: "Anterior",
      next: "Siguiente",
      finish: "Terminar",
      // La pausa al acabar el clip. El invariante 5 — nada avanza solo — hecho pantalla: el
      // vídeo para, dice qué viene después y espera. Lo que viene se anuncia antes de verlo,
      // que es justo para lo que sirve esta guía.
      paused: "En pausa",
      stepDone: (n: number, parte: string) => `Paso ${n} terminado · ${parte}`,
      pauseTitle: "Cuando quieras, seguimos.",
      pauseLead: (siguiente: string) => `Lo siguiente es ${siguiente}. No pasa nada hasta que pulses.`,
      pauseLast: "Era el último paso. No pasa nada hasta que pulses.",
      upNext: (n: number) => `Siguiente · paso ${n}`,
      goOn: "Seguir",
      repeat: (parte: string) => `Repetir ${parte}`,
      doneTitle: "Ya conoces el sitio.",
      doneLead: "Puedes volver a verlo las veces que quieras, antes de ir.",
      restart: "Verlo otra vez",
    },
    // The warning before any sound. Invariant 1: nothing plays until this has been answered.
    sound: {
      title: { quiet: "Este sonido es bajo", medium: "Este sonido es medio", noisy: "Este sonido es alto" },
      subtitle: (parte: string) => `${parte} · sonido del sitio`,
      lead: "Empieza muy bajito y sube poco a poco. Puedes pararlo cuando quieras.",
      headphones: "Si el ruido te molesta, puedes llevar cascos ese día.",
      confirm: "Escuchar ahora",
      cancel: "Ahora no",
      stop: "Parar el sonido",
      unavailable: "Esta parte todavía no tiene el sonido del sitio.",
    },
  },
  // Lo que ve el centro cuando la guía ya está publicada: cómo se comparte.
  // El cartel que se imprime y se pega en recepción.
  cartel: {
    title: "Este centro tiene Antesala",
    lead: "Mira cómo es por dentro antes de venir.",
    how: "Apunta con la cámara del móvil. Se abre sola, no hay que instalar nada.",
    what: ["Fotos reales de cada zona", "Texto fácil de leer", "El sonido del sitio, si quieres"],
    print: "Imprimir el cartel",
    missing: "Falta el enlace de la guía en la dirección.",
  },
  // La bienvenida, la primera vez que alguien abre una guía. Se ve una vez y no vuelve.
  bienvenida: {
    skip: "Saltar",
    back: "Atrás",
    listen: "Escuchar",
    step: (n: number, total: number) => `Paso ${n} de ${total}`,
    welcome: {
      title: "Mira el sitio antes de ir",
      lead: "Verás y oirás cómo es cada parte del sitio de verdad. Así, cuando llegues, ya lo conoces.",
      start: "Empezar",
      free: "Gratis. Sin instalar nada. Sin cuenta.",
    },
    needs: {
      title: "¿Para quién preparas la visita?",
      who: { self: "Para mí", other: "Acompaño a alguien" },
      // Cambia con "para mí / acompaño a alguien": es lo que hace ese interruptor. Un control
      // que no cambia nada es un control que estorba.
      question: "¿Qué te cuesta en un sitio nuevo?",
      questionOther: "¿Qué le cuesta en un sitio nuevo?",
      lead: "Elige las que quieras. Activamos lo que ayuda.",
      // El subtítulo de cada opción dice solo lo que de verdad va a cambiar. Las dos que no
      // cambian ningún ajuste cuentan lo que la guía ya hace para todo el mundo.
      options: {
        sight: { title: "Veo poco o nada", hint: "Letra grande y voz" },
        hearing: { title: "Oigo poco o nada", hint: "Todo se puede leer. Nada suena sin que lo pidas." },
        reading: { title: "Me cuesta leer o entender", hint: "Lectura fácil, pictogramas y voz" },
        overload: { title: "El ruido o la luz me agobian", hint: "Modo tenue y aviso antes de cada sonido" },
        wayfinding: { title: "Me pierdo o se me olvida el camino", hint: "Un paso por pantalla, y puedes volver atrás" },
      },
      privacy: "Sin diagnósticos. Se guarda solo en tu móvil.",
      willChange: "Vas a empezar con:",
      next: "Siguiente",
      nothingYet: "Nada cambia todavía. Puedes ajustarlo tú en el paso siguiente.",
    },
    ready: {
      title: "Ponlo a tu gusto",
      lead: "Cámbialo cuando quieras, desde el botón Ajustes de la guía.",
      start: "Empezar la visita",
    },
  },
  compartir: {
    open: "Compartir",
    title: "Tu guía ya está en marcha",
    lead: "Compártela antes de cada cita. Quien la abra no necesita instalar nada.",
    qrLabel: (centro: string) => `Código QR de la guía de ${centro}`,
    copy: "Copiar",
    copied: "Enlace copiado",
    sms: "Añadir al SMS de cita",
    smsCopied: "Mensaje copiado",
    // El texto que el centro pega en su SMS de recordatorio de cita.
    smsText: (centro: string, enlace: string) =>
      `Antes de tu cita puedes ver por dentro ${centro}, paso a paso y con fotos reales: ${enlace}`,
    poster: "Cartel para recepción",
    close: "Cerrar",
    // La tarjeta de abajo es la vista previa del cartel, no un adorno.
    signTitle: "Este centro tiene Antesala",
    signReviewed: (fecha: string) => `Revisada el ${fecha} · la fecha se ve en la guía`,
    signNeverReviewed: "Sin revisar todavía",
  },
  ajustes: {
    title: "Ponlo a tu gusto",
    lead: "Cámbialo cuando quieras. Se guarda solo en este móvil.",
    preview: "Vista previa",
    textSize: "Tamaño del texto",
    textSizes: { s: "Texto pequeño", m: "Texto normal", l: "Texto grande" },
    dim: "Modo tenue",
    dimHint: "Colores oscuros y suaves",
    readAloud: "Leer en voz alta",
    readAloudHint: "Al abrir cada paso",
    pictograms: "Pictogramas",
    pictogramsHint: "Un dibujo junto a cada texto",
    // Not a setting: a promise. It has no switch because a switch can be turned off by accident.
    soundWarning: "Aviso antes de cada sonido",
    soundWarningHint: "Siempre activado. Nada suena sin avisar.",
    locked: "No se puede desactivar",
    close: "Cerrar los ajustes",
    open: "Ajustes",
  },
} as const;
