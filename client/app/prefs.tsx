"use client";

// The visitor's own settings, shared by every screen.
//
// The attributes live on <html> rather than in React state alone, because the CSS reads them: a
// class on a div could not repaint the page background behind the scroll.
//
// Hydration: the first render always uses the defaults, the same on the server and in the
// browser, and the stored values arrive in an effect. THEME_SCRIPT below is what keeps that from
// being a white flash in someone's face.

import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";

import { DEFAULT_PREFS, type Prefs, readPrefs, STORAGE_KEY, writePrefs } from "../lib/pure/prefs.ts";

/**
 * Applies the stored settings before the first paint.
 *
 * Without this, someone who chose dim mode because light hurts gets a full-screen flash of pale
 * green every time they open a guide. It is inlined in the document head, so it runs before any
 * stylesheet paints, and it fails silently because a blocked localStorage is not an error here.
 */
export const THEME_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"{}");var r=document.documentElement;if(p&&p.theme==="tenue")r.setAttribute("data-theme","tenue");if(p&&(p.textSize==="s"||p.textSize==="l"))r.setAttribute("data-text",p.textSize);}catch(e){}})();`;

type PrefsContext = {
  prefs: Prefs;
  setPrefs: (change: Partial<Prefs>) => void;
};

const Context = createContext<PrefsContext>({ prefs: DEFAULT_PREFS, setPrefs: () => {} });

function applyToDocument(prefs: Prefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (prefs.theme === "tenue") root.setAttribute("data-theme", "tenue");
  else root.removeAttribute("data-theme");
  if (prefs.textSize === "m") root.removeAttribute("data-text");
  else root.setAttribute("data-text", prefs.textSize);
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);

  // Runs once in the browser: the server has no storage, so the first render cannot read it.
  useEffect(() => {
    const stored = readPrefs(globalThis.localStorage);
    setState(stored);
    applyToDocument(stored);
  }, []);

  const setPrefs = useCallback((change: Partial<Prefs>) => {
    setState((current) => {
      const next = { ...current, ...change };
      applyToDocument(next);
      writePrefs(next, globalThis.localStorage);
      return next;
    });
  }, []);

  return <Context.Provider value={{ prefs, setPrefs }}>{children}</Context.Provider>;
}

export function usePrefs(): PrefsContext {
  return use(Context);
}
