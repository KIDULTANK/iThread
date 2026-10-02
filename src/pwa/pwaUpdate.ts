import { registerSW } from "virtual:pwa-register";
import { registerMessages } from "../i18n/registry";
import { PWA_EN } from "./messages";

registerMessages("en", PWA_EN);

// Self-update for the PWA: when a new build is deployed, the waiting service worker
// triggers a non-intrusive "New version available — Refresh now" toast; clicking it
// swaps to the new build and reloads. Never reloads silently (registerType is
// "prompt", not "autoUpdate") — the user may have an in-flight, debounced edit.
//
// Adapted from the reference recipe: instead of importing a global showToast, the
// app injects its toast surface via initPwaUpdateToast(showToast) at boot, so this
// stays decoupled from the React component that owns the toast UI.

export type ToastKind = "info" | "success";
export interface ToastAction {
  label: string;
  run: () => void;
}
export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}
export type ShowToast = (kind: ToastKind, message: string, opts?: ToastOptions) => void;

let registered = false;
let cachedUpdateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let toast: ShowToast | null = null;
let messages = {
  updateAvailable: "A new version is available.",
  refreshNow: "Refresh now",
  offlineReady: "Ready to use offline.",
};

/** Canonical "New version… Refresh now" prompt. Shared by the plugin's
 *  onNeedRefresh callback and the manual-check already-waiting branch. */
const showUpdateAvailableToast = (): void => {
  const refresh = cachedUpdateSW;
  toast?.("info", messages.updateAvailable, {
    action: refresh
      ? {
          label: messages.refreshNow,
          run: () => {
            void refresh(true);
          },
        }
      : undefined,
    durationMs: 15000,
  });
};

/** Register the SW once and wire its update/offline callbacks to the app's toast. */
export const initPwaUpdateToast = (
  showToast: ShowToast,
  translatedMessages?: Partial<typeof messages>,
): void => {
  if (registered || typeof window === "undefined") return;
  registered = true;
  toast = showToast;
  messages = { ...messages, ...translatedMessages };
  // registerSW() registers the generated SW and returns updateSW(reload?); we hoist
  // it to module scope so the manual "Check for updates" path can drive it too.
  cachedUpdateSW = registerSW({
    onNeedRefresh: () => showUpdateAvailableToast(),
    onOfflineReady: () => toast?.("success", messages.offlineReady),
  });
};

/**
 * Outcomes of a manual update check:
 *  - 'unsupported'     no SW API / no registration yet (jsdom, plain http://, fresh
 *                      first visit before the SW lands)
 *  - 'already-pending' an update was already waiting; we re-surfaced the "Refresh now"
 *                      prompt, so the caller adds nothing
 *  - 'newly-found'     update() fetched a new SW (installing/waiting); the onNeedRefresh
 *                      hook will prompt when install completes
 *  - 'up-to-date'      check completed, no new worker
 */
export type UpdateCheckResult = "unsupported" | "already-pending" | "newly-found" | "up-to-date";

/** Force a SW update check (the browser otherwise checks on each load + ~24h). */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "unsupported";
  // Already waiting — the user likely dismissed the earlier prompt. Re-surface it
  // rather than firing a second, redundant "found an update" message.
  if (reg.waiting) {
    showUpdateAvailableToast();
    return "already-pending";
  }
  try {
    await reg.update();
  } catch {
    return "unsupported";
  }
  if (reg.installing || reg.waiting) return "newly-found";
  return "up-to-date";
};

// Test-only: clear the module guards so the first-call branch can be re-exercised.
export const __resetPwaUpdateForTest = (): void => {
  registered = false;
  cachedUpdateSW = null;
  toast = null;
  messages = {
    updateAvailable: "A new version is available.",
    refreshNow: "Refresh now",
    offlineReady: "Ready to use offline.",
  };
};
