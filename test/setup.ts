// Test setup for component + hook tests (the @testing-library/react net for the panels/hooks).
// jsdom doesn't implement the layout/observer APIs the panels and hooks reach for, so polyfill the
// handful they need here. Wired via vitest.config.ts `setupFiles`; runs before every test file.
//
// This file runs for EVERY test (setupFiles is global), including the pure-logic + store tests that
// use the `node` environment. Those have no `window`/`document`, so everything here is guarded to be
// a no-op under node — it only takes effect for the jsdom-environment component/hook tests.
import { afterEach } from "vitest";

// Register the EAGER catalogue for every test.
//
// In the app this is guaranteed: main.tsx imports the i18n barrel, which registers core, long before
// any lazy chunk loads. A unit test that imports a lazy LEAF directly — `test/bulk-node-menu.test.tsx`
// renders BulkNodeMenu on its own — has no such path. The leaf imports `./messages` and so gets the
// CANVAS catalogue, but any message it reads from the eager one (`common.markers`, `common.tags`)
// resolves to nothing and `t()` throws.
//
// Fixed here rather than per-test, so the next lazy leaf test does not rediscover it. NOT fixed by
// having flow/messages.ts pull in core — that would drag the whole eager chrome catalogue into the
// lazy canvas chunk and undo the bundle arrangement the whole layer is built around.
import { LOCALE_PREF_KEY, setLocale } from "../src/i18n";

// Locale is module-global by design. Test files share workers, so a Chinese/pseudo-locale test must
// not make an unrelated later file format dates, warnings, or exports in that locale.
setLocale("en");
try {
  localStorage.removeItem(LOCALE_PREF_KEY);
} catch {
  // Node-environment tests have no localStorage.
}
afterEach(() => {
  setLocale("en");
  try {
    localStorage.removeItem(LOCALE_PREF_KEY);
  } catch {
    // Node-environment tests have no localStorage.
  }
});

const hasDom = typeof window !== "undefined" && typeof document !== "undefined";

if (hasDom) {
  // Unmount any rendered trees + clear jsdom between tests, so one panel render can't leak DOM into
  // the next assertion. (Vitest doesn't auto-cleanup; @testing-library leaves it to the setup file.)
  // Imported lazily so the `node`-environment tests never load testing-library (which needs a DOM).
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });

  // ResizeObserver: React Flow + a few panels construct one on mount. jsdom has none — a minimal
  // no-op class is enough for the components under test (they don't depend on a fired callback here).
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  // IntersectionObserver: same story — present so a mount that constructs one doesn't throw.
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return [];
    }
  }

  // <dialog>: the current jsdom (29.x) implements showModal()/close() natively, so this shim is a
  // dormant fallback for an older/leaner DOM — the guard below self-disables it. Don't read it as "the
  // app's <Dialog> runs on a stub": it doesn't. What matters for tests either way is that showModal()
  // sets [open], because a <dialog> without [open] is display:none per the UA stylesheet and *byRole
  // then can't see anything inside it (see test/editor-dialogs.test.tsx's header).
  const dlg = globalThis.HTMLDialogElement?.prototype as
    | (HTMLDialogElement & { showModal: () => void; close: () => void })
    | undefined;
  if (dlg && typeof dlg.showModal !== "function") {
    dlg.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    dlg.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }

  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver =
      IntersectionObserverStub as unknown as typeof IntersectionObserver;
  }

  // matchMedia: jsdom doesn't implement it; useIsMobile + useTheme read it. Return a non-matching,
  // fully-shaped MediaQueryList (with both the modern add/removeEventListener and the legacy
  // add/removeListener) so the hooks can subscribe + unsubscribe without a guard.
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
}
