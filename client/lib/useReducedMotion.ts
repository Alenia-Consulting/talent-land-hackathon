"use client";

// Whether this person asked their device for less movement.
//
// The stylesheet already kills transitions, but a clip that starts playing by itself is movement
// that no CSS rule can stop. When this is true the guide shows the still frame and waits to be
// asked, which is the same promise the rest of the product makes.

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  // Starts false so the server and the first client render agree; the effect corrects it before
  // anything can move, because autoplay only happens once the video element is mounted.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = globalThis.matchMedia?.(QUERY);
    if (!media) return;
    setReduced(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
