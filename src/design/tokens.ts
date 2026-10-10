// Design tokens for the editor chrome (toolbar, side panels, context menu).
//
// This is a *rename/extraction*, not a restyle: every value here is a literal lifted from the
// existing inline styles in src/ui.ts, src/Panels.tsx, src/mindmap/FlowMindMap.tsx and the App
// toolbar/toast strip — so consuming these tokens reproduces today's pixels exactly. The point is
// to give the chrome a single named palette + scales the upcoming UX redesign can build on.
//
// Note on scope: the *canvas* (topic nodes, edges, theme cssVars) has its own theme system in
// src/mindmap/theme.ts, and the start screen has src/components/start/tokens.ts. Those are
// deliberately separate palettes — this file is only the surrounding chrome.
//
// ── Editor redesign (warm-cream + vermilion, theme-reactive) ───────────────────
// The static `colors` object below is the *legacy* chrome palette (cool lilac). The redesigned
// editor chrome (icon rail, two-row top bar, inspector) instead consumes the `--ed-*` custom
// properties emitted by `editorThemeVars()` — the exact same pattern the shipped start screen uses
// (`startThemeVars` → `--st-*`), so Light / Dark / Ocean / Sunset all stay legible from one source.
// The vermilion brand accent is fixed across themes to match the start screen.

import type { CSSProperties } from "react";

/** Vermilion brand accent — fixed across all canvas themes (matches the start screen). */
export const EDITOR_ACCENT = "#be3d32";
export const EDITOR_ACCENT_HOVER = "#a32e25";

/** UI font stacks — system sans (matches index.html) + a mono stack that prefers JetBrains Mono if
 *  the user has it installed but never loads a web font (the product is offline-first). Mirrors the
 *  start screen's stacks so the editor and start screen read as one product. */
export const EDITOR_FONT_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
export const EDITOR_FONT_MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** Build the `--ed-*` custom properties for the `.mm-editor` root from the app's chrome appearance
 *  (Phase 8): `dark` is resolved app-wide (system / light / dark) independently of the canvas theme,
 *  so the chrome can be dark over a light canvas and vice-versa. Chrome surfaces are neutral light/dark
 *  values; the vermilion accent is constant. Consumed by editor.css + the redesigned chrome components. */
export function editorThemeVars(dark: boolean, highContrast = false): CSSProperties {
  const page = dark ? "#1d1c22" : "#faf9f5";
  const card = dark ? "#2a2930" : "#ffffff";
  const ink = dark ? "#e8e6df" : "#23211c";
  // High-contrast mode (OS `prefers-contrast: more` / `forced-colors`, or the explicit toggle): push
  // the neutral chrome tokens to their extremes so borders, dividers and secondary text stop being
  // subtle — max-contrast ink, hard black/white borders, and a denser accent focus ring. Surfaces
  // (page/card) stay as-is so the layout reads the same; only separation + text contrast increase.
  if (highContrast) {
    return {
      "--ed-page": page,
      "--ed-card": card,
      "--ed-sidebar": dark ? "#0e0e14" : "#f0eee7",
      "--ed-border": dark ? "#ffffff" : "#000000",
      "--ed-divider": dark ? "#e6e6e6" : "#111111",
      "--ed-ink": dark ? "#ffffff" : "#000000",
      "--ed-ink2": dark ? "#ececec" : "#161616",
      "--ed-muted": dark ? "#dcdcdc" : "#232323",
      "--ed-faint": dark ? "#cfcfcf" : "#2c2c2c",
      "--ed-accent": dark ? "#ffb1a3" : "#8f241c",
      "--ed-accent-hover": dark ? "#ffd0c8" : "#7b2019",
      "--ed-on-accent": dark ? "#201c1b" : "#ffffff",
      "--ed-accent-tint": dark ? "rgba(255,177,163,0.26)" : "rgba(143,36,28,0.16)",
      "--ed-accent-ring": dark ? "rgba(255,208,200,0.85)" : "rgba(143,36,28,0.85)",
      "--ed-danger": dark ? "#ff8a88" : "#8f1210",
      "--ed-toast-ink": dark ? "#dfe7f2" : "#1a1550",
      "--ed-toast-border": dark ? "#ffffff" : "#000000",
      "--ed-toast-success-bg": dark ? "rgba(95,211,154,0.24)" : "#e2f7ec",
      "--ed-toast-info-bg": dark ? "rgba(90,110,170,0.28)" : "#e7edfb",
      "--ed-toast-error-bg": dark ? "rgba(255,138,136,0.26)" : "#fbe4e4",
      "--ed-toast-error-ink": dark ? "#ffb3b1" : "#5f0f0e",
      "--ed-toast-error-border": dark ? "#ff8a88" : "#8f1210",
      "--ed-toast-warn-bg": dark ? "rgba(214,170,80,0.30)" : "#f7e7cd",
      "--ed-toast-warn-ink": dark ? "#f0d6a6" : "#4a2a04",
      "--ed-toast-warn-border": dark ? "#e8cfa0" : "#7a4a08",
      "--ed-shadow": dark ? "0 0 0 1px #ffffff" : "0 0 0 1px #000000",
      "--ed-shadow-pop": dark ? "0 0 0 2px #ffffff" : "0 0 0 2px #000000",
      "--ed-dur-fast": `${motion.dur.fast}ms`,
      "--ed-dur-base": `${motion.dur.base}ms`,
      "--ed-dur-slow": `${motion.dur.slow}ms`,
      "--ed-ease": motion.ease.standard,
      "--ed-font-sans": EDITOR_FONT_SANS,
      "--ed-font-mono": EDITOR_FONT_MONO,
    } as CSSProperties;
  }
  return {
    "--ed-page": page,
    "--ed-card": card,
    "--ed-sidebar": dark ? "#16151d" : "#f4f2ec",
    "--ed-border": dark ? "rgba(255,255,255,0.11)" : "#e7e4dc",
    "--ed-divider": dark ? "rgba(255,255,255,0.06)" : "#efece4",
    "--ed-ink": ink,
    "--ed-ink2": dark ? "#bdb8ad" : "#5c574e",
    // Light-mode muted/faint darkened to meet WCAG AA (4.5:1) on the near-white card/page — the old
    // #938d81 (3.3:1) / #b6b0a4 (2.2:1) failed for body text. Kept as light as compliance allows, warm
    // hue + muted-darker-than-faint preserved. Dark mode (light-on-dark, already high-contrast) unchanged.
    "--ed-muted": dark ? "#8f8a80" : "#706a5f",
    "--ed-faint": dark ? "#6d695f" : "#7a7468",
    "--ed-accent": dark ? "#ef9486" : EDITOR_ACCENT,
    "--ed-accent-hover": dark ? "#ffb1a3" : EDITOR_ACCENT_HOVER,
    "--ed-on-accent": dark ? "#201c1b" : "#ffffff",
    "--ed-accent-tint": dark ? "rgba(219,97,81,0.18)" : "rgba(190,61,50,0.08)",
    "--ed-accent-ring": "rgba(190,61,50,0.24)",
    "--ed-danger": "#b23b3a",
    // Toast + import-banner strips — theme-reactive so feedback isn't a pale light box on a dark
    // canvas (the legacy hardcoded hex are kept as fallbacks where --ed-* isn't in scope, e.g. the
    // Start-screen floating toast). Light values match the old static colors.toast palette.
    "--ed-toast-ink": dark ? "#dfe7f2" : "#26215c",
    "--ed-toast-border": dark ? "rgba(255,255,255,0.12)" : "#cecbf6",
    "--ed-toast-success-bg": dark ? "rgba(219,97,81,0.18)" : "#eafaf0",
    "--ed-toast-info-bg": dark ? "rgba(90,110,170,0.20)" : "#eef2fc",
    "--ed-toast-error-bg": dark ? "rgba(178,59,58,0.22)" : "#fcebeb",
    "--ed-toast-error-ink": dark ? "#f1b8b6" : "#791f1f",
    "--ed-toast-error-border": dark ? "rgba(178,59,58,0.42)" : "#f7c1c1",
    "--ed-toast-warn-bg": dark ? "rgba(154,120,30,0.24)" : "#faeeda",
    "--ed-toast-warn-ink": dark ? "#e8cfa0" : "#633806",
    "--ed-toast-warn-border": dark ? "rgba(214,170,80,0.46)" : "#fac775",
    "--ed-shadow": dark ? "0 6px 22px rgba(0,0,0,0.38)" : "0 6px 22px rgba(40,30,16,0.08)",
    "--ed-shadow-pop": dark ? "0 12px 32px rgba(0,0,0,0.5)" : "0 12px 32px rgba(40,30,16,0.18)",
    // Motion timings (not theme-dependent — same in light/dark; emitted here so editor.css transitions
    // read one source instead of scattered `0.12s` literals).
    "--ed-dur-fast": `${motion.dur.fast}ms`,
    "--ed-dur-base": `${motion.dur.base}ms`,
    "--ed-dur-slow": `${motion.dur.slow}ms`,
    "--ed-ease": motion.ease.standard,
    "--ed-font-sans": EDITOR_FONT_SANS,
    "--ed-font-mono": EDITOR_FONT_MONO,
  } as CSSProperties;
}

/** Semantic colours for the side panels (Outline / Filter / Styles / History / Index / Info).
 *  Phase 8: these now resolve to the theme-reactive `--ed-*` tokens above (every consumer renders
 *  inside `.mm-editor`, where those tokens are in scope), so the panels + shared primitives go dark
 *  with the app appearance — with the original light hex kept as the `var()` fallback so nothing
 *  changes in light mode or if a token is ever out of scope. The swatch arrays + a couple of
 *  genuinely-fixed values stay literal. */
export const colors = {
  /** Primary ink — topic/panel text, control labels. */
  text: "var(--ed-ink, #23211c)",
  /** Muted label text (section sub-labels, inline field labels). */
  muted: "var(--ed-ink2, #5c574e)",
  /** Fainter secondary text (counts, hints, empty-state copy). */
  faint: "var(--ed-muted, #706a5f)",
  /** Placeholder / disabled-ish copy in the notes editor empty states. */
  placeholder: "var(--ed-faint, #b6b0a4)",

  /** Divider / border between panel regions and below the marker/style bars. */
  border: "var(--ed-border, #e7e4dc)",
  /** Control border (buttons, inputs, chips, swatch frames). */
  controlBorder: "var(--ed-border, #e7e4dc)",

  /** Panel aside background. */
  surface: "var(--ed-card, #ffffff)",
  /** Marker/Style bar background (a faint warm strip inside the Info panel). */
  surfaceBar: "var(--ed-sidebar, #f4f2ec)",
  /** Plain surface (inputs, swatch buttons, the "off" chip) — the adaptive card surface. */
  white: "var(--ed-card, #fff)",

  /** Control fill (the toolbar button look). */
  controlBg: "var(--ed-sidebar, #f4f2ec)",
  /** Accent — active chip background + border, the lit toggle state (vermilion). */
  accent: "var(--ed-accent, #be3d32)",
  /** Accent used as the history-timeline range slider tint. */
  accentSlider: "var(--ed-accent, #be3d32)",
  /** Active marker chip background (a soft vermilion tint, distinct from the solid accent fill). */
  accentTint: "var(--ed-accent-tint, #e3f1ea)",
  /** Destructive action colour (delete confirms, danger buttons). */
  danger: "var(--ed-danger, #b23b3a)",

  /** Context-menu chrome (FlowMindMap right-click menu + linking banner). */
  menu: {
    border: "var(--ed-border, #cfcfe0)",
    separator: "var(--ed-divider, #eceafb)",
    /** Themed fallbacks for the menu surface when no node theme cssVar is present. */
    fallbackBg: "var(--ed-card, #fff)",
    fallbackColor: "var(--ed-ink, #222)",
    /** Linking-banner fallbacks (mirror the root node theme vars) — kept literal (a fixed dark banner). */
    linkBg: "#26215c",
    linkColor: "#fff",
  },

  /** Floating playback bar border. */
  playbackBorder: "var(--ed-border, #d9d7ea)",

  /** Import/notification strips along the top of the editor. */
  toast: {
    successBg: "var(--ed-toast-success-bg, #eafaf0)",
    infoBg: "var(--ed-toast-info-bg, #eef2fc)",
    /** Success/info share the control border below the strip. */
    infoBorder: "var(--ed-toast-border, #cecbf6)",
    errorBg: "var(--ed-toast-error-bg, #fcebeb)",
    errorText: "var(--ed-toast-error-ink, #791f1f)",
    errorBorder: "var(--ed-toast-error-border, #f7c1c1)",
    warnBg: "var(--ed-toast-warn-bg, #faeeda)",
    warnText: "var(--ed-toast-warn-ink, #633806)",
    warnBorder: "var(--ed-toast-warn-border, #fac775)",
  },

  /** Per-topic fill swatches (StyleBar + StylesPanel conditional-formatting picker). */
  fillSwatches: ["#fde2e2", "#e2ecfd", "#e2fbe8", "#fdf3e2", "#efe2fd", "#ececec"],
  /** Per-topic border swatches (paired 1:1 with the fills above). */
  borderSwatches: ["#e23b3b", "#3b8bd4", "#27852f", "#d98a17", "#7a3fb0", "#555555"],
  /** Stroke/accent swatches for line-coloured objects (relationships + boundary/overlay inspectors).
   *  Index 0 is the shared default (CROSSLINK_COLOR / BOUNDARY_STROKE); an empty pick resets to it.
   *  One source of truth so the edge + overlay inspectors stay in sync (P5). */
  strokeSwatches: ["#8b87e0", "#e0697f", "#3f9e6e", "#d98a2b", "#3b82c4", "#111827"],
} as const;

/** Spacing scale (px) — the paddings/gaps the chrome actually uses. Names are t-shirt sizes; the
 *  values are the recurring ones (2/3/4/6/8/10/12/16) seen across the panels and toolbar. */
export const space = {
  xxs: 2,
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
  xxxl: 16,
} as const;

/** Corner-radius scale (px). 4 = swatch, 6 = chip/small button, 8 = control/input, 12 = floating bar. */
export const radius = {
  xs: 4,
  sm: 5,
  md: 6,
  lg: 8,
  xl: 12,
} as const;

/** Font-size scale (px) — the type sizes used by the chrome controls + labels. */
export const fontSize = {
  /** Section sub-labels, counts, hints. */
  xs: 11,
  /** Inline field labels, secondary copy, small buttons. */
  sm: 12,
  /** Default control + list-row text. */
  md: 13,
  /** Shape-picker glyph buttons. */
  lg: 14,
  /** Marker glyph buttons. */
  xl: 16,
} as const;

/** Font weights used by the chrome. */
export const fontWeight = {
  normal: 400,
  semibold: 600,
  bold: 700,
} as const;

/** Motion timings (ms) + easing — one source for both the chrome CSS transitions (emitted as the
 *  `--ed-dur-*` / `--ed-ease` custom properties by editorThemeVars, consumed in editor.css) and the
 *  canvas viewport animations (read directly as `motion.dur.*`). */
export const motion = {
  dur: {
    /** Chrome micro-interactions — hover / press / toggle (the recurring `0.12s`). */
    fast: 120,
    /** Default chrome transition — menus, panels, sheet snap. */
    base: 160,
    /** Larger chrome moves — drawer / sheet slide. */
    slow: 240,
    /** Fit-to-view / fit-to-selection (canvas). */
    fit: 300,
    /** Programmatic viewport set — saved-view restore, tab switch (canvas). */
    viewport: 350,
  },
  ease: {
    /** The chrome's standard easing. */
    standard: "ease",
  },
} as const;

/** Type presets — each bundles size + weight + line-height (+ tracking/case for labels) for a role, so
 *  headings/body/labels can't drift to ad-hoc inline `fontSize`s. Spread onto a `style`. (Named
 *  `typeScale`, not `type`, so `import { type … }` isn't mistaken for TS's type-only import syntax.) */
export const typeScale = {
  /** Dialog + section titles (was an off-scale inline `fontSize: 15`). */
  title: { fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  /** Body / control text. */
  body: { fontSize: 13, fontWeight: 400, lineHeight: 1.45 },
  /** Small-caps section sub-labels. */
  label: {
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
} as const satisfies Record<string, CSSProperties>;
