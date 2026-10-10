// The localStorage preference keys the app writes (theme, panel layout, first-run flag, ⌘K recents,
// saved filters, named styles, branch clipboard). Centralised so the Settings "clear all local data"
// action can wipe them in one place — and so they're enumerable + testable rather than hard-coded at
// the call site. The IndexedDB library itself is cleared separately (mapStore.clearAllData).

export const LOCAL_PREF_KEYS = [
  "mindmap-interaction",
  "mindmap-first-run-seen",
  "mindmap-cmdk-recent",
  "mindmap-branch-clipboard",
  "mindmap-panels",
  "mindmap-saved-filters",
  "mindmap-theme",
  "mindmap-custom-themes",
  "mindmap-appearance",
  "mindmap-named-styles",
  "mindmap-install-dismissed",
  "mindmap-edit-hint",
  "mindmap-relate-hint",
  "mindmap-cinematic-walk",
  "mindmap-reduce-motion",
  "mindmap-locale",
  // Added 2026-07-27. These were written by the app but missing from this list, so "clear all local
  // data" silently left them behind and they never travelled in a settings file. The list had drifted
  // because nothing checked it — `test/local-prefs.test.ts` only ever asserted that the keys IT names
  // get cleared, which is true of any list, including a wrong one. There is a completeness guard now.
  "mindmap-contrast",
  "mindmap-info-tab",
  "mindmap-last-export",
  "mindmap-layout",
  "mindmap-minimap-open",
  "mindmap-search-history",
  "mindmap-sticky-color",
] as const;

/** Remove every app preference key from localStorage (best-effort — never throws). */
export function clearAllLocalPreferences(): void {
  for (const k of LOCAL_PREF_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      // best-effort — a single failed key shouldn't abort the wipe
    }
  }
}
