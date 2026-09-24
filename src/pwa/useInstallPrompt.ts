import { useEffect, useState } from "react";
import { isStandalonePwa } from "./standalone";

// In-app "Install iThread" affordance (O2). The browser fires `beforeinstallprompt` ONCE, early
// — usually before React has mounted — so we capture it at module-eval time into a singleton and let
// components subscribe, mirroring the module-level guard pattern in pwaUpdate.ts. iOS Safari never
// fires the event, so we fall back to an "Add to Home Screen via Share" hint there.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mindmap-install-dismissed";
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep the deferred prompt; suppress Chrome's mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

// iOS Safari: no beforeinstallprompt. Detect iOS/iPadOS WebKit that isn't already standalone.
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const nav = navigator as { platform?: string; maxTouchPoints?: number };
  const iOS =
    /iphone|ipad|ipod/i.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1); // iPadOS masquerades as Mac
  const webkit = /webkit/i.test(ua) && !/crios|fxios|edgios/i.test(ua); // exclude Chrome/FF/Edge on iOS
  return iOS && webkit;
}

export type InstallState =
  | { kind: "available"; promptInstall: () => Promise<void>; dismiss: () => void }
  | { kind: "ios-hint"; dismiss: () => void }
  | { kind: "none" };

/** Subscribe to install eligibility. Returns "none" once installed, dismissed, or unsupported. */
export function useInstallPrompt(): InstallState {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // best-effort
    }
  };

  if (dismissed || isStandalonePwa()) return { kind: "none" };
  if (deferred) {
    return {
      kind: "available",
      dismiss,
      promptInstall: async () => {
        const e = deferred;
        if (!e) return;
        deferred = null;
        notify();
        await e.prompt();
        await e.userChoice.catch(() => {});
      },
    };
  }
  if (isIosSafari()) return { kind: "ios-hint", dismiss };
  return { kind: "none" };
}

// Test hooks (mirror __resetPwaUpdateForTest in pwaUpdate.ts).
export const __setInstallDeferredForTest = (e: unknown): void => {
  deferred = e as BeforeInstallPromptEvent;
  notify();
};
export const __resetInstallPromptForTest = (): void => {
  deferred = null;
  notify();
};
