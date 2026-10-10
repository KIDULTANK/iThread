// Design gallery — one-click "looks" that apply a coordinated bundle of map-wide styling (canvas
// theme + branch connector style + branch growth weight) at once, like MindManager's Design tab. Pure
// data + a tiny type; App.applyDesign() drives the existing setThemeId / setConnectorStyle /
// setBranchGrowth handles from one of these, so there's no new styling mechanism — just a curated
// preset over the controls that already exist.

import { t } from "./i18n";
import type { BranchGrowth } from "./model/types";

export type ConnectorStyle = "organic" | "curved" | "elbow" | "straight";

export interface Design {
  id: string;
  name: string;
  /** A canvas theme id (see mindmap/theme canvasThemes). */
  themeId: string;
  /** The branch connector style applied map-wide. */
  connectorStyle: ConnectorStyle;
  /** The branch growth weight (line thickness) applied map-wide. */
  branchGrowth: BranchGrowth;
  /** Map-wide accent for relationships + boundaries, so a design recolours them to match its theme.
   *  "" leaves them at the historical purple default. */
  accentColor: string;
  /** One-line description for the gallery. */
  note: string;
}

export const DESIGNS: readonly Design[] = [
  {
    id: "editorial",
    get name() {
      return t("design.editorial");
    },
    themeId: "light",
    connectorStyle: "curved",
    branchGrowth: "fine",
    accentColor: "#be3d32",
    get note() {
      return t("design.editorialNote");
    },
  },
  {
    id: "classic",
    name: "Classic",
    themeId: "light",
    connectorStyle: "organic",
    branchGrowth: "regular",
    accentColor: "",
    note: "Warm light theme, organic tapered branches",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    themeId: "ocean",
    connectorStyle: "elbow",
    branchGrowth: "regular",
    accentColor: "#2e86ab",
    note: "Cool ocean theme, right-angle connectors",
  },
  {
    id: "midnight",
    name: "Midnight",
    themeId: "dark",
    connectorStyle: "curved",
    branchGrowth: "regular",
    accentColor: "#7c83ff",
    note: "Dark theme, smooth curved branches",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    themeId: "sunset",
    connectorStyle: "organic",
    branchGrowth: "regular",
    accentColor: "#e36414",
    note: "Warm sunset palette, organic branches",
  },
  {
    id: "diagram",
    name: "Diagram",
    themeId: "light",
    connectorStyle: "straight",
    branchGrowth: "regular",
    accentColor: "#6b7280",
    note: "Light theme, straight-line connectors",
  },
];

/** Look up a design preset by id (or null). Pure. */
export function designById(id: string): Design | null {
  return DESIGNS.find((d) => d.id === id) ?? null;
}
