import { useEffect, useState } from "react";

export const INTERACTION_PREF_KEY = "mindmap-interaction";
const EVENT = "ithread-interaction-preferences";
export interface InteractionPrefs {
  altHelp: boolean;
  altDelay: number;
  wheelMode: "pan" | "zoom";
  panSpeed: number;
}
export const DEFAULT_INTERACTION_PREFS: InteractionPrefs = {
  altHelp: true,
  altDelay: 550,
  wheelMode: "pan",
  panSpeed: 0.85,
};
export function readInteractionPrefs(): InteractionPrefs {
  try {
    const value = JSON.parse(localStorage.getItem(INTERACTION_PREF_KEY) || "null");
    return {
      altHelp: typeof value?.altHelp === "boolean" ? value.altHelp : true,
      altDelay: [350, 550, 800].includes(value?.altDelay) ? value.altDelay : 550,
      wheelMode: value?.wheelMode === "zoom" ? "zoom" : "pan",
      panSpeed: [0.5, 0.85, 1.2].includes(value?.panSpeed) ? value.panSpeed : 0.85,
    };
  } catch {
    return { ...DEFAULT_INTERACTION_PREFS };
  }
}
export function useInteractionPrefs() {
  const [prefs, setPrefs] = useState(readInteractionPrefs);
  useEffect(() => {
    const refresh = (event: Event) =>
      setPrefs(event instanceof CustomEvent ? event.detail : readInteractionPrefs());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const update = (patch: Partial<InteractionPrefs>) => {
    const next = { ...readInteractionPrefs(), ...patch };
    try {
      localStorage.setItem(INTERACTION_PREF_KEY, JSON.stringify(next));
    } catch {
      /* Keep session usable. */
    }
    setPrefs(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };
  return { prefs, update };
}
