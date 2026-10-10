import { t } from "../i18n";
// Default canvas theme — the warm-cream + emerald brand language (matches the editor chrome + Start
// screen as of the 2026-06 redesign).
//
// `palette` is the important bit: the canvas colours each main branch (and its descendants) by
// cycling this palette from the root outward (the "coloured branch" identity). The root is the
// emerald brand accent; the branches are the warm support palette shared with the chrome's MiniMap.
// `exportSvg` is handed this same palette + cssVar, so the screen and every PNG/SVG/PDF/Office export
// stay byte-faithful (canvas == export). The cssVar block rounds the topic shapes and fattens the
// connectors.
export const mindManagerTheme = {
  name: "Light",
  type: "light" as const,
  palette: ["#75675a", "#637587", "#69796e", "#966c68", "#8a7a57", "#7a718b"],
  cssVar: {
    "--main-color": "#23211c",
    "--main-bgcolor": "#faf8f2",
    "--color": "#23211c",
    "--bgcolor": "#fffdf9",
    "--selected": "#be3d32",
    "--root-color": "#ffffff",
    "--root-bgcolor": "#be3d32",
    "--root-radius": "12px",
    "--main-radius": "8px",
    "--topic-padding": "8px",
    "--line-width": "2px",
    "--main-line-width": "2px",
    "--line-color": "#cbc7bd",
  },
};

// Dark canvas variant — same per-branch palette (the MindManager identity) on dark
// surfaces. Branch connectors keep their per-branch palette colours (they don't use
// `--line-color`); image exports inherit the theme. Topic shapes/sizing match the light theme.
export const mindManagerDarkTheme = {
  name: "Dark",
  type: "dark" as const,
  palette: mindManagerTheme.palette,
  cssVar: {
    ...mindManagerTheme.cssVar,
    "--main-color": "#e8e6df",
    "--main-bgcolor": "#1d1c22",
    "--color": "#e8e6df",
    "--bgcolor": "#2a2930",
    "--selected": "#ef9486",
    "--root-color": "#ffffff",
    "--root-bgcolor": "#a32e25",
    "--line-color": "#56545e",
  },
};

// Ocean — cool blue/teal branch palette on a light surface.
export const oceanTheme = {
  name: "Ocean",
  type: "light" as const,
  palette: ["#0C6291", "#1B998B", "#2E86AB", "#3D5A80", "#5F7A61", "#2A9D8F", "#264653"],
  cssVar: {
    ...mindManagerTheme.cssVar,
    "--main-bgcolor": "#f4f8fb",
    "--root-bgcolor": "#0b3954",
    "--line-color": "#a9c2cf",
    "--selected": "#1b998b",
  },
};

// Sunset — warm red/orange/amber branch palette on a light surface.
export const sunsetTheme = {
  name: "Sunset",
  type: "light" as const,
  palette: ["#C1121F", "#E36414", "#9A031E", "#BC6C25", "#A4243B", "#D8572A", "#6A040F"],
  cssVar: {
    ...mindManagerTheme.cssVar,
    "--main-bgcolor": "#fbf6f1",
    "--root-bgcolor": "#6a040f",
    "--line-color": "#d8c3b3",
    "--selected": "#e36414",
  },
};

/** The shape of a canvas theme: a per-branch palette + CSS custom properties. */
export interface MindMapTheme {
  name: string;
  type: "light" | "dark";
  palette: string[];
  cssVar: Record<string, string>;
}

export interface CanvasTheme {
  id: string;
  name: string;
  theme: MindMapTheme;
}

// The canvas style gallery, in pick order. id is persisted in localStorage, so it stays a plain
// literal; `name` is a getter — a plain `name: t("…")` field here would resolve ONCE at import and
// never follow a later `setLocale`.
export const canvasThemes: CanvasTheme[] = [
  {
    id: "light",
    get name() {
      return t("common.light");
    },
    theme: mindManagerTheme,
  },
  {
    id: "dark",
    get name() {
      return t("common.dark");
    },
    theme: mindManagerDarkTheme,
  },
  {
    id: "ocean",
    get name() {
      return t("theme.ocean");
    },
    theme: oceanTheme,
  },
  {
    id: "sunset",
    get name() {
      return t("theme.sunset");
    },
    theme: sunsetTheme,
  },
];

export function themeById(id: string): CanvasTheme {
  return canvasThemes.find((t) => t.id === id) ?? canvasThemes[0];
}
