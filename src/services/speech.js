// Lectura en voz alta con speechSynthesis (es-ES). Solo suena cuando la persona lo pide.

export function vozDisponible() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function elegirVoz() {
  const voces = window.speechSynthesis.getVoices()
  return (
    voces.find((v) => v.lang === 'es-ES') ||
    voces.find((v) => v.lang?.toLowerCase().startsWith('es')) ||
    null
  )
}

export function parar() {
  if (vozDisponible()) window.speechSynthesis.cancel()
}

/** Lee el texto. La promesa se resuelve al acabar o al pararla. */
export function hablar(texto) {
  if (!vozDisponible()) return Promise.resolve(false)
  parar()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'es-ES'
    u.rate = 0.9
    const voz = elegirVoz()
    if (voz) u.voice = voz
    u.onend = () => resolve(true)
    u.onerror = () => resolve(false)
    window.speechSynthesis.speak(u)
  })
}
