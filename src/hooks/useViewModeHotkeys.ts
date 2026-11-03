import { useEffect } from "react";

export function useViewModeHotkeys(
  enabled: boolean,
  toggleFocus: () => void,
  toggleAutoZoom: () => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target instanceof HTMLElement ? event.target : document.activeElement;
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        el?.closest(
          'input, textarea, select, [contenteditable="true"], dialog[open], [role="dialog"], [data-mm-menu]',
        )
      )
        return;
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      const key = event.code || event.key.toLowerCase();
      if (key === "KeyF" || key === "f") {
        event.preventDefault();
        toggleFocus();
      }
      if (key === "KeyZ" || key === "z") {
        event.preventDefault();
        toggleAutoZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, toggleFocus, toggleAutoZoom]);
}
