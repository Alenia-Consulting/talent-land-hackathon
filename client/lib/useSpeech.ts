"use client";

// Reading a step out loud, with the voice the browser already has.
//
// The Web Speech API costs nothing, needs no key and works offline, which matters: this guide is
// opened in a waiting room, on a phone, on whatever connection the building has.
//
// It never speaks on its own. The caller decides, from a button or from the person's own setting.

import { useCallback, useEffect, useRef, useState } from "react";

/** Slightly under natural pace. Easy read is read slowly, by people and by machines alike. */
const RATE = 0.95;

export type Speech = {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
};

export function useSpeech(): Speech {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Held so the stop on unmount does not depend on React having re-rendered first.
  const active = useRef(false);

  useEffect(() => {
    setSupported(typeof globalThis.speechSynthesis !== "undefined");
    return () => {
      if (active.current) globalThis.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    active.current = false;
    setSpeaking(false);
    globalThis.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = globalThis.speechSynthesis;
      if (!synth || !text.trim()) return;
      // Whatever was being read belongs to the step the person just left.
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = RATE;
      utterance.onend = () => {
        active.current = false;
        setSpeaking(false);
      };
      utterance.onerror = () => {
        active.current = false;
        setSpeaking(false);
      };

      active.current = true;
      setSpeaking(true);
      synth.speak(utterance);
    },
    [],
  );

  return { supported, speaking, speak, stop };
}
