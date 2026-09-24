import { type ChangeEvent, type FormEvent, type ReactNode, type RefObject, useRef } from "react";
import { BrainstormTimer } from "../BrainstormTimer";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
} from "../design/primitives";
import { examples } from "../examples";
import type { SaveState } from "../hooks/useIdbAutosave";
import { t } from "../i18n";
import { MAP_PARTS, buildMapPart } from "../mapParts";
import type { LayoutKind, MindMapHandle, SelectedNode } from "../mindmap";
import { STICKY_NOTE_COLORS, type StickyNoteColor } from "../mindmap/flow/ops";
import type { CanvasTheme } from "../mindmap/theme";
import type { CanvasShapeKind, MindMapDoc } from "../model/types";
import { PANEL_LABELS } from "../panelLabels";
import type { NodeHit } from "../search";
import { SHORTCUT_BINDINGS } from "../shortcuts";
import type { MapSummary } from "../store/mapStore";
import { buildTemplate, insertableTemplates, templateSubtree, templates } from "../templates";
import { EditorIcon, type EditorIconName } from "./EditorIcons";

// Remember the last-chosen export format, BY ITS STABLE ID, so the Export menu can pin a one-click
// "Last used" row at the top — the common case is re-exporting the same format. Best-effort
// localStorage, mirroring the ⌘K recents.
//
// This used to persist the rendered LABEL and call it "the stable id" — which stopped being true the
// moment i18n existed. A label is not an identity: it follows the locale, so the stored string could
// stop matching any current export the next time the app opened in a different language, and the
// feature would just quietly never fire again. It is also what the menu's React `key` used to read.
const LAST_EXPORT_KEY = "mindmap-last-export";

/** Background shapes + smart containers offered in the Insert → Shapes fly-out (Tier 4 items 23 + 22).
 *  `name` is a getter: a plain `name: t("…")` here resolves ONCE at import and never follows a later
 *  `setLocale`. `kind` (the React key) stays a plain literal. */
const SHAPE_ITEMS: { kind: CanvasShapeKind; name: string }[] = [
  {
    kind: "rect",
    get name() {
      return t("toolbar.rectangle");
    },
  },
  {
    kind: "ellipse",
    get name() {
      return t("toolbar.ellipse");
    },
  },
  {
    kind: "blockArrow",
    get name() {
      return t("toolbar.blockArrow");
    },
  },
  {
    kind: "chevron",
    get name() {
      return t("toolbar.chevron");
    },
  },
  {
    kind: "swimlane",
    get name() {
      return t("toolbar.swimlaneContainer");
    },
  },
  {
    kind: "matrix",
    get name() {
      return t("toolbar.matrixContainer");
    },
  },
];

/** The stable id of the last export format used — never its label, which follows the locale. */
function loadLastExport(): string | null {
  try {
    const v = localStorage.getItem(LAST_EXPORT_KEY);
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}
function saveLastExport(label: string) {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, label);
  } catch {
    // best-effort — the recency row just won't persist
  }
}

// The preferred sticky-note colour (item 17): the last colour the user picked becomes the default for
// the plain "Sticky note" item. Best-effort localStorage, validated against the palette on read.
const STICKY_COLOR_KEY = "mindmap-sticky-color";
function loadStickyColor(): StickyNoteColor {
  try {
    const v = localStorage.getItem(STICKY_COLOR_KEY);
    if (v && v in STICKY_NOTE_COLORS) return v as StickyNoteColor;
  } catch {
    // ignore — fall through to the default
  }
  return "amber";
}
function saveStickyColor(color: StickyNoteColor) {
  try {
    localStorage.setItem(STICKY_COLOR_KEY, color);
  } catch {
    // best-effort — the preference just won't persist
  }
}

// The redesigned editor top bar — a two-row chrome in the warm-cream + emerald language (see
// design/editor.css, .mm-topbar*). Row 1 is file/identity (Start, map switcher, New, Find, Export,
// More); row 2 is view/edit/canvas, grouped into labelled dropdown menus so every existing control
// keeps a home without a wall of buttons. The component is still a pure prop-driven view: it owns no
// model state (the menus' open/close + BrainstormTimer are local UI only), and the ToolbarProps
// contract is unchanged from the previous toolbar, so App's wiring is untouched. Nothing the old
// toolbar could do was dropped — controls were re-homed, not removed.

/** Show/hide flags + setters for the side panels and the canvas-numbering toggle. */
export interface ToolbarPanels {
  outlineOpen: boolean;
  setOutlineOpen: (fn: (v: boolean) => boolean) => void;
  indexOpen: boolean;
  setIndexOpen: (fn: (v: boolean) => boolean) => void;
  filterOpen: boolean;
  toggleFilter: () => void;
  stylesOpen: boolean;
  setStylesOpen: (fn: (v: boolean) => boolean) => void;
  relationshipsOpen: boolean;
  setRelationshipsOpen: (fn: (v: boolean) => boolean) => void;
  historyOpen: boolean;
  setHistoryOpen: (fn: (v: boolean) => boolean) => void;
  boardOpen: boolean;
  setBoardOpen: (fn: (v: boolean) => boolean) => void;
  statsOpen: boolean;
  setStatsOpen: (fn: (v: boolean) => boolean) => void;
  agendaOpen: boolean;
  setAgendaOpen: (fn: (v: boolean) => boolean) => void;
  mapsOpen: boolean;
  setMapsOpen: (fn: (v: boolean) => boolean) => void;
  inboxOpen: boolean;
  setInboxOpen: (fn: (v: boolean) => boolean) => void;
  deckEditorOpen: boolean;
  setDeckEditorOpen: (fn: (v: boolean) => boolean) => void;
  noteEditorOpen: boolean;
  setNoteEditorOpen: (fn: (v: boolean) => boolean) => void;
  infoOpen: boolean;
  setInfoOpen: (fn: (v: boolean) => boolean) => void;
  infoMinimized: boolean;
  setInfoMinimized: (fn: (v: boolean) => boolean) => void;
  numbered: boolean;
  setNumbered: (fn: (v: boolean) => boolean) => void;
  spellcheck: boolean;
  setSpellcheck: (fn: (v: boolean) => boolean) => void;
}

/** Map/library state + the map-level actions (open, new, duplicate, delete, present, roll-ups). */
export interface ToolbarMap {
  doc: MindMapDoc;
  liveDoc: MindMapDoc;
  maps: MapSummary[];
  mapOptions: MapSummary[];
  switchMap: (id: string) => void;
  /** Load a new doc from a template/example builder (the "+ New…" menu). */
  load: (doc: MindMapDoc) => void;
  duplicateMap: () => void;
  deleteCurrent: () => void;
  /** Copy the selected branch out into a new standalone library map ("New map from topic"). */
  promoteBranch: () => void;
  /** Graft another library map's tree under the selected topic ("Insert map as branch"). */
  mergeMap: (sourceId: string) => void;
  present: () => void;
  refreshRollupsNow: () => void;
}

/** Canvas-styling controls: theme, layout, branch focus, the per-node image picker. */
export interface ToolbarCanvas {
  theme: CanvasTheme;
  setThemeId: (id: string) => void;
  layout: LayoutKind;
  changeLayout: (value: LayoutKind) => void;
  selected: SelectedNode | null;
  setFocus: (focus: { id: string; topic: string }) => void;
  /** Per-node image picker (the "Image" label control). */
  handleImage: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Per-map canvas background image picker. */
  handleBackgroundImage: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Format Painter: copy the selected topic's style / paste it across the selection. */
  copyFormat: () => void;
  pasteFormat: () => void;
  /** Whether a style has been copied (enables "Paste format"). */
  canPasteFormat: boolean;
  /** Auto-colour the top branches from the theme palette. */
  shuffleBranchColors: () => void;
  /** Open the Map panel (the no-selection inspector) where persistent styling now lives. */
  openMapPanel: () => void;
  /** Drill in: re-root the canvas view at the selected topic (focus-on-topic). */
  drillIn: () => void;
  /** Open the "Export this branch…" format picker scoped to a node's subtree (B4). */
  exportBranch: (id: string) => void;
  /** Start the guided walk (step through every topic in outline order with a spotlight + notes). */
  startWalk: () => void;
  /** Align / distribute the selected free-canvas nodes (freeform mode). */
  alignSelection: (mode: "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom") => void;
  distributeSelection: (axis: "h" | "v") => void;
  /** How many nodes are selected + whether the map is in free-canvas mode (gates the Arrange tools). */
  selectedCount: number;
  freeform: boolean;
}

/** The find / replace form state + actions. */
export interface ToolbarFind {
  query: string;
  setQuery: (value: string) => void;
  replaceWith: string;
  setReplaceWith: (value: string) => void;
  replaceScope: "topics" | "notes" | "both";
  setReplaceScope: (value: "topics" | "notes" | "both") => void;
  useRegex: boolean;
  setUseRegex: (value: boolean) => void;
  matchCase: boolean;
  setMatchCase: (value: boolean) => void;
  matchInfo: string;
  /** Every current match (topic + breadcrumb + snippet), for the overlay's "all matches" list. */
  matches: NodeHit[];
  /** The id the cycler / list currently sits on (drives the active-row highlight). */
  activeId: string | null;
  /** Jump straight to a match by id (a list-row click). */
  goTo: (id: string) => void;
  runSearch: (event: FormEvent) => void;
  /** Advance to the next / previous match (the overlay's ▾ ▴ buttons; Enter / Shift+Enter). */
  findNext: () => void;
  findPrev: () => void;
  runReplace: () => void;
}

/** File I/O: the export menu's per-format handlers + library backup / copy / open. */
export interface ToolbarIo {
  exportJson: () => void;
  exportMarkdown: () => void;
  exportMermaid: () => void;
  exportXmind: () => void;
  exportSmmx: () => void;
  exportMmap: () => void;
  exportOpml: () => void;
  exportFreemind: () => void;
  /** Export the map as a PNG; opts pick a resolution scale (2×/4×) and/or a transparent background. */
  exportPng: (opts?: { scale?: number; transparent?: boolean }) => void;
  exportSvg: () => void;
  exportHtml: () => void;
  exportInteractiveHtml: () => void;
  exportDeck: () => void;
  exportPdf: () => void;
  /** Direct PDF file download (item 7): map rendered + embedded, with page size / orientation. */
  exportPdfFile: (opts?: {
    pageSize?: "fit" | "a4" | "letter";
    orientation?: "portrait" | "landscape";
  }) => void;
  exportDocx: () => void;
  exportPptx: () => void;
  exportXlsx: () => void;
  exportLibrary: () => void;
  copyOutline: () => void;
  copyTable: () => void;
  /** Copy a shareable deep-link (?map=…&node=…) to the selected topic to the clipboard. */
  copyDeepLink: () => void;
  /** Copy the rendered map to the clipboard as a PNG image (no file); opts as for exportPng. */
  copyPng: (opts?: { scale?: number; transparent?: boolean }) => void;
  handleFile: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Native disk-file actions (File System Access API, with a download/upload fallback). */
  openFile: () => void;
  saveFile: () => void;
  saveFileAs: () => void;
  /** Re-open a recently-opened disk file by its map id (Open Recent). */
  openRecentFile: (id: string) => void;
  /** The Open-Recent list (most-recent first); drives the File → Open Recent submenu. */
  recentFiles: { id: string; name: string }[];
  /** The active map's linked file name (null = library-only) + whether it's unsaved to disk. */
  fileName: string | null;
  dirty: boolean;
}

/** Saved views (bookmarked perspectives) for the View menu. */
export interface ToolbarViews {
  list: { id: string; name: string }[];
  /** Capture + name the current view (App prompts for the name). */
  onSave: () => void;
  /** Jump to a saved view by id. */
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface ToolbarProps {
  /** Phone-width: rows scroll horizontally instead of wrapping. */
  isMobile: boolean;
  /** The canvas handle — most canvas controls are thin `mapRef.current?.X()` calls. */
  mapRef: RefObject<MindMapHandle | null>;
  nav: {
    goHome: () => void;
    openAbout: () => void;
    openShortcuts: () => void;
    openSearchAll: () => void;
    openPaste: () => void;
    /** Open the Find & Replace overlay (also bound to Ctrl/⌘+F and the "/" key). */
    openFind: () => void;
    /** Open the Settings / Preferences dialog (IconRail ⚙ + ⌘K). */
    openSettings: () => void;
    /** Re-show the first-run "3 things to try" card (clears the one-shot flag) — from ⌘K / Settings. */
    reShowGettingStarted: () => void;
    /** Step back / forward through the navigation history (Alt+← / Alt+→). */
    navBack: () => void;
    navForward: () => void;
    /** Whether there's anywhere to go back / forward (gates the ⌘K commands). */
    canBack: boolean;
    canForward: boolean;
  };
  panels: ToolbarPanels;
  map: ToolbarMap;
  canvas: ToolbarCanvas;
  find: ToolbarFind;
  io: ToolbarIo;
  views: ToolbarViews;
  /** Undo / redo for the Row-1 buttons. canUndo/canRedo are reported live from the canvas history so
   *  the buttons disable correctly; undo/redo fire the action and a transient "Undone"/"Redone" toast. */
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
  /** Transient hint toast (used by the group/summary/note/roll-up actions). */
  showHint: (message: string) => void;
  /** Live autosave status → the "Saved locally" badge (so it can't claim "Saved" mid-write or after a
   *  failed write). `undefined` keeps the legacy static "Saved locally" look. */
  saveState?: SaveState;
}

// ── primitives ───────────────────────────────────────────────────────────────
function TBtn({
  icon,
  label,
  text,
  active,
  danger,
  ghost,
  primary,
  disabled,
  onClick,
}: {
  icon?: EditorIconName;
  label: string;
  text?: string;
  active?: boolean;
  danger?: boolean;
  ghost?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const cls = [
    "mm-tbtn",
    icon && !text ? "mm-tbtn-icon" : "",
    danger ? "mm-tbtn-danger" : "",
    ghost ? "mm-tbtn-ghost" : "",
    primary ? "mm-tbtn-primary" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      title={label}
      aria-label={text ? undefined : label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && <EditorIcon name={icon} size={17} />}
      {text}
    </button>
  );
}

/** A toolbar dropdown trigger's inner content (icon + label + chevron). `compact` drops the visible
 *  label (icon-only) for the narrow mobile bar — pair it with `triggerAriaLabel` so the accessible
 *  name is preserved and the menu a11y parity net stays green. */
function menuTrigger(icon: EditorIconName, label: string, compact = false): ReactNode {
  return (
    <>
      <EditorIcon name={icon} size={16} />
      {compact ? null : label}
      <EditorIcon name="chevron" size={13} />
    </>
  );
}

/** A 15px editor icon node for a menu item's leading glyph. */
function mi(name: EditorIconName): ReactNode {
  return <EditorIcon name={name} size={15} />;
}

export function Toolbar({
  isMobile,
  mapRef,
  nav,
  panels,
  map,
  canvas,
  io,
  views,
  history,
  showHint,
  saveState,
}: ToolbarProps) {
  const { liveDoc } = map;
  const m = () => mapRef.current;
  // Hidden file inputs driven by their menu buttons (a button is keyboard-operable; a <label>
  // wrapping a display:none input is not — a11y SC 2.1.1).
  const importInputRef = useRef<HTMLInputElement>(null);
  const nodeImageInputRef = useRef<HTMLInputElement>(null);

  // The format labels reuse the `cmd.export.*` keys rather than minting `toolbar.*` twins: this menu
  // and the ⌘K "Export …" rows offer the same formats, so one message keeps them from drifting apart
  // in translation. Only the two labels with no ⌘K equivalent are toolbar-local.
  // Each item carries a STABLE ID alongside its label. "Last used" persists the id, never the label —
  // a translated label is not an identity, and the previous shape (keying on the rendered string)
  // silently stopped matching the moment a second locale existed. Group headings also carry an id, for
  // the same reason their React `key` must not be the group's translated name.
  const EXPORTS: { groupId: string; group: string; items: [string, string, () => void][] }[] = [
    {
      groupId: "data",
      group: t("toolbar.exportGroup.data"),
      items: [
        ["json", t("cmd.export.json"), io.exportJson],
        ["md", t("cmd.export.md"), io.exportMarkdown],
        ["opml", t("cmd.export.opml"), io.exportOpml],
        ["freemind", t("cmd.export.freemind"), io.exportFreemind],
        ["mermaid", t("cmd.export.mermaid"), io.exportMermaid],
        ["xmind", t("cmd.export.xmind"), io.exportXmind],
        ["smmx", t("cmd.export.smmx"), io.exportSmmx],
        ["mmap", t("cmd.export.mmap"), io.exportMmap],
      ],
    },
    {
      groupId: "image",
      group: t("toolbar.exportGroup.image"),
      items: [
        ["png", t("cmd.export.png"), () => io.exportPng()],
        ["png2x", t("cmd.export.png2x"), () => io.exportPng({ scale: 2 })],
        ["png4x", t("cmd.export.png4x"), () => io.exportPng({ scale: 4 })],
        [
          "png-transparent",
          t("cmd.export.png-transparent"),
          () => io.exportPng({ transparent: true }),
        ],
        ["copy-image", t("toolbar.copyImageToClipboard"), () => io.copyPng()],
        ["svg", t("cmd.export.svg"), io.exportSvg],
      ],
    },
    {
      groupId: "document",
      group: t("toolbar.exportGroup.document"),
      items: [
        ["html", t("cmd.export.html"), io.exportHtml],
        ["ihtml", t("cmd.export.ihtml"), io.exportInteractiveHtml],
        ["pdf-fit", t("cmd.export.pdf-fit"), () => io.exportPdfFile({ pageSize: "fit" })],
        [
          "pdf-a4",
          t("cmd.export.pdf-a4"),
          () => io.exportPdfFile({ pageSize: "a4", orientation: "landscape" }),
        ],
        [
          "pdf-letter",
          t("toolbar.exportPdfLetter"),
          () => io.exportPdfFile({ pageSize: "letter" }),
        ],
        ["pdf-print", t("cmd.export.pdf-print"), io.exportPdf],
        ["docx", t("cmd.export.docx"), io.exportDocx],
        ["xlsx", t("cmd.export.xlsx"), io.exportXlsx],
      ],
    },
    {
      groupId: "presentation",
      group: t("toolbar.exportGroup.presentation"),
      items: [
        ["deck", t("cmd.export.deck"), io.exportDeck],
        ["pptx", t("cmd.export.pptx"), io.exportPptx],
      ],
    },
  ];

  return (
    <header className="mm-topbar">
      {/* ── Row 1 — file / identity ── */}
      <div className="mm-topbar-row mm-topbar-row1">
        <TBtn icon="home" label={t("toolbar.startScreen")} onClick={nav.goHome} />
        <TBtn
          icon="undo"
          label={t("toolbar.undo")}
          disabled={!history.canUndo}
          onClick={history.undo}
        />
        <TBtn
          icon="redo"
          label={t("toolbar.redo")}
          disabled={!history.canRedo}
          onClick={history.redo}
        />
        {isMobile ? null : <span className="mm-crumb">{t("toolbar.maps")}</span>}
        {/* A "browse all maps" picker — distinct from the open-document tabs below (which show only the
            currently-open maps). Held at value="" so it reads as an action (t("toolbar.openAMap")) instead of
            duplicating the active tab's title; choosing one switches to it (opening a tab). */}
        <select
          className="mm-select mm-open-map"
          value=""
          onChange={(e) => {
            if (e.target.value) map.switchMap(e.target.value);
          }}
          aria-label={t("toolbar.openMap")}
          title={t("toolbar.openAMapFromYour")}
          style={{ maxWidth: isMobile ? 116 : 200 }}
        >
          <option value="">{t("toolbar.openAMap")}</option>
          {map.mapOptions.map((mm) => (
            <option key={mm.id} value={mm.id}>
              {mm.title || t("common.untitled")}
            </option>
          ))}
        </select>
        {/* New-map picker, t("toolbar.allMaps") search, and the "Saved locally" badge are desktop-only — on a
            phone they're reached from the Start screen / command palette, and the space is needed for
            Find / Export / More to stay visible. */}
        {isMobile ? null : (
          <>
            <select
              className="mm-select"
              value=""
              onChange={async (e) => {
                const v = e.target.value;
                if (!v) return;
                // The example BODIES load on demand. This module is eager, so a static import here
                // would pull every example map into the entry chunk — measured at 6.7 kB gz, carried
                // by every first visit whether or not anyone opens one. Templates stay static: they
                // are small, and `buildTemplate` is also reached from the synchronous Insert menu.
                if (v.startsWith("ex:")) {
                  const { buildExample } = await import("../exampleBuilders");
                  map.load(buildExample(v.slice(3)));
                } else {
                  map.load(buildTemplate(v));
                }
              }}
              aria-label={t("toolbar.newMapFromATemplate")}
              title={t("toolbar.newMapBlankTemplateOr")}
            >
              <option value="">{t("toolbar.newMenu")}</option>
              <optgroup label={t("toolbar.templates")}>
                {/* `tpl`, not `t` — see the templates MenuSub below; the shadow is a live trap. */}
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("toolbar.examples")}>
                {examples.map((e) => (
                  <option key={e.id} value={`ex:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <TBtn
              icon="grid"
              label={t("toolbar.searchAllMaps")}
              text={t("toolbar.allMaps")}
              ghost
              onClick={nav.openSearchAll}
            />
            <span
              className="mm-saved"
              data-state={saveState ?? "saved"}
              // Announce save-state transitions to screen readers — in a local-first app the silent
              // "Couldn't save" path is data loss, so the error state is assertive (the rest polite).
              // aria-live alone makes the span a live region (no role needed — the text is the status).
              aria-live={saveState === "error" ? "assertive" : "polite"}
              title={
                saveState === "error" ? t("toolbar.saveError.title") : t("toolbar.saveOk.title")
              }
            >
              <span className="mm-saved-dot" />{" "}
              {saveState === "saving"
                ? t("toolbar.saving")
                : saveState === "error"
                  ? t("toolbar.saveError.label")
                  : t("toolbar.saveOk.label")}
            </span>
          </>
        )}
        <span className="mm-grow" />
        <TBtn
          icon="search"
          text={isMobile ? undefined : t("toolbar.find")}
          label={t("toolbar.findReplace")}
          ghost
          onClick={nav.openFind}
        />
        {/* Export + More menus — output / overflow group. */}
        <div className="mm-cluster">
          <Menu
            trigger={menuTrigger("export", t("toolbar.trigger.export"), isMobile)}
            triggerTitle={t("toolbar.trigger.export")}
            triggerAriaLabel={isMobile ? t("toolbar.trigger.export") : undefined}
            align="right"
            sheet={isMobile}
          >
            {/* Function-children so the "Last used" row is read fresh each time the menu opens (the
                Menu re-renders on open), not snapshotted into the parent's render. */}
            {() => {
              const last = loadLastExport();
              const lastItem = last
                ? EXPORTS.flatMap((g) => g.items).find(([id]) => id === last)
                : undefined;
              const run = (id: string, fn: () => void) => () => {
                saveLastExport(id);
                fn();
              };
              return (
                <>
                  {/* One-click re-export of the last format used (the common case). */}
                  {lastItem ? (
                    <div>
                      <MenuLabel>{t("toolbar.recent")}</MenuLabel>
                      <MenuItem
                        label={t("toolbar.lastNamed", { name: lastItem[1] })}
                        onSelect={run(lastItem[0], lastItem[2])}
                      />
                      <MenuSeparator />
                    </div>
                  ) : null}
                  {EXPORTS.map((g) => (
                    <div key={g.groupId}>
                      <MenuLabel>{g.group}</MenuLabel>
                      {g.items.map(([id, lbl, fn]) => (
                        <MenuItem key={id} label={lbl} onSelect={run(id, fn)} />
                      ))}
                    </div>
                  ))}
                </>
              );
            }}
          </Menu>
          <Menu
            trigger={menuTrigger("dots", t("toolbar.trigger.more"), isMobile)}
            triggerTitle={t("toolbar.trigger.more")}
            triggerAriaLabel={isMobile ? t("toolbar.trigger.more") : undefined}
            align="right"
            sheet={isMobile}
          >
            {(close) => (
              <>
                <MenuLabel>
                  {io.fileName
                    ? t("toolbar.fileMenuHeadingNamed", {
                        name: `${io.dirty ? "● " : ""}${io.fileName}`,
                      })
                    : t("shortcuts.group.file")}
                </MenuLabel>
                <MenuItem
                  icon={mi("import")}
                  label={t("cmd.open-file")}
                  shortcut={SHORTCUT_BINDINGS["open-file"]}
                  onSelect={() => {
                    io.openFile();
                    close();
                  }}
                />
                <MenuItem
                  icon={mi("export")}
                  label={t("cmd.save-file")}
                  shortcut={SHORTCUT_BINDINGS["save-file"]}
                  onSelect={() => io.saveFile()}
                />
                <MenuItem
                  icon={mi("export")}
                  label={t("toolbar.saveAs")}
                  shortcut={SHORTCUT_BINDINGS["save-file-as"]}
                  onSelect={() => io.saveFileAs()}
                />
                {io.recentFiles.length > 0 ? (
                  <>
                    <MenuLabel>{t("toolbar.openRecent")}</MenuLabel>
                    {io.recentFiles.slice(0, 8).map((f) => (
                      <MenuItem
                        key={f.id}
                        icon={mi("import")}
                        label={f.name}
                        onSelect={() => {
                          io.openRecentFile(f.id);
                          close();
                        }}
                      />
                    ))}
                  </>
                ) : null}
                <MenuSeparator />
                <MenuLabel>{t("toolbar.map")}</MenuLabel>
                <MenuItem
                  icon={mi("present")}
                  label={t("cmd.present")}
                  onSelect={() => map.present()}
                />
                <MenuItem
                  icon={mi("copy")}
                  label={t("cmd.duplicate-map")}
                  onSelect={() => map.duplicateMap()}
                />
                <MenuItem
                  icon={mi("trash")}
                  label={t("cmd.delete-map")}
                  danger
                  onSelect={() => map.deleteCurrent()}
                />
                <MenuSeparator />
                <MenuLabel>{t("toolbar.importBackup")}</MenuLabel>
                <button
                  type="button"
                  role="menuitem"
                  className="mm-menu-item"
                  onClick={() => importInputRef.current?.click()}
                >
                  <EditorIcon name="import" size={15} /> {t("toolbar.importFiles")}
                </button>
                <input
                  ref={importInputRef}
                  id="mmap-input"
                  type="file"
                  accept=".mmst,.mmap,.mmp,.md,.markdown,.json,.opml,.mm,.mmd,.mermaid,.xmind,.smmx,.docx,.xlsx,.itmz,.mind,.mup,.textpack,.textbundle"
                  multiple
                  onChange={(e) => {
                    io.handleFile(e);
                    close();
                  }}
                  style={{ display: "none" }}
                />
                <MenuItem
                  icon={mi("paste")}
                  label={t("cmd.paste-topics")}
                  onSelect={() => nav.openPaste()}
                />
                <MenuItem
                  icon={mi("copy")}
                  label={t("cmd.copy-outline")}
                  onSelect={() => io.copyOutline()}
                />
                <MenuItem
                  icon={mi("copy")}
                  label={t("cmd.copy-table")}
                  onSelect={() => io.copyTable()}
                />
                <MenuItem
                  icon={mi("link")}
                  label={t("cmd.copy-deep-link.topic")}
                  onSelect={() => io.copyDeepLink()}
                />
                <MenuItem
                  icon={mi("export")}
                  label={t("cmd.backup")}
                  onSelect={() => io.exportLibrary()}
                />
                <MenuSeparator />
                <MenuItem
                  icon={mi("settings")}
                  label={t("cmd.settings")}
                  onSelect={() => nav.openSettings()}
                />
                <MenuItem
                  icon={mi("help")}
                  label={t("cmd.shortcuts")}
                  onSelect={() => nav.openShortcuts()}
                />
                <MenuItem
                  icon={mi("help")}
                  label={t("cmd.about")}
                  onSelect={() => nav.openAbout()}
                />
              </>
            )}
          </Menu>
        </div>
      </div>

      {/* ── Row 2 — view / edit / canvas ── */}
      <div className={`mm-topbar-row mm-topbar-row2${isMobile ? "" : " mm-wrap"}`}>
        <Menu
          trigger={menuTrigger("layers", t("toolbar.trigger.panels"), isMobile)}
          triggerTitle={t("toolbar.trigger.panels")}
          triggerAriaLabel={isMobile ? t("toolbar.trigger.panels") : undefined}
          sheet={isMobile}
        >
          {/* Grouped into Structure / Analysis / Workflow so 12 flat toggles read as three short lists,
              and the duplicate leading icons (layers ×2, grid ×2, note ×2) are de-collided to distinct
              glyphs within the menu. */}
          <MenuLabel>{t("toolbar.structure")}</MenuLabel>
          <MenuCheckboxItem
            icon={mi("text")}
            label={PANEL_LABELS.outline.menu}
            checked={panels.outlineOpen}
            trailing={mi("check")}
            onSelect={() => panels.setOutlineOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("layers")}
            label={PANEL_LABELS.maps.menu}
            checked={panels.mapsOpen}
            trailing={mi("check")}
            onSelect={() => panels.setMapsOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("settings")}
            label={PANEL_LABELS.info.menu}
            checked={panels.infoOpen || panels.infoMinimized}
            trailing={mi("check")}
            onSelect={() => {
              // One clean toggle: if shown (panel OR minimized strip) close both; else open.
              const shown = panels.infoOpen || panels.infoMinimized;
              panels.setInfoMinimized(() => false);
              panels.setInfoOpen(() => !shown);
            }}
          />
          <MenuCheckboxItem
            icon={mi("note")}
            label={PANEL_LABELS.note.menu}
            checked={panels.noteEditorOpen}
            trailing={mi("check")}
            onSelect={() => panels.setNoteEditorOpen((v) => !v)}
          />
          <MenuLabel>{t("toolbar.analysis")}</MenuLabel>
          <MenuCheckboxItem
            icon={mi("star")}
            label={PANEL_LABELS.index.menu}
            checked={panels.indexOpen}
            trailing={mi("check")}
            onSelect={() => panels.setIndexOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("filter")}
            label={PANEL_LABELS.filter.menu}
            checked={panels.filterOpen}
            trailing={mi("check")}
            onSelect={panels.toggleFilter}
          />
          <MenuCheckboxItem
            icon={mi("palette")}
            label={PANEL_LABELS.styles.menu}
            checked={panels.stylesOpen}
            trailing={mi("check")}
            onSelect={() => panels.setStylesOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("link")}
            label={PANEL_LABELS.relationships.menu}
            checked={panels.relationshipsOpen}
            trailing={mi("check")}
            onSelect={() => panels.setRelationshipsOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("grid")}
            label={PANEL_LABELS.stats.menu}
            checked={panels.statsOpen}
            trailing={mi("check")}
            onSelect={() => panels.setStatsOpen((v) => !v)}
          />
          <MenuLabel>{t("toolbar.workflow")}</MenuLabel>
          <MenuCheckboxItem
            icon={mi("history")}
            label={PANEL_LABELS.history.menu}
            checked={panels.historyOpen}
            trailing={mi("check")}
            onSelect={() => panels.setHistoryOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("calendar")}
            label={PANEL_LABELS.agenda.menu}
            checked={panels.agendaOpen}
            trailing={mi("check")}
            onSelect={() => panels.setAgendaOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("paste")}
            label={PANEL_LABELS.inbox.menu}
            checked={panels.inboxOpen}
            trailing={mi("check")}
            onSelect={() => panels.setInboxOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("board")}
            label={t("toolbar.boardKanban")}
            checked={panels.boardOpen}
            trailing={mi("check")}
            onSelect={() => panels.setBoardOpen((v) => !v)}
          />
          <MenuCheckboxItem
            icon={mi("present")}
            label={PANEL_LABELS.deck.menu}
            checked={panels.deckEditorOpen}
            trailing={mi("check")}
            onSelect={() => panels.setDeckEditorOpen((v) => !v)}
          />
        </Menu>
        <span className="mm-vdiv" />
        {/* View menu — fit / collapse / expand / focus folded into one labelled dropdown so the bar
            reads clearly instead of four ambiguous icons (#4). Mirrored 1:1 in ⌘K (kind "view"). */}
        <Menu
          trigger={menuTrigger("fit", t("common.view"), isMobile)}
          triggerTitle={t("toolbar.trigger.viewActions")}
          triggerAriaLabel={isMobile ? t("common.view") : undefined}
          sheet={isMobile}
        >
          <MenuItem icon={mi("fit")} label={t("cmd.fit")} onSelect={() => m()?.fit()} />
          <MenuItem
            icon={mi("balance")}
            label={t("cmd.balance-map")}
            disabled={canvas.layout !== "side" || !!liveDoc.meta?.freeform}
            title={
              canvas.layout === "side" && !liveDoc.meta?.freeform
                ? t("toolbar.balanceEnabled")
                : t("toolbar.balanceDisabled")
            }
            onSelect={() => m()?.balanceMap()}
          />
          <MenuItem
            icon={mi("minus")}
            label={t("cmd.collapse-all")}
            onSelect={() => m()?.setAllExpanded(false)}
          />
          <MenuItem
            icon={mi("plus")}
            label={t("cmd.expand-all")}
            onSelect={() => m()?.setAllExpanded(true)}
          />
          <MenuLabel>{t("toolbar.detailLevel")}</MenuLabel>
          {[1, 2, 3, 4, 5].map((n) => (
            <MenuItem
              key={n}
              icon={mi("layers")}
              label={t("toolbar.showLevel", { n })}
              onSelect={() => m()?.setExpandedToLevel(n)}
            />
          ))}
          <MenuItem
            icon={mi("balance")}
            label={t("cmd.focus-branch")}
            disabled={!canvas.selected}
            onSelect={() =>
              canvas.selected &&
              canvas.setFocus({ id: canvas.selected.id, topic: canvas.selected.topic })
            }
          />
          <MenuItem
            icon={mi("layers")}
            label={t("cmd.drill-in")}
            disabled={!canvas.selected}
            onSelect={() => canvas.drillIn()}
          />
          <MenuItem
            icon={mi("layers")}
            label={t("cmd.isolate-branch")}
            disabled={!canvas.selected}
            title={canvas.selected ? undefined : t("toolbar.isolateDisabled")}
            onSelect={() => {
              const ok = canvas.selected?.id ? m()?.isolateBranch(canvas.selected.id) : false;
              showHint(ok ? t("hint.branchIsolated") : t("hint.selectTopicInBranch"));
            }}
          />
          <MenuItem
            icon={mi("present")}
            label={t("toolbar.guidedWalk")}
            onSelect={() => canvas.startWalk()}
          />
          <MenuLabel>{t("toolbar.format")}</MenuLabel>
          <MenuItem
            icon={mi("copy")}
            label={t("cmd.copy-format")}
            disabled={!canvas.selected}
            onSelect={() => canvas.copyFormat()}
          />
          <MenuItem
            icon={mi("paste")}
            label={t("cmd.paste-format")}
            disabled={!canvas.selected || !canvas.canPasteFormat}
            onSelect={() => canvas.pasteFormat()}
          />
          <MenuItem
            icon={mi("palette")}
            label={t("cmd.auto-colour-branches")}
            onSelect={() => canvas.shuffleBranchColors()}
          />
          {/* Arrange tools only apply in free-canvas mode — hide the whole group otherwise instead of
              showing a block of greyed-out rows the user has to scroll past. */}
          {canvas.freeform ? (
            <>
              <MenuLabel>{t("toolbar.arrangeFreeLayout")}</MenuLabel>
              {(
                [
                  ["left", t("cmd.align.left")],
                  ["hcenter", t("cmd.align.hcenter")],
                  ["right", t("cmd.align.right")],
                  ["top", t("cmd.align.top")],
                  ["vmiddle", t("cmd.align.vmiddle")],
                  ["bottom", t("cmd.align.bottom")],
                ] as const
              ).map(([mode, label]) => (
                <MenuItem
                  key={mode}
                  label={label}
                  disabled={canvas.selectedCount < 2}
                  onSelect={() => canvas.alignSelection(mode)}
                />
              ))}
              <MenuItem
                label={t("cmd.distribute-h")}
                disabled={canvas.selectedCount < 3}
                onSelect={() => canvas.distributeSelection("h")}
              />
              <MenuItem
                label={t("cmd.distribute-v")}
                disabled={canvas.selectedCount < 3}
                onSelect={() => canvas.distributeSelection("v")}
              />
            </>
          ) : null}
          {/* Display toggles — labelled here (moved out of the cramped, non-mnemonic Row-2 icon strip).
              Desktop only: on a phone these live in the dedicated Options overflow menu instead. */}
          {isMobile ? null : (
            <>
              <MenuLabel>{t("toolbar.display")}</MenuLabel>
              <MenuCheckboxItem
                label={t("toolbar.outlineNumbering")}
                checked={panels.numbered}
                onSelect={() => panels.setNumbered((v) => !v)}
              />
              {panels.numbered ? (
                <MenuItem
                  label={
                    liveDoc.meta?.numberStyle === "outline"
                      ? t("toolbar.numberingStyle.outline")
                      : t("toolbar.numberingStyle.decimal")
                  }
                  onSelect={() =>
                    m()?.setNumberStyle(
                      liveDoc.meta?.numberStyle === "outline" ? "decimal" : "outline",
                    )
                  }
                />
              ) : null}
              <MenuCheckboxItem
                label={t("toolbar.lineJumps")}
                checked={!!liveDoc.meta?.lineJumps}
                onSelect={() => m()?.setLineJumps(!liveDoc.meta?.lineJumps)}
              />
              <MenuCheckboxItem
                label={t("toolbar.legend")}
                checked={!!liveDoc.meta?.legend}
                onSelect={() => m()?.setLegend(!liveDoc.meta?.legend)}
              />
              <MenuCheckboxItem
                label={t("toolbar.spellCheck")}
                checked={panels.spellcheck}
                onSelect={() => panels.setSpellcheck((v) => !v)}
              />
            </>
          )}
          <MenuLabel>{t("toolbar.savedViews")}</MenuLabel>
          <MenuItem
            icon={mi("star")}
            label={t("toolbar.saveCurrentView")}
            onSelect={() => views.onSave()}
          />
          {views.list.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button
                type="button"
                className="mm-menu-item"
                style={{ flex: 1 }}
                onClick={() => views.onApply(v.id)}
              >
                {mi("fit")}
                {v.name}
              </button>
              <button
                type="button"
                className="mm-menu-item"
                aria-label={t("toolbar.deleteView", { name: v.name })}
                title={t("toolbar.deleteView", { name: v.name })}
                style={{ flex: "0 0 auto" }}
                onClick={() => views.onDelete(v.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </Menu>
        {/* The view-only display toggles (numbering / line-jumps / legend / spell-check) used to be a
            row of non-mnemonic icon buttons here; they now live as labelled checkboxes in the View menu
            (desktop) and the Options menu (mobile), keeping Row 2 from overflowing. */}
        <span className="mm-vdiv" />
        {/* Insert + Canvas menus — content/styling group. */}
        <div className="mm-cluster">
          <Menu
            trigger={menuTrigger("plus", t("toolbar.trigger.insert"), isMobile)}
            triggerClassName="mm-tbtn mm-tbtn-accent"
            triggerTitle={t("toolbar.trigger.insert")}
            triggerAriaLabel={isMobile ? t("toolbar.trigger.insert") : undefined}
            sheet={isMobile}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={mi("note")}
                  label={t("toolbar.stickyNote")}
                  onSelect={() => {
                    m()?.addStickyNote(loadStickyColor());
                    showHint(t("hint.stickyAdded"));
                  }}
                />
                {/* Colour set (item 17): pick a colour to add a note of that colour AND remember it as
                    the default for the plain "Sticky note" item above. */}
                <div className="mm-menu-row" style={{ padding: "2px 10px 4px" }}>
                  {(
                    Object.entries(STICKY_NOTE_COLORS) as [
                      keyof typeof STICKY_NOTE_COLORS,
                      { background: string; border: string },
                    ][]
                  ).map(([name, sw]) => (
                    <button
                      key={name}
                      type="button"
                      className="mm-menu-chip"
                      aria-label={t("toolbar.stickyNoteNamed", { colour: name })}
                      title={t("toolbar.addStickyNote", { colour: name })}
                      onClick={() => {
                        saveStickyColor(name);
                        m()?.addStickyNote(name);
                        // Capitalising the colour is done here rather than in the message because the
                        // message decides where the word goes; a locale that never sentence-cases a
                        // colour just leaves the placeholder mid-sentence.
                        showHint(
                          t("hint.stickyColourAdded", {
                            colour: `${name[0].toUpperCase()}${name.slice(1)}`,
                          }),
                        );
                        close();
                      }}
                      style={{
                        width: 18,
                        height: 18,
                        padding: 0,
                        borderRadius: 4,
                        background: sw.background,
                        border: sw.border,
                      }}
                    />
                  ))}
                </div>
                <MenuItem
                  icon={mi("layers")}
                  label={t("cmd.insert-group")}
                  disabled={!canvas.selected}
                  title={canvas.selected ? undefined : t("toolbar.groupBranchDisabled")}
                  onSelect={() => {
                    const id = canvas.selected?.id;
                    const ok = id ? m()?.groupBranch(id) : false;
                    showHint(ok ? t("hint.branchGrouped") : t("hint.selectNodeToGroup"));
                  }}
                />
                <MenuItem
                  icon={mi("layers")}
                  label={t("cmd.insert-group-selection")}
                  disabled={canvas.selectedCount < 2}
                  title={canvas.selectedCount < 2 ? t("toolbar.groupSelectionDisabled") : undefined}
                  onSelect={() => {
                    const ok = m()?.groupSelection();
                    showHint(ok ? t("hint.selectionGrouped") : t("hint.selectTwoTopics"));
                  }}
                />
                <MenuItem
                  icon={mi("balance")}
                  label={t("cmd.insert-summary")}
                  disabled={!canvas.selected}
                  title={canvas.selected ? undefined : t("toolbar.summaryDisabled")}
                  onSelect={() => {
                    const id = canvas.selected?.id;
                    const ok = id ? m()?.groupSummary(id) : false;
                    showHint(ok ? t("hint.summaryAdded") : t("hint.selectNodeToSummarise"));
                  }}
                />
                <button
                  type="button"
                  role="menuitem"
                  className="mm-menu-item"
                  onClick={() => nodeImageInputRef.current?.click()}
                >
                  <EditorIcon name="image" size={15} /> {t("toolbar.imageOnSelectedNode")}
                </button>
                <input
                  ref={nodeImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    canvas.handleImage(e);
                    close();
                  }}
                  style={{ display: "none" }}
                />
                <MenuSeparator />
                <MenuSub icon={mi("plus")} label={t("toolbar.mapParts")}>
                  <MenuLabel>{t("toolbar.mapPartInsertUnderSelected")}</MenuLabel>
                  {MAP_PARTS.map((p) => (
                    <MenuItem
                      key={p.id}
                      icon={mi("plus")}
                      label={p.name}
                      disabled={!canvas.selected}
                      title={canvas.selected ? undefined : t("toolbar.insertUnderDisabled")}
                      onSelect={() => {
                        const part = buildMapPart(p.id);
                        const ok = part ? m()?.addSubtreeToSelected(part) : false;
                        showHint(
                          ok
                            ? t("hint.mapPartInserted", { name: p.name })
                            : t("hint.selectTopicFirst"),
                        );
                      }}
                    />
                  ))}
                </MenuSub>
                <MenuSub icon={mi("plus")} label={t("toolbar.templates")}>
                  <MenuLabel>{t("toolbar.templateInsertStructureUnderSelected")}</MenuLabel>
                  {/* `tpl`, not `t` — the loop variable shadowed the translation function, so `t("…")`
                      could not be called anywhere inside this item. */}
                  {insertableTemplates.map((tpl) => (
                    <MenuItem
                      key={tpl.id}
                      icon={mi("plus")}
                      label={tpl.name}
                      disabled={!canvas.selected}
                      title={canvas.selected ? undefined : t("toolbar.insertUnderDisabled")}
                      onSelect={() => {
                        const ok = m()?.addSubtreeToSelected(templateSubtree(tpl.id)) ?? false;
                        showHint(
                          ok
                            ? t("hint.structureInserted", { name: tpl.name })
                            : t("hint.selectTopicFirst"),
                        );
                      }}
                    />
                  ))}
                </MenuSub>
                <MenuSub icon={mi("plus")} label={t("toolbar.shapes")}>
                  <MenuLabel>{t("toolbar.backgroundShapeFreeCanvas")}</MenuLabel>
                  {SHAPE_ITEMS.map((s) => (
                    <MenuItem
                      key={s.kind}
                      icon={mi("plus")}
                      label={s.name}
                      onSelect={() => {
                        m()?.addShape(s.kind);
                        showHint(t("hint.shapeAdded", { shape: s.name.toLowerCase() }));
                      }}
                    />
                  ))}
                </MenuSub>
                <MenuSeparator />
                <MenuLabel>{t("toolbar.rollUpMirrorAnotherMap")}</MenuLabel>
                <div style={{ padding: "2px 6px" }}>
                  <select
                    className="mm-select"
                    style={{ width: "100%" }}
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const ok = canvas.selected?.id
                        ? m()?.setSelectedRollup(v === "none" ? "" : v)
                        : false;
                      showHint(
                        !ok
                          ? t("hint.selectNodeToBindRollup")
                          : v === "none"
                            ? t("hint.rollupUnbound")
                            : t("hint.rollupBound"),
                      );
                      close();
                    }}
                    aria-label={t("toolbar.bindRollUpSource")}
                  >
                    <option value="">{t("toolbar.bindSourceMap")}</option>
                    {map.maps
                      .filter((mm) => mm.id !== liveDoc.id)
                      .map((mm) => (
                        <option key={mm.id} value={mm.id}>
                          {mm.title || t("common.untitled")}
                        </option>
                      ))}
                    <option value="none">{t("toolbar.unbind")}</option>
                  </select>
                </div>
                <MenuItem
                  icon={mi("history")}
                  label={t("cmd.refresh-rollups")}
                  onSelect={() => map.refreshRollupsNow()}
                />
              </>
            )}
          </Menu>
          <Menu
            trigger={menuTrigger("palette", t("toolbar.trigger.canvas"), isMobile)}
            triggerTitle={t("toolbar.trigger.canvas")}
            triggerAriaLabel={isMobile ? t("toolbar.trigger.canvas") : undefined}
            sheet={isMobile}
          >
            {(close) => (
              <>
                <MenuCheckboxItem
                  icon={mi("hand")}
                  label={t("toolbar.freeLayout")}
                  checked={!!liveDoc.meta?.freeform}
                  trailing={mi("check")}
                  onSelect={() => m()?.setFreeform(!liveDoc.meta?.freeform)}
                />
                <MenuSeparator />
                {/* Persistent styling (theme · layout · design presets · background · connectors ·
                    branch weight · fonts · backdrop) all live in the Map panel — one home instead of
                    being split across this menu, Settings, and the panel (T5, T3-25). This opens it. */}
                <MenuItem
                  icon={mi("palette")}
                  label={t("toolbar.themeAndDesign")}
                  title={t("toolbar.openTheMapPanelTo")}
                  onSelect={() => {
                    canvas.openMapPanel();
                    close();
                  }}
                />
              </>
            )}
          </Menu>
        </div>
        {/* Phone overflow: the view toggles + Layout that sit inline on desktop live here so the
            narrow bar keeps Panels / View / Insert / Canvas reachable. Quick-add + Timer are omitted
            on phone (an input + a widget don't fit a menu, and both are low-value on a small screen). */}
        {isMobile ? (
          <Menu
            trigger={menuTrigger("settings", "Options", true)}
            triggerTitle={t("toolbar.trigger.viewOptions")}
            triggerAriaLabel={t("toolbar.trigger.optionsAria")}
            sheet
          >
            <MenuLabel>{t("common.view")}</MenuLabel>
            <MenuCheckboxItem
              icon={mi("check")}
              label={t("toolbar.outlineNumbering")}
              checked={panels.numbered}
              trailing={mi("check")}
              onSelect={() => panels.setNumbered((v) => !v)}
            />
            {panels.numbered ? (
              <MenuCheckboxItem
                icon={mi("layers")}
                label={
                  liveDoc.meta?.numberStyle === "outline"
                    ? t("toolbar.numbering.outline")
                    : t("toolbar.numbering.decimal")
                }
                checked={liveDoc.meta?.numberStyle === "outline"}
                trailing={mi("check")}
                onSelect={() =>
                  m()?.setNumberStyle(
                    liveDoc.meta?.numberStyle === "outline" ? "decimal" : "outline",
                  )
                }
              />
            ) : null}
            <MenuCheckboxItem
              icon={mi("link")}
              label={t("toolbar.lineJumps")}
              checked={!!liveDoc.meta?.lineJumps}
              trailing={mi("check")}
              onSelect={() => m()?.setLineJumps(!liveDoc.meta?.lineJumps)}
            />
            <MenuCheckboxItem
              icon={mi("layers")}
              label={t("toolbar.legend")}
              checked={!!liveDoc.meta?.legend}
              trailing={mi("check")}
              onSelect={() => m()?.setLegend(!liveDoc.meta?.legend)}
            />
            <MenuCheckboxItem
              icon={mi("text")}
              label={t("toolbar.spellCheck")}
              checked={panels.spellcheck}
              trailing={mi("check")}
              onSelect={() => panels.setSpellcheck((v) => !v)}
            />
            <MenuSeparator />
            <MenuLabel>{t("toolbar.layout")}</MenuLabel>
            <div style={{ padding: "2px 6px" }}>
              <select
                className="mm-select"
                style={{ width: "100%" }}
                value={canvas.layout}
                onChange={(e) => canvas.changeLayout(e.target.value as LayoutKind)}
                aria-label={t("toolbar.layout")}
                disabled={!!liveDoc.meta?.freeform}
              >
                <optgroup label={t("toolbar.layoutGroupRadial")}>
                  <option value="side">{t("cmd.layout.side")}</option>
                  <option value="right">{t("cmd.layout.right")}</option>
                  <option value="left">{t("cmd.layout.left")}</option>
                  <option value="radial">{t("cmd.layout.radial")}</option>
                </optgroup>
                <optgroup label={t("toolbar.layoutGroupTree")}>
                  <option value="org-down">{t("toolbar.orgChart")}</option>
                  <option value="org-up">{t("toolbar.orgChart2")}</option>
                </optgroup>
                <optgroup label={t("toolbar.layoutGroupDiagram")}>
                  <option value="timeline">{t("cmd.layout.timeline")}</option>
                  <option value="fishbone">{t("cmd.layout.fishbone")}</option>
                  <option value="grid">{t("cmd.layout.grid")}</option>
                  <option value="swimlane">{t("cmd.layout.swimlane")}</option>
                  <option value="brace">{t("cmd.layout.brace")}</option>
                </optgroup>
              </select>
            </div>
          </Menu>
        ) : null}
        <span className="mm-grow" />
        {isMobile ? null : (
          <>
            <span className="mm-eyebrow">{t("toolbar.layout")}</span>
            <select
              className="mm-select"
              value={canvas.layout}
              onChange={(e) => canvas.changeLayout(e.target.value as LayoutKind)}
              aria-label={t("toolbar.layout")}
              title={liveDoc.meta?.freeform ? t("toolbar.layoutPaused") : t("toolbar.layout")}
              disabled={!!liveDoc.meta?.freeform}
            >
              <optgroup label={t("toolbar.layoutGroupRadial")}>
                <option value="side">{t("cmd.layout.side")}</option>
                <option value="right">{t("cmd.layout.right")}</option>
                <option value="left">{t("cmd.layout.left")}</option>
                <option value="radial">{t("cmd.layout.radial")}</option>
              </optgroup>
              <optgroup label={t("toolbar.layoutGroupTree")}>
                <option value="org-down">{t("toolbar.orgChart")}</option>
                <option value="org-up">{t("toolbar.orgChart2")}</option>
              </optgroup>
              <optgroup label={t("toolbar.layoutGroupDiagram")}>
                <option value="timeline">{t("cmd.layout.timeline")}</option>
                <option value="fishbone">{t("cmd.layout.fishbone")}</option>
                <option value="grid">{t("cmd.layout.grid")}</option>
                <option value="swimlane">{t("cmd.layout.swimlane")}</option>
                <option value="brace">{t("cmd.layout.brace")}</option>
              </optgroup>
            </select>
            <span className="mm-vdiv" />
            <input
              className="mm-input"
              placeholder={t("toolbar.quickAdd")}
              aria-label={t("toolbar.quickAddTopic")}
              title={t("toolbar.typeATopicAndPress")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = e.currentTarget.value.trim();
                  if (v) {
                    m()?.quickAdd(v);
                    e.currentTarget.value = "";
                  }
                }
              }}
              style={{ width: 130 }}
            />
            <BrainstormTimer />
          </>
        )}
      </div>
    </header>
  );
}
