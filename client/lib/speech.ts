// Read-aloud with the browser's speech synthesis (es-ES). It only speaks when the person asks.

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang === "es-ES") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ??
    null
  );
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

/** Reads the text. Resolves when it ends or is stopped; `true` only if it ended by itself. */
export function speak(text: string): Promise<boolean> {
  if (!speechAvailable()) return Promise.resolve(false);
  stopSpeaking();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 0.9;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    window.speechSynthesis.speak(utterance);
  });
}
