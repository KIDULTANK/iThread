import type { MessageKey } from "./keys";

// The localisation layer. English ships as the only locale; the point of this module is that adding a
// second one is "write a JSON file", not "re-architect the app".
//
// WHY THIS IS A REGISTRY RATHER THAN ONE BIG CATALOGUE. The obvious design — a single eager object of
// every string — would quietly move weight between bundles. `FlowMindMap` is a ~100 kB LAZY chunk and
// holds ~175 of the app's strings (FlowMindMap.tsx + TopicNode.tsx); the exporters under `io/` are lazy
// too. Importing one catalogue from an eager module would drag all of that into the entry chunk, which
// `scripts/size-budget.mjs` caps and which currently has under 2 kB of headroom. So each catalogue
// lives NEXT TO the code that uses it and registers itself on import: a lazy feature's strings stay in
// that feature's chunk. The key *type* union (`./keys`) is compile-time only, so it costs nothing.
//
// Type safety comes from that union: `t()` accepts only keys some catalogue declares, so a typo or a
// deleted string fails `tsc --noEmit` — which the gate runs — rather than surfacing as a blank label.
//
// Plurals go through `Intl.PluralRules`, not `n === 1 ? "" : "s"`. English needs two forms; Danish also
// two but with different boundaries; Slavic languages need four and Arabic six. Encoding the choice as
// a plural-category object per message means a future locale can supply its own categories without any
// call site changing.

/** A message is either a plain string or, when it varies by count, one string per plural category. */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>;

/** A catalogue is a frozen map of keys to messages for one locale. */
export type Catalogue = Readonly<Record<string, Message>>;

/** Locales the app can resolve to. */
export const LOCALES = ["en", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The localStorage key holding the user's explicit choice. Mirrored in `store/localPrefs.ts` (so
 *  "clear all local data" wipes it) and in `store/settingsFile.ts` (so it travels between machines). */
export const LOCALE_PREF_KEY = "mindmap-locale";

/** Text direction for a locale. Every locale we ship is LTR; RTL is deferred by decision (see
 *  NEXT_STEPS), but the plumbing resolves through here so enabling it later isn't a retrofit. */
export function directionOf(_locale: Locale): "ltr" | "rtl" {
  return "ltr";
}

// --- catalogue registry ---------------------------------------------------

const registry = new Map<Locale, Map<string, Message>>();

/** Merge a catalogue into the registry for `locale`. Called at module scope by each catalogue file, so
 *  a lazy chunk's strings arrive when that chunk loads. Idempotent; later registrations win, which is
 *  what lets a fetched translation overlay the built-in English. */
export function registerMessages(locale: Locale, catalogue: Catalogue): void {
  const existing = registry.get(locale);
  const target = existing ?? new Map<string, Message>();
  for (const [k, v] of Object.entries(catalogue)) target.set(k, v);
  if (!existing) registry.set(locale, target);
}

// --- active locale --------------------------------------------------------

let active: Locale = DEFAULT_LOCALE;

/** Resolve the locale to use: an explicit stored choice wins, else the best `navigator.language` match,
 *  else the default. With one shipped locale this always lands on `en` — the path is real, not stubbed,
 *  so a second catalogue starts working the moment it's added. */
export function resolveLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_PREF_KEY);
    if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  } catch {
    // storage unavailable — fall through to the browser's preference
  }
  const preferred = typeof navigator === "undefined" ? [] : (navigator.languages ?? []);
  for (const tag of preferred) {
    // Match both an exact tag and its base language, so zh-Hans/zh-SG resolve to zh-CN while
    // en-GB/en-US resolve to en.
    const normalized = tag.toLowerCase();
    const base = normalized.split("-")[0];
    const hit = LOCALES.find((l) => {
      const candidate = l.toLowerCase();
      return candidate === normalized || candidate.split("-")[0] === base;
    });
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return active;
}

/** Switch locale, persist the choice, and update the document. */
export function setLocale(locale: Locale): void {
  active = locale;
  try {
    localStorage.setItem(LOCALE_PREF_KEY, locale);
  } catch {
    // best-effort — the choice just won't survive a reload
  }
  applyDocumentLocale(locale);
}

/** Reflect the locale on `<html>` so the browser hyphenates, spell-checks and (later) lays out
 *  correctly. `index.html` ships `lang="en"` with no `dir`; this makes both authoritative at runtime. */
export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.lang = locale;
  el.dir = directionOf(locale);
}

/** Resolve + apply the locale at startup. Call once, before the app renders. */
export function initLocale(): Locale {
  active = resolveLocale();
  applyDocumentLocale(active);
  return active;
}

// --- lookup ---------------------------------------------------------------

/** Values interpolated into a message. `n` doubles as the plural selector. */
export type MessageVars = Record<string, string | number>;

function lookup(key: string): Message | undefined {
  return registry.get(active)?.get(key) ?? registry.get(DEFAULT_LOCALE)?.get(key);
}

/** Pick the plural form for `n` in the active locale. */
function selectPlural(forms: Partial<Record<Intl.LDMLPluralRule, string>>, n: number): string {
  const rule = new Intl.PluralRules(active).select(n);
  // `other` is the only category every locale defines, so it's the guaranteed fallback.
  return forms[rule] ?? forms.other ?? "";
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * The translated string for `key`, with `{name}` placeholders filled from `vars`.
 *
 * A missing key is a programming error, not a runtime condition: it throws in dev so it surfaces in the
 * test suite and the browser console, and degrades to the key itself in production rather than
 * rendering an empty label. `import.meta.env.DEV` is Vite's build-time flag, so the throw is compiled
 * out of the production bundle entirely.
 */
export function t(key: MessageKey, vars?: MessageVars): string {
  const message = lookup(key);
  if (message === undefined) {
    if (import.meta.env.DEV) throw new Error(`i18n: no message for key "${key}"`);
    return key;
  }
  if (typeof message === "string") return interpolate(message, vars);
  // A count message needs `n` to choose its form. Omitting it is a programming error, and silently
  // falling back would render a literal "{n}" to the user — so treat it like a missing key.
  if (vars?.n === undefined) {
    if (import.meta.env.DEV) throw new Error(`i18n: message "${key}" needs a count (vars.n)`);
    return selectPlural(message, 0);
  }
  return interpolate(selectPlural(message, Number(vars.n)), vars);
}

/** Locale-aware collation for user-visible lists (topic titles, tags, map names). Danish sorts `å`
 *  after `z` and German treats `ö` as `o`; the default `.sort()` does neither, and a bare
 *  `localeCompare()` gives no numeric ordering. `numeric` makes "Item 2" precede "Item 10". */
export function collator(): Intl.Collator {
  return new Intl.Collator(active, { sensitivity: "base", numeric: true });
}

/** Compare two user-visible strings for display order. */
export function compareText(a: string, b: string): number {
  return collator().compare(a, b);
}
