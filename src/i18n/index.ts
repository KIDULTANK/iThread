// The i18n barrel — import `t` (and friends) from here, never from `./registry`.
//
// The side-effect import below is load-bearing, and it exists because of a real failure: registration
// originally happened in `main.tsx`, which meant every entry point that ISN'T main.tsx — the test
// suite, and equally any future embed or story — got a working `t()` over an EMPTY registry, so every
// call threw "no message for key". Making the barrel pull in the catalogue means "can call `t()`" and
// "the English messages exist" are the same fact, and can't drift apart by import order.
//
// A lazy feature's catalogue registers itself the same way, from its own chunk, and imports
// `registerMessages` from `./registry` directly — importing this barrel instead would drag the eager
// core catalogue into that chunk.
import "./core";
import { getLocale, initLocale } from "./registry";

// RESOLVE THE LOCALE HERE, not in main.tsx, and for the same reason the catalogue import is here.
//
// `main.tsx` called `initLocale()` in its body — but its body runs AFTER its imports, and one of those
// is `App`, which statically pulls in the whole eager graph. ES imports are hoisted and evaluated
// depth-first, so by the time that call ran, every module-scope `t()` in the eager graph had already
// been evaluated: 99 of them, frozen against DEFAULT_LOCALE rather than the resolved one.
//
// That was invisible because `LOCALES` has one entry, so `resolveLocale()` could only ever return
// "en". It stops being invisible the moment a second locale is added — and note the trigger is that
// entry, NOT a language picker: `resolveLocale()` reads `navigator.languages`, so a Danish browser
// would get a half-English first paint with no user action at all.
//
// Putting it in the barrel body makes it order-independent: any module that imports `t` from here has
// necessarily finished evaluating this module first, so the locale is resolved before its own
// module-scope calls run. The alternative — an `import "./init"` placed above `import { App }` in
// main.tsx — looks equivalent and is not: `biome check --write` sorts imports alphabetically, so
// "./App" would move above it and silently undo the fix.
initLocale();

/** Load the selected non-English catalogue before the first React render. Keeping it dynamic means
 * English users do not download the Chinese catalogue, while Chinese users still get a fully local,
 * flash-free first paint. */
export async function loadLocaleMessages(): Promise<void> {
  if (getLocale() === "zh-CN") await import("./zh-CN");
}

export type { Catalogue, Locale, Message, MessageVars } from "./registry";
export {
  DEFAULT_LOCALE,
  LOCALE_PREF_KEY,
  LOCALES,
  applyDocumentLocale,
  collator,
  compareText,
  directionOf,
  getLocale,
  initLocale,
  registerMessages,
  resolveLocale,
  setLocale,
  t,
} from "./registry";
