import {
  type CSSProperties,
  type ChangeEvent,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Kanban } from "./Kanban";
import {
  AgendaPanel,
  FilterPanel,
  HistoryPanel,
  InboxPanel,
  InfoPanel,
  MapsPanel,
  MarkerTagIndex,
  NoteEditorPanel,
  OutlinePanel,
  PlaybackBar,
  RelationshipsPanel,
  SlideDeckEditorPanel,
  StatsPanel,
  StylesPanel,
  WalkBar,
} from "./Panels";
import { Breadcrumb, type Crumb } from "./components/Breadcrumb";
import { CommandPalette, clearRecents } from "./components/CommandPalette";
import { Dialog } from "./components/Dialog";
import { DocumentTabs } from "./components/DocumentTabs";
import { EdgeInspector } from "./components/EdgeInspector";
import { FindReplaceOverlay } from "./components/FindReplaceOverlay";
import { FirstRunCard } from "./components/FirstRunCard";
import { IconRail } from "./components/IconRail";
import { InspectorRail } from "./components/InspectorRail";
import { MapPanel } from "./components/MapPanel";
import { MobileSheetScrim } from "./components/MobileSheetScrim";
import { OverlayInspector } from "./components/OverlayInspector";
import { type DockEntry, PanelDock } from "./components/PanelDock";
import { SearchResults } from "./components/SearchResults";
import { ToastBar } from "./components/ToastBar";
import { Toolbar, type ToolbarProps } from "./components/Toolbar";
import { buildEditorCommands } from "./components/editorCommands";
import { DialogHost, editorConfirm, editorPrompt } from "./components/editorDialogs";
import { PANEL_LABELS } from "./panelLabels";
import "./design/editor.css";
import { useCliBridge } from "./agent/useCliBridge";
import { editorThemeVars } from "./design/tokens";
import { designById } from "./designs";
import { type FilterCriteria, filterResult, filterToDoc, focusSet, isFilterActive } from "./filter";
import { clampIndex, togglePlay } from "./historyPlayback";
import { useClipboardImagePaste } from "./hooks/useClipboardImagePaste";
import { useCommandPaletteHotkey } from "./hooks/useCommandPaletteHotkey";
import { useDiskFile } from "./hooks/useDiskFile";
import { useFocusHotkey } from "./hooks/useFocusHotkey";
import { useFormatPainter } from "./hooks/useFormatPainter";
import { useGuidedWalk } from "./hooks/useGuidedWalk";
import { useIdbAutosave } from "./hooks/useIdbAutosave";
import { useInbox } from "./hooks/useInbox";
import { useNamedStyles } from "./hooks/useNamedStyles";
import { useNoteEditor } from "./hooks/useNoteEditor";
import { useOpenDocuments } from "./hooks/useOpenDocuments";
import { usePanels } from "./hooks/usePanels";
import { usePasteOutline } from "./hooks/usePasteOutline";
import { useSheetDrag } from "./hooks/useSheetDrag";
import { useToast } from "./hooks/useToast";
import { useVersionHistory } from "./hooks/useVersionHistory";
import { t } from "./i18n";
import { tNodes } from "./i18n/nodes";
import { MARKER_PALETTE } from "./icons";
import { fileToAttachment } from "./io/attachment";
import { downloadBlob } from "./io/download";
import { isNativeExt, readMapFromHandle } from "./io/fileSystem";
import { fileToMapImage } from "./io/image";
import { parseImport } from "./io/importDispatch";
import { parseLibraryFolders, serializeLibrary, tryParseLibrary } from "./io/library";
import { toMarkdown } from "./io/markdown";
import { mapToTsv } from "./io/tableExport";
import { resolveInitialLayout } from "./layoutPreference";
import {
  type CanvasSession,
  type LayoutKind,
  MAP_LINK_PREFIX,
  MindMap,
  type MindMapHandle,
  NODE_LINK_PREFIX,
  type SelectedEdge,
  type SelectedNode,
  type SelectedOverlay,
  type SelectionFields,
  type SelectionMarkerTags,
  classifyLink,
} from "./mindmap";
import { findAnyNode, newMapFromBranch } from "./mindmap/flow/ops";
import { anyMobileSheetOpen, closeMobileSheets } from "./mobileSheets";
import { sampleDoc } from "./model/sampleMap";
import type { MapNode, MindMapDoc } from "./model/types";
import { NavHistory, type NavPoint } from "./navHistory";
import {
  backlinksFor,
  crossMapBacklinksFor,
  markerTagIndex,
  outgoingLinksFor,
  outlineNumbers,
  outlineRows,
} from "./outline";
import { deckRows, hasCustomDeck } from "./present/slides";
import { checkForUpdate, initPwaUpdateToast } from "./pwa/pwaUpdate";
import { refreshRollups } from "./rollup";
import { useSavedViews } from "./savedViews";
import { type LibraryHit, findDocMatches, searchLibrary } from "./search";
import { selectionCrumbs, selectionInfo } from "./selectionInfo";
import { stickerImage } from "./stickers";
import { clearBranch } from "./store/branchClipboard";
import { clearAllLocalPreferences } from "./store/localPrefs";
import {
  type MapSummary,
  type RecentFile,
  clearAllData,
  findMapReferences,
  getAllMaps,
  getFolders,
  getTabSession,
  listMaps,
  listRecentFiles,
  loadMap,
  loadMapHandle,
  restoreMapFromTrash,
  saveFolders,
  saveMap,
  setLastOpened,
  softDeleteMap,
} from "./store/mapStore";
import {
  type SettingsFile,
  applySettings,
  collectSettings,
  parseSettingsFile,
  serializeSettings,
  settingsKeysIn,
} from "./store/settingsFile";
import { useTabPresence } from "./store/tabCoordination";
import { setTagColor, tagColor } from "./tagColors";
import { todayISO } from "./taskDate";
import { buildTemplate } from "./templates";
import { controlStyle, inputStyle, timeAgo } from "./ui";
import { resolveChromeDark, useAppearance } from "./useAppearance";
import { useFind } from "./useFind";
import { useHighContrast } from "./useHighContrast";
import { useIsMobile } from "./useIsMobile";
import { useMapExports } from "./useMapExports";
import { useReducedMotion } from "./useReducedMotion";
import { useTheme } from "./useTheme";

// DEV-only verification hooks the headless render harness reads off `window` (set in a DEV effect below).
// Declared here so the effect can assign them without an `as unknown as` cast on `window`.
declare global {
  interface Window {
    __getLiveDoc?: () => MindMapDoc;
    __exportSvg?: (rootId?: string) => Promise<string> | null;
  }
}

// Lazy-loaded so they never sit in the entry bundle (the size-budget gates the entry chunk only),
// matching the canvas's own code-split idiom (src/mindmap/index.tsx). The Start screen is shown only
// on a fresh boot with no open document — an async decision, so deferring its chunk is invisible to the
// common (returning-user) path; the Presentation deck loads only when the user clicks Present.
const StartScreen = lazy(() =>
  import("./components/start/StartScreen").then((m) => ({ default: m.StartScreen })),
);
const Presentation = lazy(() =>
  import("./present/Presentation").then((m) => ({ default: m.Presentation })),
);
// On-demand: only mounted (and its chunk fetched) when a branch export is chosen — keeps it out of the
// entry bundle (B4).
const BranchExportDialog = lazy(() =>
  import("./components/BranchExportDialog").then((m) => ({ default: m.BranchExportDialog })),
);
// On-demand: the theme designer only loads when opened, keeping its editor UI out of the entry (C3).
const ThemeDesignerDialog = lazy(() =>
  import("./components/ThemeDesignerDialog").then((m) => ({ default: m.ThemeDesignerDialog })),
);
const SettingsDialog = lazy(() =>
  import("./components/SettingsDialog").then((m) => ({ default: m.SettingsDialog })),
);
const ShortcutsDialog = lazy(() =>
  import("./components/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog })),
);
const AltShortcutOverlay = lazy(() =>
  import("./components/AltShortcutOverlay").then((m) => ({ default: m.AltShortcutOverlay })),
);
const InstallButton = lazy(() =>
  import("./components/InstallButton").then((m) => ({ default: m.InstallButton })),
);

// How many recently-used document tabs keep their canvas session (viewport + undo/redo) cached for
// lossless switching; beyond this the least-recently-used session is dropped (that tab reopens fresh).
const MAX_SESSIONS = 5;
// Cap the cached undo depth per tab so several tabs' histories don't balloon memory — the live canvas
// keeps the full depth; only the stashed copy is trimmed.
const CACHED_UNDO_DEPTH = 40;

// Shared chrome for the dismissible import banners (× close + "Show all" toggle). Inherit the banner's
// own colour so they read as part of the alert/notes strip rather than separate controls.
const bannerDismissStyle: CSSProperties = {
  flexShrink: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: "0 2px",
  opacity: 0.7,
};
const bannerLinkStyle: CSSProperties = {
  flexShrink: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 12,
  textDecoration: "underline",
  padding: 0,
};

export function App() {
  const [doc, setDoc] = useState<MindMapDoc>(sampleDoc);
  // A reactive mirror of the live doc for panels (Outline) — `doc` is only the
  // init prop for MindMap (changes on load), so edits update this without re-init.
  const [liveDoc, setLiveDoc] = useState<MindMapDoc>(sampleDoc);
  const liveDocRef = useRef<MindMapDoc>(sampleDoc);
  // The active map's linked file name (drives the title bar + File menu); null when it's library-only.
  const [fileName, setFileName] = useState<string | null>(null);
  // True when the linked file is behind the in-memory edits (the IndexedDB copy is always current; this
  // tracks only the disk file, gating the title-bar ● marker and the unsaved-changes unload guard).
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const mapRef = useRef<MindMapHandle>(null);
  // Per-tab canvas sessions (viewport + undo/redo), captured on switch-away and restored on switch-back
  // so the recently-used tabs are lossless. An LRU Map capped at MAX_SESSIONS; one-shot on restore.
  const sessionCache = useRef<Map<string, CanvasSession>>(new Map());
  // Flips true once the boot effect has decided the initial map/view, so the URL ?map= sync doesn't
  // write the pre-boot sampleDoc placeholder before boot has read the deep-link.
  const booted = useRef(false);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  // Start screen vs editor. Default to the editor so a returning user's last map restores without a
  // flash; the boot effect flips to "start" only when there's no map to restore (first run / empty
  // library). The "⌂ Start" toolbar button returns here any time. The editor canvas is unchanged.
  const [view, setView] = useState<"start" | "editor">("editor");
  // Phone-width: the editor toolbar switches to a compact single horizontally-scrollable strip
  // (the desktop layout wraps into a wall of rows on a narrow screen, burying the canvas).
  const isMobile = useIsMobile();
  const [warnings, setWarnings] = useState<string[]>([]);
  // The import-warnings banner collapses to the first note + "(+N more)"; this reveals the full list.
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentDoc, setPresentDoc] = useState<MindMapDoc | null>(null);
  // Transient toast: a message + an optional action button (e.g. "Refresh now") — owned by useToast.
  const { toast, showToast, showHint, dismiss: dismissToast } = useToast();
  const { theme, setThemeId, customThemes, reloadCustomThemes } = useTheme();
  // The custom-theme designer (C3), opened from the Map panel's Theme dropdown ("Manage themes…").
  const [themeDesignerOpen, setThemeDesignerOpen] = useState(false);
  // App-wide chrome appearance (Phase 8) — independent of the canvas theme. Resolves to a single
  // light/dark for all chrome surfaces; a dark canvas theme also darkens the chrome under "system".
  const { appearance, setAppearance, prefersDark } = useAppearance();
  const { motionPref, setMotionPref, reducedMotion } = useReducedMotion();
  const { contrastPref, setContrastPref, highContrast } = useHighContrast();
  const chromeDark = resolveChromeDark(appearance, prefersDark, theme.theme.type === "dark");
  // Mirror the resolved appearance onto <html> so native UI (scrollbars, form controls) + any
  // selector-based CSS can react, and the body backdrop behind the app matches.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = chromeDark ? "dark" : "light";
    root.style.colorScheme = chromeDark ? "dark" : "light";
  }, [chromeDark]);
  const [layout, setLayout] = useState<LayoutKind>(() => {
    // A ?layout= query param wins (shareable layout links), then the persisted choice. A fresh or
    // reset profile grows every branch to the right by default.
    return resolveInitialLayout(window.location.search, () =>
      localStorage.getItem("mindmap-layout"),
    );
  });
  const {
    query,
    setQuery,
    replaceWith,
    setReplaceWith,
    replaceScope,
    setReplaceScope,
    useRegex,
    setUseRegex,
    matchCase,
    setMatchCase,
    matchInfo,
    matches: findHits,
    activeId: findActiveId,
    goTo: findGoTo,
    runSearch,
    findNext,
    findPrev,
    runReplace,
  } = useFind(mapRef, () => liveDocRef.current);
  // Live Find-result set → a highlight ring on every matching topic (the canvas reads `highlightIds`).
  // Recomputed as you type or edit; null when the Find box is empty.
  const searchMatchIds = useMemo(
    () => (query.trim() ? new Set(findDocMatches(liveDoc, query)) : null),
    [query, liveDoc],
  );

  function changeLayout(value: LayoutKind) {
    setLayout(value);
    try {
      localStorage.setItem("mindmap-layout", value);
    } catch {
      // preference is best-effort
    }
  }
  // Notes editor: tracks the selected node and a debounced draft of its note.
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  // How many nodes are selected on the canvas (the inspector switches to bulk mode when >1).
  const [selectedCount, setSelectedCount] = useState(0);
  // Per-field "mixed" summary of a multi-selection — lets the inspector blank-out + label fields the
  // selected topics disagree on, instead of showing (and silently overwriting from) the anchor's.
  const [selectionFields, setSelectionFields] = useState<SelectionFields | null>(null);
  // Markers/tags-on-all-vs-some across the selection — drives the inspector's tri-state bulk chips.
  const [selectionMarkerTags, setSelectionMarkerTags] = useState<SelectionMarkerTags | null>(null);
  // The selected relationship (cross-link) edge, if any — swaps the right slot to the EdgeInspector.
  // Mutually exclusive with node selection (the canvas drives both callbacks).
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  // The selected overlay object (boundary/summary/callout) — swaps the right slot to the
  // OverlayInspector. Mutually exclusive with node + edge selection (canvas-driven).
  const [selectedOverlay, setSelectedOverlay] = useState<SelectedOverlay | null>(null);
  // Live undo/redo availability, reported up by the canvas, so the Row-1 buttons disable correctly (#8).
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Panel open/close + Power-Filter + saved-filter presets (with their localStorage persistence) all
  // live in usePanels; App threads `panels` into <Toolbar> and `filter`/`savedFilters` into the
  // FilterPanel. Auto-numbering (`panels.numbered`) draws hierarchical outline numbers on the canvas.
  const { panels, filter, savedFilters } = usePanels();
  // Quick-capture inbox: a map-independent "Unfiled" bucket (persisted in IndexedDB). Filing an item
  // adds it to the current map as a floating topic, then drops it from the inbox.
  const inbox = useInbox();
  // Saved views live on the doc (meta.savedViews) so they travel with an export and across machines;
  // writes go through the canvas like any other map-meta change, landing in undo + autosave.
  const savedViews = useSavedViews(
    liveDoc,
    useCallback((views) => {
      mapRef.current?.setSavedViews(views);
    }, []),
  );
  // Open-document tabs: which maps are open + which is active (persisted). The active map's state
  // still lives in the doc/liveDoc singletons below — this registry just follows it (load() calls
  // ensureOpen) and drives the tab strip; switching a tab reloads that map.
  const { openIds, ensureOpen, closeTab, reorder, restoreSession } = useOpenDocuments();
  const [outlineFilter, setOutlineFilter] = useState("");
  // Memoised so the canvas only re-dims when the map or the criteria actually change. The deps stay
  // plain primitives/arrays (the individual filter fields), so a fresh `filter.criteria` object each
  // render doesn't needlessly recompute — only an actual field change does.
  const { text, markers, tags, due, priority, completion, relDir, relType } = filter;
  const filterHits = useMemo(() => {
    const criteria: FilterCriteria = {
      text,
      markers,
      tags,
      due,
      priority: priority || undefined,
      completion: completion || undefined,
      relDir: relDir || undefined,
      relType: (relType as FilterCriteria["relType"]) || undefined,
    };
    if (!panels.filterOpen || !isFilterActive(criteria)) return null;
    return filterResult(liveDoc, criteria, todayISO());
  }, [panels.filterOpen, text, markers, tags, due, priority, completion, relDir, relType, liveDoc]);
  // Focus / isolate-branch: session-only, reuses the Power Filter's dim pipeline. Focus wins over
  // the filter as the dim source; both fall back to "no dimming".
  // The full selected node (for the Info panel's tags / markers / link state); `selected` only
  // carries id/topic/note, so look the rest up in the live doc.
  const selectedNode = useMemo<MapNode | null>(() => {
    if (!selected) return null;
    const find = (n: MapNode): MapNode | null => {
      if (n.id === selected.id) return n;
      for (const c of n.children) {
        const hit = find(c);
        if (hit) return hit;
      }
      return null;
    };
    return find(liveDoc.root) ?? liveDoc.floatingTopics?.map(find).find(Boolean) ?? null;
  }, [selected, liveDoc]);
  // Named styles ("styles organizer") — app-wide saved looks, persisted; captures the selected node's
  // style. Lifted into its own hook (called here, where `selectedNode` is in scope).
  const { namedStyles, saveNamedStyle, deleteNamedStyle } = useNamedStyles({
    selectedNode,
    showHint,
  });
  // Inspector header breadcrumb + quick-facts/times lines, and the canvas breadcrumb trail — both pure
  // derivations live in selectionInfo.ts; App just memoises them (the outline-number walk reruns only
  // on doc/selection change).
  const inspectorInfo = useMemo(
    () => selectionInfo(liveDoc, selectedNode, selected?.id ?? null),
    [selected, selectedNode, liveDoc],
  );
  const crumbs = useMemo<Crumb[]>(
    () => selectionCrumbs(liveDoc, selectedNode, selected?.id ?? null),
    [selected, selectedNode, liveDoc],
  );
  // Topics that point AT the selected node (incoming #node= links + relationship edges) — the
  // inspector's "Linked from" jumps. Memoised on the live doc + selection so it doesn't re-walk the
  // tree on every render; rename of a source stays correct because liveDoc is a dependency.
  const backlinks = useMemo(
    () => (selected ? backlinksFor(liveDoc, selected.id) : []),
    [selected, liveDoc],
  );
  const outgoingLinks = useMemo(
    () => (selected ? outgoingLinksFor(liveDoc, selected.id) : []),
    [selected, liveDoc],
  );
  // Cross-map backlinks: other maps whose topics link to THIS map (via #map= hyperlinks). The scan
  // needs every other map's doc, loaded lazily only while the inspector is open (and refreshed when
  // the library or current map changes) so we don't pull the whole library into memory on boot.
  const [crossMapDocs, setCrossMapDocs] = useState<MindMapDoc[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload on library (maps) / current-map change; `selected` only gates the first load.
  useEffect(() => {
    if (!panels.infoOpen || !selected) return;
    let live = true;
    void getAllMaps()
      .then((all) => {
        if (live) setCrossMapDocs(all);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [panels.infoOpen, maps, doc.id]);
  const crossMapBacklinks = useMemo(
    () => (selected ? crossMapBacklinksFor(crossMapDocs, doc.id) : []),
    [selected, crossMapDocs, doc.id],
  );
  // When the selected node's link points at another map (#map=X), load THAT map's topics so the
  // inspector can offer a "…and a topic" refine select — turning a whole-map link into #map=X&node=Y.
  const selectedMapLink = selectedNode?.hyperlink ? classifyLink(selectedNode.hyperlink) : null;
  const crossLinkMapId = selectedMapLink?.kind === "map" ? selectedMapLink.id : null;
  const [crossLinkTopics, setCrossLinkTopics] = useState<
    { id: string; topic: string; depth: number }[]
  >([]);
  useEffect(() => {
    if (!crossLinkMapId) {
      setCrossLinkTopics([]);
      return;
    }
    let live = true;
    void loadMap(crossLinkMapId)
      .then((d) => {
        if (live && d)
          setCrossLinkTopics(
            outlineRows(d.root).map((r) => ({ id: r.id, topic: r.topic, depth: r.depth })),
          );
        else if (live) setCrossLinkTopics([]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [crossLinkMapId]);
  // Every tag already used in the map — drives the inspector's Add-a-tag autocomplete.
  const allTags = useMemo(
    () => markerTagIndex(liveDoc.root, liveDoc.floatingTopics).tags.map((e) => e.key),
    [liveDoc],
  );
  // The selected relationship's endpoint topics (for the EdgeInspector's "From → To" caption),
  // resolved live so renames stay correct.
  const edgeTopics = useMemo(() => {
    const link = selectedEdge ? liveDoc.links?.find((l) => l.id === selectedEdge.id) : undefined;
    return {
      from: (link && findAnyNode(liveDoc, link.from)?.topic) || "",
      to: (link && findAnyNode(liveDoc, link.to)?.topic) || "",
    };
  }, [selectedEdge, liveDoc]);
  // A human caption for the OverlayInspector header — live from the doc. Boundary/summary → member
  // count; callout → its parent topic.
  const overlayCaption = useMemo(() => {
    if (!selectedOverlay) return "";
    if (selectedOverlay.kind === "callout") {
      return selectedOverlay.nodeId
        ? findAnyNode(liveDoc, selectedOverlay.nodeId)?.topic || ""
        : "";
    }
    const arr = selectedOverlay.kind === "boundary" ? liveDoc.boundaries : liveDoc.summaries;
    const obj = arr?.find((o) => o.id === selectedOverlay.id);
    const n = obj?.nodeIds.length ?? 0;
    return `${n} ${n === 1 ? "topic" : "topics"}`;
  }, [selectedOverlay, liveDoc]);
  // Auto-show the right-side inspector when a node is selected (the redesign's auto-show behaviour).
  // Sticky minimize wins: if the user has collapsed the inspector to its strip, selecting another
  // node does NOT force it back open (selectedNode still updates, so re-expanding shows the new node).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on selection id; setters are stable.
  useEffect(() => {
    if ((selected || selectedEdge || selectedOverlay) && !panels.infoMinimized)
      panels.setInfoOpen(true);
  }, [selected?.id, selectedEdge?.id, selectedOverlay?.id]);
  const [focus, setFocus] = useState<{ id: string; topic: string } | null>(null);
  const focusLit = useMemo(() => (focus ? focusSet(liveDoc, focus.id) : null), [focus, liveDoc]);
  const litIds = focusLit && focusLit.size > 0 ? focusLit : (filterHits?.lit ?? null);
  // Drill-in (focus-on-topic): the node whose subtree fills the canvas (a pure view re-root). Null =
  // the whole map. Editing still works while drilled — the canvas keeps editing the full doc.
  const [drillId, setDrillId] = useState<string | null>(null);
  const drillTopic = drillId ? (findAnyNode(liveDoc, drillId)?.topic ?? null) : null;
  // Drop a focus/drill whose node has been deleted, and let Esc clear them.
  useEffect(() => {
    if (focus && (!focusLit || focusLit.size === 0)) setFocus(null);
  }, [focus, focusLit]);
  useEffect(() => {
    if (drillId && !findAnyNode(liveDoc, drillId)) setDrillId(null);
  }, [drillId, liveDoc]);
  // Guided walk (presentation tour): step through every topic in outline order with a spotlight +
  // speaker notes — state, spotlight, and ←/→ + Esc keyboard handling all live in the hook.
  const guidedWalk = useGuidedWalk({ liveDoc, liveDocRef, mapRef, setFocus, setDrillId });

  // Cross-tab clobber guard: warn once if the active map is also open in another tab (both would
  // autosave to the same IndexedDB key, and the last write would silently win).
  const onTabConflict = useCallback(() => {
    showHint(t("hint.openInAnotherTab"));
  }, [showHint]);
  useTabPresence(view === "editor" ? doc.id : null, onTabConflict);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // First-run "3 things to try" card (#13): shown once for a brand-new user, dismissed for good on
  // the first edit or an explicit close. Best-effort localStorage, like the theme + panel prefs.
  const [firstRunSeen, setFirstRunSeen] = useState(() => {
    try {
      return localStorage.getItem("mindmap-first-run-seen") === "1";
    } catch {
      return true; // can't persist → don't nag
    }
  });
  const dismissFirstRun = useCallback(() => {
    setFirstRunSeen(true);
    try {
      localStorage.setItem("mindmap-first-run-seen", "1");
    } catch {
      // best-effort
    }
  }, []);
  // Settings / Preferences dialog (IconRail ⚙ + ⌘K). Re-showing getting-started clears the one-way
  // first-run flag so the "3 things to try" card returns.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reShowFirstRun = useCallback(() => {
    setFirstRunSeen(false);
    try {
      localStorage.removeItem("mindmap-first-run-seen");
    } catch {
      // best-effort
    }
    setSettingsOpen(false);
  }, []);
  const clearAllLocalData = useCallback(async () => {
    const ok = await editorConfirm({
      title: t("dialog.clearAllData.title"),
      body: t("dialog.clearAllData.body"),
      confirmText: t("dialog.clearAllData.confirm"),
      danger: true,
    });
    if (!ok) return;
    try {
      await clearAllData();
    } catch {
      // proceed to clear prefs + reload regardless
    }
    clearAllLocalPreferences();
    location.reload();
  }, []);
  const [searchAllOpen, setSearchAllOpen] = useState(false);
  // Find & Replace overlay (#…): opened with Ctrl/⌘+F, the "/" key, or the toolbar's Find button.
  const [findOpen, setFindOpen] = useState(false);
  // In-editor ⌘K command palette (the Start screen has its own); the hook owns the ⌘K hotkey.
  const [cmdkOpen, setCmdkOpen] = useCommandPaletteHotkey(view === "editor");
  // Focus mode (#9): Ctrl/⌘+. drills into the selected topic / Esc exits (drill carries its own crumb).
  useFocusHotkey({
    enabled: view === "editor",
    drillId,
    selectedId: selected?.id ?? null,
    setDrillId,
  });
  const [libDocs, setLibDocs] = useState<MindMapDoc[]>([]);
  const [libQuery, setLibQuery] = useState("");
  const pendingFocus = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  // Back/forward navigation history (map + focused node). One instance; the recording effect feeds it
  // and Alt+←/→ (or the ⌘K commands) walk it. `pendingNav` suppresses re-recording while we apply a
  // jump, so going back doesn't itself count as a new visit and wipe the forward history.
  const navHistory = useRef(new NavHistory());
  const pendingNav = useRef<NavPoint | null>(null);
  const [navState, setNavState] = useState({ canBack: false, canForward: false });

  // Note editor (debounced draft + commit, and the "switch to Notes tab" nonce) — its own hook.
  const { noteNonce, noteDraft, setNoteDraft, onNoteChange, flushNote, bumpNoteNonce } =
    useNoteEditor(mapRef);

  function handleSelect(sel: SelectedNode | null) {
    // Only reset the draft when the selected node actually changes — a note
    // commit re-fires selection for the same node, which must not clobber typing.
    const changed = sel?.id !== selectedIdRef.current;
    selectedIdRef.current = sel?.id ?? null;
    setSelected(sel);
    if (changed) setNoteDraft(sel?.note ?? "");
  }

  // Format Painter (copy a topic's style → paste across a selection) — owned by useFormatPainter.
  const { copyFormat, pasteFormat, canPasteFormat } = useFormatPainter(mapRef, showHint);

  // Clipboard image paste (Ctrl/⌘+V onto the selected topic) — owned by the hook (editor view only).
  useClipboardImagePaste(view === "editor", mapRef, showHint);

  // Register the PWA self-updater once: a new deploy surfaces a "Refresh now" toast
  // through showToast (no-op in dev — the service worker is disabled there).
  useEffect(() => {
    initPwaUpdateToast(showToast);
  }, [showToast]);

  // Manual "Check for updates", shared by the editor's About dialog and the Start screen's About.
  // Maps the check result to a toast (the surface — ToastBar — is now mounted in both views, so the
  // result, and any re-surfaced "Refresh now" prompt, shows wherever the user triggered it).
  const checkForUpdates = useCallback(async () => {
    const result = await checkForUpdate();
    if (result === "up-to-date") {
      showToast("success", t("hint.upToDate"));
    } else if (result === "newly-found") {
      showToast("info", t("hint.updateDownloading"));
    } else if (result === "unsupported") {
      showToast("info", t("hint.updateUnavailable"));
    }
    // 'already-pending' — checkForUpdate already re-surfaced the "Refresh now" prompt.
  }, [showToast]);

  // Copy the map as a Markdown outline straight to the clipboard — no file download —
  // for pasting into an email, chat, or doc.
  async function copyOutline() {
    try {
      const d = liveDocRef.current;
      const nums = panels.numbered ? outlineNumbers(d.root, d.meta?.numberStyle) : undefined;
      await navigator.clipboard.writeText(toMarkdown(d, nums));
      showHint(t("hint.outlineCopied"));
    } catch {
      showHint(t("hint.clipboardDenied"));
    }
  }

  // Copy the map as a TSV table (one row per topic: Topic · Depth · Note · Tags) for pasting into
  // Excel / Sheets — the inverse of the paste-spreadsheet path.
  async function copyTable() {
    try {
      await navigator.clipboard.writeText(mapToTsv(liveDocRef.current));
      showHint(t("hint.tableCopied"));
    } catch {
      showHint(t("hint.clipboardDenied"));
    }
  }

  // Copy a shareable deep-link to the current map (and selected topic, if any) to the clipboard:
  // opening it focuses that exact node. Uses the live origin/path so it works wherever the app is hosted.
  async function copyDeepLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("map", liveDocRef.current.id);
      const nodeId = selected?.id;
      if (nodeId) url.searchParams.set("node", nodeId);
      else url.searchParams.delete("node");
      await navigator.clipboard.writeText(url.toString());
      showHint(nodeId ? t("hint.topicLinkCopied") : t("hint.mapLinkCopied"));
    } catch {
      showHint(t("hint.clipboardDenied"));
    }
  }

  const refreshMaps = useCallback(async () => {
    try {
      setMaps(await listMaps());
    } catch {
      // library listing is best-effort
    }
  }, []);

  // Version history (the 🕔 History panel's snapshot list, throttled auto-save, in-place restore, and
  // timeline playback) lives in its own hook. App feeds maybeSnapshot into the autosave path below and
  // renders versions / playback / restoreRev; restoreRev remounts the canvas on an in-place restore.
  const {
    versions,
    restoreRev,
    playback,
    setPlayback,
    refreshVersions,
    saveVersionNow,
    restoreVersion,
    startPlayback,
    maybeSnapshot,
  } = useVersionHistory({ liveDocRef, setLiveDoc, setDoc, refreshMaps, showHint });

  // IndexedDB autosave (debounced write-through + the tab-close flush / beforeunload guards) — its own
  // hook. Wired after useVersionHistory (persist feeds maybeSnapshot) and before load (load calls it).
  const { persist, scheduleSave, saveState } = useIdbAutosave({
    liveDocRef,
    dirtyRef,
    refreshMaps,
    maybeSnapshot,
  });

  // Ask the browser to make the local library persistent (exempt from eviction under storage
  // pressure) — best-effort, once on boot. A local-first app's whole pitch is "your work is safe
  // here", so it shouldn't leave the library evictable. No-op where unsupported / not granted.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {});
  }, []);

  const load = useCallback(
    (next: MindMapDoc, nextWarnings: string[] = []) => {
      // Stash the outgoing map's canvas session (viewport + undo/redo) so switching back to it is
      // lossless. Captured here, while the old canvas is still mounted, before the doc swaps.
      const prev = liveDocRef.current;
      if (prev && prev.id !== next.id && mapRef.current) {
        const session = mapRef.current.getSession();
        sessionCache.current.delete(prev.id); // re-insert to bump LRU recency
        sessionCache.current.set(prev.id, {
          viewport: session.viewport,
          history: {
            past: session.history.past.slice(-CACHED_UNDO_DEPTH),
            future: session.history.future,
          },
        });
        while (sessionCache.current.size > MAX_SESSIONS) {
          const oldest = sessionCache.current.keys().next().value;
          if (oldest === undefined) break;
          sessionCache.current.delete(oldest);
        }
      }
      liveDocRef.current = next;
      setLiveDoc(next);
      setWarnings(nextWarnings);
      setError(null);
      setDoc(next);
      ensureOpen(next.id); // register/activate this map's tab (the registry follows the active map)
      persist(next);
    },
    [persist, ensureOpen],
  );

  // "Paste text → map" dialog (parse a pasted outline → new map or under the selection) — own hook.
  const paste = usePasteOutline({ load, mapRef, showHint });

  // --- disk files (open / save / save-as / autosave-to-file) -----------------
  // The whole File System Access layer lives in useDiskFile (the library/IndexedDB copy is always the
  // safety net; this adds real `.ithread` files on disk, with download/import fallbacks where the API is
  // absent). App wires the deps and consumes the returned handlers + the handle cache.
  const {
    handleCache,
    adoptOpenedFile,
    importForeignFile,
    openFile,
    openRecentFile,
    saveFile,
    saveFileAs,
    scheduleFileSave,
  } = useDiskFile({ liveDocRef, load, setView, setFileName, setDirty, setError, showHint });

  // Open-Recent list (disk files), refreshed when the active map changes / on entering the editor.
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: doc.id/view are re-fetch triggers, not read in the effect
  useEffect(() => {
    let alive = true;
    listRecentFiles()
      .then((r) => {
        if (alive) setRecentFiles(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [doc.id, view]);

  // Refresh the history list whenever the panel opens.
  useEffect(() => {
    if (panels.historyOpen) refreshVersions();
  }, [panels.historyOpen, refreshVersions]);

  // Reconnect the active map to its disk file (if any) when it changes: resolve the handle from the
  // in-memory cache or IndexedDB and show its name. `handle.name` needs no permission, so the title
  // bar fills in without a prompt; reading/writing re-checks permission on demand.
  useEffect(() => {
    let cancelled = false;
    setDirty(false);
    (async () => {
      let handle = handleCache.current.get(doc.id) ?? null;
      if (!handle) {
        handle = await loadMapHandle(doc.id).catch(() => null);
        if (handle) handleCache.current.set(doc.id, handle);
      }
      if (!cancelled) setFileName(handle?.name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, handleCache]);

  // Reflect the linked file + unsaved-to-disk state in the tab/window title (a ● marks unsaved file
  // changes — the in-app library is always saved). Plain "iThread" when no file is bound.
  useEffect(() => {
    document.title = fileName ? `${dirty ? "● " : ""}${fileName} — iThread` : "iThread";
  }, [fileName, dirty]);

  // A fresh import collapses the warnings banner back to its summary line.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on each new warnings set.
  useEffect(() => setWarningsExpanded(false), [warnings]);

  // Ctrl/⌘+S save to file, +Shift save-as, Ctrl/⌘+O open — preventDefault so the browser's own
  // save/open dialogs don't hijack them. Bound once; the callbacks are stable (useCallback).
  useEffect(() => {
    if (view !== "editor") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        void (e.shiftKey ? saveFileAs() : saveFile());
      } else if (k === "o" && !e.shiftKey) {
        e.preventDefault();
        void openFile();
      } else if (k === "f" && !e.shiftKey) {
        // Don't hijack Ctrl/⌘+F while the user is typing in a field/note/inline editor — match the
        // "/" find shortcut's editing-context guard (Save/Open stay global on purpose).
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
          return;
        e.preventDefault();
        setFindOpen(true);
      } else if (k === "," && !e.shiftKey) {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, saveFile, saveFileAs, openFile]);

  // File-association launch (installed PWA, Windows/ChromeOS): when the app is opened by double-clicking
  // an `.ithread`/legacy `.mmst`, the OS hands us file handles here. See Vite `file_handlers`.
  useEffect(() => {
    const queue = window.launchQueue;
    if (!queue) return;
    queue.setConsumer((params) => {
      const handle = params.files?.[0];
      if (!handle) return;
      void (async () => {
        try {
          // `.ithread`/legacy `.mmst`/`.json` open natively; `.mmap` imports one-way.
          if (isNativeExt(handle.name))
            await adoptOpenedFile(await readMapFromHandle(handle), handle);
          else await importForeignFile(handle);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
    });
  }, [adoptOpenedFile, importForeignFile]);

  async function exportLibrary() {
    try {
      await saveMap(liveDocRef.current); // flush current edits into the backup
      const docs: MindMapDoc[] = [];
      for (const s of await listMaps()) {
        const d = await loadMap(s.id);
        if (d) docs.push(d);
      }
      downloadBlob(
        new Blob([serializeLibrary(docs, await getFolders())], { type: "application/json" }),
        "mindmap-library.json",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = ""; // allow re-selecting the same files
    await processFiles(files);
  }

  /** Import a set of files (shared by the file <input> and the start screen's drop zone). */
  async function processFiles(files: File[]) {
    if (files.length === 0) return;
    // A single .json that is a whole-library backup restores every map at once.
    if (files.length === 1 && files[0].name.toLowerCase().endsWith(".json")) {
      const text = await files[0].text();
      const lib = tryParseLibrary(text);
      if (lib) {
        try {
          for (const m of lib) await saveMap(m);
          // Restore the folder list too (C2), merged with any existing folders by id (don't clobber).
          const backupFolders = parseLibraryFolders(text);
          if (backupFolders.length) {
            const existing = await getFolders();
            const seen = new Set(existing.map((f) => f.id));
            await saveFolders([...existing, ...backupFolders.filter((f) => !seen.has(f.id))]);
          }
          await refreshMaps();
          load(lib[0] ?? buildTemplate("blank"), [t("hint.restoredMaps", { n: lib.length })]);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return;
      }
    }
    // Code-split: load the .mmap importer (fast-xml-parser, fflate) once, on demand.
    const importMmap = () => import("./import/mmap");
    const batch = files.length > 1;
    try {
      let lastDoc: MindMapDoc | null = null;
      let lastWarnings: string[] = [];
      const batchNotes: string[] = [];
      let failed = 0;
      let firstError = "";
      // Per-file try/catch: one corrupt file in a batch must not abort the rest (the maps that
      // already parsed are saved as we go) and must not be a silent drop — collect failures so they
      // surface in the import banner alongside the lossy-import notes.
      for (const file of files) {
        try {
          const { doc: next, warnings } = await parseImport(file, importMmap);
          next.id = crypto.randomUUID(); // each import becomes its own library entry
          if (batch) await saveMap(next); // persist every map in a batch
          if (warnings.length > 0) {
            const extra = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : "";
            batchNotes.push(`${next.title}: ${warnings[0]}${extra}`);
          }
          lastDoc = next;
          lastWarnings = warnings;
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          if (!firstError) firstError = `${file.name}: ${msg}`;
          batchNotes.push(`Couldn’t import ${file.name}: ${msg}`);
        }
      }
      if (!lastDoc) {
        // Nothing parsed — surface the first failure rather than returning silently.
        setError(t("hint.importFailed", { error: firstError || t("hint.noReadableMaps") }));
        return;
      }
      // Render the last good import; lead with a one-line summary that owns up to any failures.
      const ok = files.length - failed;
      load(
        lastDoc,
        batch
          ? [
              t("hint.importedMaps", {
                n: ok,
                total: files.length,
                failed: failed ? t("hint.importFailedSuffix", { n: failed }) : "",
              }),
              ...batchNotes,
            ]
          : lastWarnings,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const image = await fileToMapImage(file);
      const applied = mapRef.current?.setSelectedImage(image);
      showHint(applied ? t("hint.imageAdded") : t("hint.selectNodeForImage"));
    } catch (err) {
      showHint(err instanceof Error ? err.message : t("hint.imageFailed"));
    }
  }

  async function handleBackgroundImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      // Reuse the node-image pipeline (downscale + data URL) so a huge picture can't bloat the doc;
      // non-image files reject during decode and surface a hint.
      const { url } = await fileToMapImage(file);
      mapRef.current?.setBackgroundImage(url);
      showHint(t("hint.backgroundSet"));
    } catch (err) {
      showHint(err instanceof Error ? err.message : t("hint.backgroundFailed"));
    }
  }

  const switchMap = useCallback(
    async (id: string) => {
      if (id === liveDocRef.current.id) return;
      try {
        await saveMap(liveDocRef.current); // flush current edits before switching
        const next = await loadMap(id);
        if (next) load(next);
      } catch {
        // ignore
      }
    },
    [load],
  );

  const replaceActiveFromCli = useCallback((next: MindMapDoc) => {
    if (!mapRef.current) return false;
    mapRef.current.replaceDocument(next);
    return true;
  }, []);
  useCliBridge({
    activeDoc: liveDocRef,
    openDoc: load,
    replaceActive: replaceActiveFromCli,
    refreshMaps,
  });

  // Open a doc from the start screen in the editor (optionally applying its layout), and switch view.
  function openFromStart(next: MindMapDoc, nextLayout?: string) {
    load(next);
    if (nextLayout) changeLayout(nextLayout as LayoutKind);
    setView("editor");
  }
  async function importFromStart(files: File[]) {
    await processFiles(files);
    setView("editor");
  }
  // Return to the start screen, flushing the current map first so Recent reflects the latest edit.
  async function goHome() {
    try {
      await saveMap(liveDocRef.current);
    } catch {
      // best-effort flush
    }
    setView("start");
  }

  // Roll-ups: pull the latest from every roll-up node's source map (the automated cousin of
  // cross-map branch paste). Bind a node via the "⤵ Roll-up" select, then refresh on demand.
  async function refreshRollupsNow() {
    const res = await refreshRollups(liveDocRef.current, loadMap);
    if (res.count === 0) {
      showHint(t("hint.noRollups"));
      return;
    }
    load(res.doc);
    const miss = res.missing.length ? t("hint.rollupsMissing", { n: res.missing.length }) : "";
    showHint(t("hint.rollupsRefreshed", { n: res.count, missing: miss }));
  }

  function duplicateMap() {
    const copy = structuredClone(liveDocRef.current);
    copy.id = crypto.randomUUID();
    copy.title = `${liveDocRef.current.title} (copy)`;
    copy.root = { ...copy.root, topic: copy.title };
    load(copy);
  }

  // "New map from this topic": copy the selected branch out into a fresh standalone library map and
  // open it (non-destructive — the source map keeps the branch). The restructure verb the multi-map
  // library was missing; the inverse of merge-map-as-branch below.
  async function promoteBranchToMap() {
    const id = selected?.id;
    if (!id) {
      showHint(t("hint.selectTopicToPromote"));
      return;
    }
    const fresh = newMapFromBranch(liveDocRef.current, id);
    if (!fresh) {
      showHint(t("hint.pickBranchToPromote"));
      return;
    }
    fresh.id = crypto.randomUUID();
    try {
      await saveMap(liveDocRef.current); // flush the source map's edits before switching
      await saveMap(fresh);
      load(fresh);
      showHint(`Promoted "${fresh.title}" to a new map.`);
    } catch {
      showHint(t("hint.promoteFailed"));
    }
  }

  // "Insert map as branch": graft another library map's whole tree under the selected topic (re-id'd,
  // so ids never clash). The inverse of promote-to-map; reuses the cross-map branch-graft path.
  async function mergeMapAsBranch(sourceId: string) {
    if (!selected) {
      showHint(t("hint.selectTopicToMerge"));
      return;
    }
    if (sourceId === liveDocRef.current.id) {
      showHint(t("hint.pickDifferentMap"));
      return;
    }
    try {
      const src = await loadMap(sourceId);
      if (!src) {
        showHint(t("hint.mapLoadFailed"));
        return;
      }
      const ok = mapRef.current?.addSubtreeToSelected([src.root]);
      showHint(ok ? `Merged "${src.title}" under the selection.` : t("hint.selectTopicFirst"));
    } catch {
      showHint(t("hint.mergeFailed"));
    }
  }

  // Power Filter → "Extract matches to a new map": prune the live doc to the lit set (matches +
  // ancestors) and open it as a fresh library map. No-op (with a hint) when nothing matches.
  function extractFilterMatches() {
    const lit = filterHits?.lit;
    if (!lit || !filterHits || filterHits.matches === 0) {
      showHint(t("hint.noMatchesToExtract"));
      return;
    }
    const extracted = filterToDoc(liveDocRef.current, lit, crypto.randomUUID());
    if (!extracted) {
      showHint(t("hint.noMatchesToExtract"));
      return;
    }
    load(extracted);
    showHint(t("hint.extracted", { n: filterHits.matches }));
  }

  async function deleteCurrent() {
    // Delete immediately + offer Undo (re-saves the map), instead of a blocking confirm (#9).
    const deleted = structuredClone(liveDocRef.current);
    // …but if other maps roll-up or link to this one, deleting silently breaks those references —
    // so confirm in that (rarer, riskier) case. Best-effort: never block a delete on a failed scan.
    try {
      const refs = await findMapReferences(deleted.id);
      if (refs.length > 0) {
        const names = refs
          .slice(0, 3)
          .map((r) => `“${r.title || "Untitled"}”`)
          .join(", ");
        const more = refs.length > 3 ? `, and ${refs.length - 3} more` : "";
        const ok = await editorConfirm({
          title: t("dialog.deleteMap.title"),
          body: t("dialog.deleteMapRefs", { n: refs.length, names: `${names}${more}` }),
          confirmText: t("dialog.deleteMap.confirm"),
          danger: true,
        });
        if (!ok) return;
      }
    } catch {
      // reference scan is best-effort
    }
    try {
      await softDeleteMap(deleted.id); // to the Trash (recoverable), not destroyed
      sessionCache.current.delete(deleted.id); // its stashed canvas session goes with it
      // Drop its tab and prefer the adjacent open tab; only fall back to the library / a blank map
      // when no other tab is open.
      const neighbour = closeTab(deleted.id);
      let next = neighbour ? await loadMap(neighbour).catch(() => null) : null;
      if (!next) {
        const remaining = await listMaps();
        next = remaining.length > 0 ? await loadMap(remaining[0].id) : null;
      }
      load(next ?? buildTemplate("blank"));
      showToast("info", `Deleted “${deleted.title || "Untitled map"}”`, {
        action: {
          label: t("cmd.undo"),
          run: async () => {
            try {
              await restoreMapFromTrash(deleted.id);
              await setLastOpened(deleted.id);
              load(deleted);
            } catch {
              // best-effort restore
            }
          },
        },
        durationMs: 8000,
      });
    } catch {
      // ignore
    }
  }

  // Close a document tab. Flushes the active map first; if it was the active tab, advances to a
  // neighbouring open tab (or the start screen when none remain).
  async function closeMapTab(mapId: string) {
    const wasActive = mapId === doc.id;
    if (wasActive) {
      try {
        await saveMap(liveDocRef.current);
      } catch {
        // best-effort flush
      }
    }
    const neighbour = closeTab(mapId);
    // Drop any stashed canvas session so reopening this map later starts fresh (not a stale viewport
    // + undo stack from before it was closed).
    sessionCache.current.delete(mapId);
    if (!wasActive) return;
    const next = neighbour ? await loadMap(neighbour).catch(() => null) : null;
    if (next) load(next);
    else setView("start");
  }

  const {
    exportJson,
    exportMarkdown,
    exportMermaid,
    exportXmind,
    exportSmmx,
    exportMmap,
    exportIthoughts,
    exportOpml,
    exportFreemind,
    exportPng,
    copyPng,
    exportSvg,
    exportHtml,
    exportInteractiveHtml,
    exportDeck,
    exportPdf,
    exportPdfFile,
    exportDocx,
    exportPptx,
    exportXlsx,
  } = useMapExports(
    mapRef,
    () => liveDocRef.current,
    () => panels.numbered,
    showHint,
  );

  // "Export this branch…" (B4): the chosen subtree root drives the lazy format-picker dialog, which owns
  // its own scoped export plumbing (kept out of the entry bundle).
  const [branchExportId, setBranchExportId] = useState<string | null>(null);

  // Restore the last-opened map on startup straight into the editor. With no prior map (first run /
  // empty library) land on the start screen instead of an editor full of the sample map.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A ?map=<id> deep-link (shareable / bookmarkable) opens that map as the active tab — even on a
      // first visit with no saved session. An optional ?node=<id> then focuses that topic once the
      // map has mounted (via the same pendingFocus path as a cross-map jump).
      const params = new URLSearchParams(window.location.search);
      const deepLinkId = params.get("map");
      const deepLinkNodeId = params.get("node");
      const session = await getTabSession().catch(() => null);
      if (cancelled) return;
      booted.current = true; // boot has decided; the URL ?map= sync may now run
      if (!session && !deepLinkId) {
        setView("start");
        return;
      }
      // Prune the open set to maps that still exist (one may have been deleted out-of-band) and seed
      // the library list so the tab titles paint correctly on first render (no "Untitled" flash).
      const lib = await listMaps().catch(() => []);
      if (cancelled) return;
      setMaps(lib);
      const existing = new Set(lib.map((m) => m.id));
      let openTabIds = session ? session.openTabIds.filter((id) => existing.has(id)) : [];
      // Active map: a valid deep-link wins (and joins the open set); else the persisted active tab;
      // else the first surviving tab. A single dead map doesn't drop the whole workspace.
      let activeId: string | null = null;
      if (deepLinkId && existing.has(deepLinkId)) {
        activeId = deepLinkId;
        if (!openTabIds.includes(deepLinkId)) openTabIds = [...openTabIds, deepLinkId];
      } else if (session && existing.has(session.activeTabId)) {
        activeId = session.activeTabId;
      } else {
        activeId = openTabIds[0] ?? null;
      }
      const restored = activeId ? await loadMap(activeId).catch(() => null) : null;
      if (cancelled) return;
      if (restored && activeId) {
        restoreSession({
          openTabIds: openTabIds.length ? openTabIds : [activeId],
          activeTabId: activeId,
        });
        // Focus the deep-linked node after the canvas mounts (the pendingFocus effect, keyed on doc).
        if (deepLinkNodeId) pendingFocus.current = deepLinkNodeId;
        load(restored);
        setView("editor");
      } else {
        setView("start");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, restoreSession]);

  // A restored canvas session is one-shot: drop it once the (re)mounted canvas has consumed it, so a
  // later in-place remount that keeps the same map id (a version restore bumps restoreRev) starts from
  // a clean session rather than re-applying a stale viewport / undo stack.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the remount inputs (doc.id, restoreRev).
  useEffect(() => {
    sessionCache.current.delete(doc.id);
  }, [doc.id, restoreRev]);

  // Keep the URL's ?map= in sync with the active map (so it's shareable / bookmarkable); clear it on
  // the start screen. replaceState — no history spam. Other params (?layout, ?theme) are preserved.
  useEffect(() => {
    if (!booted.current) return; // don't write the pre-boot sampleDoc placeholder into the URL
    try {
      const url = new URL(window.location.href);
      const want = view === "editor" ? doc.id : null;
      if (want) {
        if (url.searchParams.get("map") !== want) {
          url.searchParams.set("map", want);
          window.history.replaceState(null, "", url);
        }
      } else if (url.searchParams.has("map")) {
        url.searchParams.delete("map");
        window.history.replaceState(null, "", url);
      }
    } catch {
      // best-effort; deep-link sync is non-critical
    }
  }, [doc.id, view]);

  // Keep the URL's ?node= in sync with the selected topic, so the address bar always points at a
  // shareable deep-link to exactly what's focused. Cleared when nothing's selected or off the editor.
  // replaceState — no history spam (back/forward has its own stack).
  useEffect(() => {
    if (!booted.current) return;
    try {
      const url = new URL(window.location.href);
      const want = view === "editor" ? (selected?.id ?? null) : null;
      if (want) {
        if (url.searchParams.get("node") !== want) {
          url.searchParams.set("node", want);
          window.history.replaceState(null, "", url);
        }
      } else if (url.searchParams.has("node")) {
        url.searchParams.delete("node");
        window.history.replaceState(null, "", url);
      }
    } catch {
      // best-effort; deep-link sync is non-critical
    }
  }, [selected?.id, view]);

  // Press "/" to open the Find & Replace overlay (ignored while typing in a field/node).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const editing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (editing) return;
      e.preventDefault();
      setFindOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dev-only hooks for browser verification: read the live model, and grab the raw
  // exported SVG straight off the canvas handle (so the export can be rendered outside
  // the app — the Phase F go/no-go check).
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__getLiveDoc = () => liveDocRef.current;
      window.__exportSvg = (rootId?: string) => mapRef.current?.exportSvg(rootId)?.text() ?? null;
    }
  }, []);

  // The native-<dialog> modal mechanic (showModal()/close() + Escape-to-close) now lives in
  // <Dialog>; the three dialogs below pass `open`/`onClose`, with their on-open side effects
  // (focus the first field, lazy-load the searchable library) supplied via `onOpen`.

  // After a cross-map jump, focus the target node once the new map has re-rendered (two
  // frames lets the canvas finish layout + fit). focusNode is a no-op if the id isn't found.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `doc` so it re-runs when the map switches, though the body reads only the pendingFocus ref.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => mapRef.current?.focusNode(id)),
    );
    return () => cancelAnimationFrame(raf);
  }, [doc]);

  function goToHit(hit: LibraryHit) {
    setSearchAllOpen(false);
    setLibQuery("");
    if (hit.mapId === liveDocRef.current.id) {
      mapRef.current?.focusNode(hit.nodeId);
    } else {
      pendingFocus.current = hit.nodeId;
      void switchMap(hit.mapId);
    }
  }

  // Follow an in-app link from a note body (`#node=…` / `#map=…[&node=…]`) through the canvas: focus
  // the topic, or switch maps and focus the target once it mounts (the pendingFocus path). External
  // links inside notes already render as real http anchors, so they don't reach here.
  const followInAppLink = useCallback(
    (url: string) => {
      const link = classifyLink(url);
      if (link.kind === "node") mapRef.current?.focusNode(link.id);
      else if (link.kind === "map") {
        // If the target IS the current map, focus directly — switchMap early-returns on the same id,
        // so going through pendingFocus would never fire (and would strand a stale id). Mirrors goToHit.
        if (link.id === liveDocRef.current.id) {
          if (link.nodeId) mapRef.current?.focusNode(link.nodeId);
        } else {
          if (link.nodeId) pendingFocus.current = link.nodeId;
          void switchMap(link.id);
        }
      }
    },
    [switchMap],
  );

  // Record each focused-topic location (map + node) into the back/forward history, so Alt+←/→ can
  // retrace where you've been — across maps too. Plain (null) selections aren't recorded; a jump in
  // progress (pendingNav) is suppressed so going back doesn't itself count as a new visit.
  useEffect(() => {
    if (view !== "editor") return;
    const id = selected?.id ?? null;
    if (!id) return;
    const pn = pendingNav.current;
    if (pn) {
      if (pn.mapId === doc.id && pn.nodeId === id) {
        pendingNav.current = null; // arrived at the jump target — don't double-record it
        return;
      }
      // Same map but a different node ⇒ the jump landed and the user moved on (branch). A different
      // map ⇒ a cross-map switch is still settling, so keep waiting.
      if (pn.mapId === doc.id) pendingNav.current = null;
      else return;
    }
    navHistory.current.visit({ mapId: doc.id, nodeId: id });
    setNavState({
      canBack: navHistory.current.canBack,
      canForward: navHistory.current.canForward,
    });
  }, [doc.id, selected?.id, view]);

  // Apply a back/forward destination: focus the node (switching maps first if it lives in another).
  const applyNav = useCallback(
    (pt: NavPoint | null) => {
      if (!pt?.nodeId) return;
      pendingNav.current = pt;
      if (pt.mapId === liveDocRef.current.id) {
        mapRef.current?.focusNode(pt.nodeId);
      } else {
        pendingFocus.current = pt.nodeId;
        void switchMap(pt.mapId);
      }
      setNavState({
        canBack: navHistory.current.canBack,
        canForward: navHistory.current.canForward,
      });
    },
    [switchMap],
  );
  const navBack = useCallback(() => applyNav(navHistory.current.back()), [applyNav]);
  const navForward = useCallback(() => applyNav(navHistory.current.forward()), [applyNav]);

  // Alt+← / Alt+→ walk the navigation history (browser-style). Editor-only; ignored while typing in a
  // field/note so they don't fight text editing. Alt+Shift+← / → stays promote/demote on the canvas.
  useEffect(() => {
    if (view !== "editor") return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      e.preventDefault();
      if (e.key === "ArrowLeft") navBack();
      else navForward();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, navBack, navForward]);

  // Keep the current map selectable even before its first save lands.
  const mapOptions = maps.some((m) => m.id === doc.id)
    ? maps
    : [{ id: doc.id, title: doc.title }, ...maps];

  // Apply a whole Design preset (theme + connector style + branch weight + accent) in one shot — the
  // Map panel's Design gallery (T3-25; used to also live in the Toolbar's Canvas menu before the
  // design-surface consolidation gave the map's look a single home).
  const applyDesign = (id: string) => {
    const design = designById(id);
    if (!design) return;
    setThemeId(design.themeId); // canvas theme (React state)
    mapRef.current?.setConnectorStyle(design.connectorStyle); // map-wide connector (undoable)
    mapRef.current?.setBranchGrowth(design.branchGrowth); // map-wide branch weight (undoable)
    mapRef.current?.setAccentColor(design.accentColor); // relationship + boundary accent (undoable)
    showHint(t("hint.designApplied", { name: design.name }));
  };

  // The toolbar prop groups, built once and shared with both <Toolbar> and the ⌘K command registry
  // (buildEditorCommands) so the two surfaces can't drift — one source of truth for editor actions.
  const toolbarProps: ToolbarProps = {
    isMobile,
    mapRef,
    nav: {
      goHome,
      openAbout: () => setAboutOpen(true),
      openShortcuts: () => setShortcutsOpen(true),
      openSearchAll: () => setSearchAllOpen(true),
      openPaste: () => paste.setOpen(true),
      openFind: () => setFindOpen(true),
      openSettings: () => setSettingsOpen(true),
      reShowGettingStarted: reShowFirstRun,
      navBack,
      navForward,
      canBack: navState.canBack,
      canForward: navState.canForward,
    },
    panels,
    map: {
      doc,
      liveDoc,
      maps,
      mapOptions,
      switchMap,
      load,
      duplicateMap,
      deleteCurrent,
      promoteBranch: promoteBranchToMap,
      mergeMap: mergeMapAsBranch,
      present: () => setPresentDoc(liveDocRef.current),
      refreshRollupsNow,
    },
    canvas: {
      theme,
      setThemeId,
      layout,
      changeLayout,
      selected,
      setFocus,
      handleImage,
      handleBackgroundImage,
      copyFormat,
      pasteFormat,
      canPasteFormat,
      shuffleBranchColors: () => mapRef.current?.shuffleBranchColors(),
      // Open the right-hand inspector, where the Map panel (shown when no node is selected) now hosts
      // theme / background / connectors / fonts / backdrop. Deselect a node to see those map settings.
      openMapPanel: () => {
        panels.setInfoMinimized(false);
        panels.setInfoOpen(true);
      },
      drillIn: () => {
        if (selected) setDrillId(selected.id);
      },
      exportBranch: (id: string) => setBranchExportId(id),
      startWalk: guidedWalk.start,
      alignSelection: (mode) => mapRef.current?.alignSelection(mode),
      distributeSelection: (axis) => mapRef.current?.distributeSelection(axis),
      selectedCount,
      freeform: !!liveDoc.meta?.freeform,
    },
    find: {
      query,
      setQuery,
      replaceWith,
      setReplaceWith,
      replaceScope,
      setReplaceScope,
      useRegex,
      setUseRegex,
      matchCase,
      setMatchCase,
      matchInfo,
      matches: findHits,
      activeId: findActiveId,
      goTo: findGoTo,
      runSearch,
      findNext,
      findPrev,
      runReplace,
    },
    io: {
      exportJson,
      exportMarkdown,
      exportMermaid,
      exportXmind,
      exportSmmx,
      exportMmap,
      exportIthoughts,
      exportOpml,
      exportFreemind,
      exportPng,
      copyPng,
      exportSvg,
      exportHtml,
      exportInteractiveHtml,
      exportDeck,
      exportPdf,
      exportPdfFile,
      exportDocx,
      exportPptx,
      exportXlsx,
      exportLibrary,
      copyOutline,
      copyTable,
      copyDeepLink,
      handleFile,
      openFile,
      openRecentFile,
      recentFiles,
      saveFile,
      saveFileAs,
      fileName,
      dirty,
    },
    views: {
      list: savedViews.list.map((v) => ({ id: v.id, name: v.name })),
      onSave: async () => {
        const name = (
          await editorPrompt({
            title: t("dialog.nameView.title"),
            placeholder: t("dialog.nameView.placeholder"),
          })
        )?.trim();
        if (!name) return;
        const vp = mapRef.current?.getViewport();
        if (!vp) return;
        const active = panels.filterOpen && isFilterActive(filter.criteria);
        // Same-name save replaces the existing view (addView filters by name) — say so rather than
        // silently clobbering a captured perspective.
        const replaced = savedViews.list.some((x) => x.name === name);
        savedViews.add(name, {
          viewport: vp,
          drillId,
          criteria: active ? filter.criteria : null,
        });
        showHint(replaced ? t("hint.viewReplaced", { name }) : t("hint.viewSaved", { name }));
      },
      onApply: (id: string) => {
        const v = savedViews.list.find((x) => x.id === id);
        if (!v) return;
        setDrillId(v.drillId);
        mapRef.current?.setViewport(v.viewport);
        if (v.criteria) {
          if (!panels.filterOpen) panels.toggleFilter();
          savedFilters.apply(v.criteria);
        } else if (panels.filterOpen) {
          panels.toggleFilter(); // closing also clears the filter
        }
      },
      onDelete: (id: string) => {
        // Delete + Undo toast — matches the considered map-delete pattern, so a misclick in the
        // small views list doesn't permanently destroy a captured viewport/filter/drill state.
        const v = savedViews.list.find((x) => x.id === id);
        savedViews.remove(id);
        if (v)
          showToast("info", t("hint.viewDeleted", { name: v.name }), {
            action: {
              label: t("cmd.undo"),
              run: () =>
                savedViews.add(v.name, {
                  viewport: v.viewport,
                  drillId: v.drillId,
                  criteria: v.criteria,
                }),
            },
          });
      },
    },
    history: {
      canUndo,
      canRedo,
      undo: () => {
        mapRef.current?.undo();
        showHint("Undone");
      },
      redo: () => {
        mapRef.current?.redo();
        showHint("Redone");
      },
    },
    showHint,
    saveState,
  };

  // On a phone the side panels + inspector dock as bottom sheets (mobile.css). A tap-out scrim
  // dismisses whichever is open, so a user can't get stuck with the canvas obscured. (Logic lives in
  // mobileSheets.ts so it's unit-testable without a forced-mobile integration render.)
  const mobileSheetOpen = isMobile && anyMobileSheetOpen(panels);
  // Drag-to-resize for whichever bottom sheet is up (mobile). Publishes `--mm-sheet-h` (read by both
  // .mm-panel-host and .mm-inspector); dragging down past the threshold dismisses every open sheet,
  // mirroring the tap-out scrim.
  const sheetDrag = useSheetDrag(() => closeMobileSheets(panels));

  // Left dock: the side panels share ONE tabbed column (mm-dock) instead of stacking as N 250px
  // columns that could crush the canvas. `activeDock` is the visible tab; opening a panel makes it
  // active, and closing the active one falls back to another open panel.
  // Persisted in usePanels so the active dock tab (and the dock width) survive a reload.
  const { dockActive: activeDock, setDockActive: setActiveDock } = panels;
  const openDockKeys = (
    [
      [panels.outlineOpen, "outline"],
      [panels.indexOpen, "index"],
      [panels.relationshipsOpen, "relationships"],
      [panels.statsOpen, "stats"],
      [panels.agendaOpen, "agenda"],
      [panels.mapsOpen, "maps"],
      [panels.inboxOpen, "inbox"],
      [panels.deckEditorOpen, "deck"],
      [panels.noteEditorOpen, "note"],
      [panels.filterOpen, "filter"],
      [panels.stylesOpen, "styles"],
      [panels.historyOpen, "history"],
    ] as const
  )
    .filter(([open]) => open)
    .map(([, key]) => key);
  const openDockKey = openDockKeys.join(",");
  const prevOpenDock = useRef("");
  useEffect(() => {
    const keys = openDockKey ? openDockKey.split(",") : [];
    const prev = prevOpenDock.current ? prevOpenDock.current.split(",") : [];
    const newly = keys.find((k) => !prev.includes(k)); // a just-opened panel becomes active
    prevOpenDock.current = openDockKey;
    setActiveDock(
      (cur) => newly ?? (cur && keys.includes(cur) ? cur : (keys[keys.length - 1] ?? null)),
    );
  }, [openDockKey, setActiveDock]);

  if (view === "start") {
    return (
      <>
        <Suspense fallback={null}>
          <StartScreen
            dark={chromeDark}
            onOpen={openFromStart}
            onImportFiles={importFromStart}
            onCheckForUpdates={checkForUpdates}
          />
        </Suspense>
        {/* The toast surface must render on Start too, or the PWA "Refresh now" prompt (and any
            other toast) is silently swallowed here — Start is the most common landing screen. */}
        <ToastBar toast={toast} onDismiss={dismissToast} variant="floating" />
      </>
    );
  }

  return (
    <div
      className="mm-editor"
      data-theme={chromeDark ? "dark" : "light"}
      // While a sheet drag is live, suppress the height transition so it tracks the finger.
      data-sheet-dragging={sheetDrag.dragging || undefined}
      style={{
        ...editorThemeVars(chromeDark, highContrast),
        // Live bottom-sheet height (mobile only); the sheets + handle read this with a 62dvh fallback.
        ...(sheetDrag.heightVh != null
          ? ({ "--mm-sheet-h": `${sheetDrag.heightVh}dvh` } as Record<string, string>)
          : null),
      }}
    >
      {/* First focusable element — lets keyboard / switch users skip the rail + toolbar straight to
          the map (WCAG 2.4.1). Targets the canvas wrapper's id; off-screen until focused. */}
      <a className="mm-skip-link" href="#mm-canvas">
        {t("app.skipToCanvas")}
      </a>
      <IconRail
        onHome={goHome}
        onImage={handleImage}
        onPaste={() => paste.setOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onGettingStarted={reShowFirstRun}
        onCommandPalette={() => setCmdkOpen(true)}
      />
      <div className="mm-editor-main">
        <Toolbar {...toolbarProps} />

        {openIds.length > 0 && (
          <DocumentTabs
            docs={openIds.map((id) => ({
              id,
              title:
                id === doc.id
                  ? liveDoc.title || doc.title
                  : (maps.find((m) => m.id === id)?.title ?? ""),
            }))}
            activeId={doc.id}
            onActivate={switchMap}
            onClose={closeMapTab}
            onNew={() => load(buildTemplate("blank"))}
            onReorder={reorder}
          />
        )}

        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              padding: "8px 16px",
              background: "var(--ed-toast-error-bg, #fcebeb)",
              color: "var(--ed-toast-error-ink, #791f1f)",
              fontSize: 13,
              borderBottom: "1px solid var(--ed-toast-error-border, #f7c1c1)",
            }}
          >
            <span style={{ flex: 1 }}>{t("app.importFailed", { error })}</span>
            <button
              type="button"
              aria-label={t("app.dismissImportError")}
              onClick={() => setError(null)}
              style={bannerDismissStyle}
            >
              ×
            </button>
          </div>
        )}

        {warnings.length > 0 && (
          <output
            style={{
              display: "block",
              padding: "8px 16px",
              background: "var(--ed-toast-warn-bg, #faeeda)",
              color: "var(--ed-toast-warn-ink, #633806)",
              fontSize: 13,
              borderBottom: "1px solid var(--ed-toast-warn-border, #fac775)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ flex: 1 }}>
                {t("app.importedWithNotes", {
                  n: warnings.length,
                  note:
                    warnings[0] +
                    (warnings.length > 1 && !warningsExpanded
                      ? t("app.importedMoreSuffix", { n: warnings.length - 1 })
                      : ""),
                })}
              </span>
              {warnings.length > 1 && (
                <button
                  type="button"
                  onClick={() => setWarningsExpanded((v) => !v)}
                  style={bannerLinkStyle}
                >
                  {warningsExpanded ? t("common.hide") : t("hint.showAll")}
                </button>
              )}
              <button
                type="button"
                aria-label={t("app.dismissImportNotes")}
                onClick={() => setWarnings([])}
                style={bannerDismissStyle}
              >
                ×
              </button>
            </div>
            {warningsExpanded && warnings.length > 1 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {warnings.slice(1).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </output>
        )}

        <ToastBar toast={toast} onDismiss={dismissToast} variant="inline" />

        {focus && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "4px 12px",
              background: "var(--ed-toast-info-bg, #efe9ff)",
              borderBottom: "1px solid var(--ed-toast-border, #cecbf6)",
              fontSize: 13,
              color: "var(--ed-toast-ink, #26215c)",
            }}
          >
            <span>
              ◎{" "}
              {tNodes("app.focusingBranch", {
                topic: <strong>{focus.topic || t("common.untitled")}</strong>,
              })}
            </span>
            <button
              type="button"
              onClick={() => setFocus(null)}
              style={{ ...controlStyle, padding: "1px 8px", fontSize: 12 }}
            >
              {t("app.showAllEsc")}
            </button>
          </div>
        )}

        {drillId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "4px 12px",
              background: "var(--ed-toast-success-bg, #e9f6ef)",
              borderBottom: "1px solid var(--ed-toast-border, #bfe6d2)",
              fontSize: 13,
              color: "var(--ed-toast-ink, #14573a)",
            }}
          >
            <span>
              ⤢{" "}
              {tNodes("app.drilledInto", {
                topic: <strong>{drillTopic || t("common.untitled")}</strong>,
              })}
            </span>
            <button
              type="button"
              onClick={() => setDrillId(null)}
              style={{ ...controlStyle, padding: "1px 8px", fontSize: 12 }}
            >
              {t("app.exitEsc")}
            </button>
          </div>
        )}

        {crumbs.length > 1 && (
          <Breadcrumb
            crumbs={crumbs}
            // While drilled, the breadcrumb is the drill navigator: click an ancestor to re-root there,
            // or the map root to exit. Otherwise a crumb just centres that node.
            onPick={(id) => {
              if (drillId) setDrillId(id === liveDoc.root.id ? null : id);
              else mapRef.current?.focusNode(id);
            }}
          />
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {mobileSheetOpen && <MobileSheetScrim onClose={() => closeMobileSheets(panels)} />}
          {/* Real (was decorative) grab handle for the bottom sheet — drag to resize / dismiss, or
              focus it and use the arrow keys (Escape closes). Fixed at the sheet's top edge via the
              shared --mm-sheet-h var, so it tracks the live height. */}
          {mobileSheetOpen && (
            <div
              className="mm-sheet-handle"
              role="separator"
              aria-orientation="horizontal"
              aria-label={t("app.resizePanel")}
              tabIndex={0}
              data-dragging={sheetDrag.dragging || undefined}
              {...sheetDrag.handleProps}
            />
          )}
          <div className="mm-panel-host">
            {(() => {
              const entries: DockEntry[] = [];
              if (panels.outlineOpen)
                entries.push({
                  key: "outline",
                  label: PANEL_LABELS.outline.tab,
                  onClose: () => panels.setOutlineOpen(false),
                  node: (
                    <OutlinePanel
                      root={liveDoc.root}
                      filter={outlineFilter}
                      numbered={panels.numbered}
                      numberStyle={liveDoc.meta?.numberStyle}
                      selectedId={selected?.id ?? null}
                      onFilterChange={setOutlineFilter}
                      onPick={(id) => mapRef.current?.focusNode(id)}
                      onRename={(id, topic) => mapRef.current?.renameNode(id, topic)}
                      onIndent={(id, dir) => mapRef.current?.indentNode(id, dir)}
                      onMove={(dragId, targetId, where) =>
                        mapRef.current?.moveOutlineNode(dragId, targetId, where)
                      }
                      onAddChild={(id) => mapRef.current?.addOutlineChild(id) ?? null}
                      onAddSibling={(id) => mapRef.current?.addOutlineSibling(id) ?? null}
                    />
                  ),
                });
              if (panels.indexOpen)
                entries.push({
                  key: "index",
                  label: PANEL_LABELS.index.tab,
                  onClose: () => panels.setIndexOpen(false),
                  node: (
                    <MarkerTagIndex
                      root={liveDoc.root}
                      floatingTopics={liveDoc.floatingTopics}
                      onPick={(id) => mapRef.current?.focusNode(id)}
                      onRenameTag={(from, to) => mapRef.current?.renameTag(from, to)}
                      onDeleteTag={(t) => mapRef.current?.deleteTag(t)}
                      tagColorOf={(t) => tagColor(liveDoc.rules, t)}
                      onSetTagColor={(t, color) =>
                        mapRef.current?.setRules(setTagColor(liveDoc.rules, t, color))
                      }
                      onFilterBy={(kind, key) => {
                        // Quick Filter (item 12): add this marker/tag to the Power Filter and open it,
                        // reusing the existing filter pipeline (no new matching logic).
                        if (kind === "marker") filter.toggleMarker(key);
                        else filter.toggleTag(key);
                        if (!panels.filterOpen) panels.toggleFilter();
                        showHint(t("hint.filteringBy", { kind, key }));
                      }}
                    />
                  ),
                });
              if (panels.relationshipsOpen)
                entries.push({
                  key: "relationships",
                  label: PANEL_LABELS.relationships.tab,
                  onClose: () => panels.setRelationshipsOpen(false),
                  node: (
                    <RelationshipsPanel
                      doc={liveDoc}
                      onPick={(id) => mapRef.current?.focusNode(id)}
                    />
                  ),
                });
              if (panels.statsOpen)
                entries.push({
                  key: "stats",
                  label: PANEL_LABELS.stats.tab,
                  onClose: () => panels.setStatsOpen(false),
                  node: <StatsPanel doc={liveDoc} />,
                });
              if (panels.agendaOpen)
                entries.push({
                  key: "agenda",
                  label: PANEL_LABELS.agenda.tab,
                  onClose: () => panels.setAgendaOpen(false),
                  node: (
                    <AgendaPanel
                      doc={liveDoc}
                      today={todayISO()}
                      onPick={(id) => mapRef.current?.focusNode(id)}
                    />
                  ),
                });
              if (panels.mapsOpen)
                entries.push({
                  key: "maps",
                  label: PANEL_LABELS.maps.tab,
                  onClose: () => panels.setMapsOpen(false),
                  node: (
                    <MapsPanel maps={maps} currentId={doc.id} onOpen={(id) => void switchMap(id)} />
                  ),
                });
              if (panels.inboxOpen)
                entries.push({
                  key: "inbox",
                  label: PANEL_LABELS.inbox.tab,
                  onClose: () => panels.setInboxOpen(false),
                  node: (
                    <InboxPanel
                      items={inbox.items}
                      canFile={!!liveDoc}
                      onCapture={inbox.add}
                      onFile={(id, text) => {
                        mapRef.current?.addFloatingTopic(text);
                        inbox.remove(id);
                      }}
                      onDiscard={inbox.remove}
                    />
                  ),
                });
              if (panels.deckEditorOpen)
                entries.push({
                  key: "deck",
                  label: PANEL_LABELS.deck.tab,
                  onClose: () => panels.setDeckEditorOpen(false),
                  node: (
                    <SlideDeckEditorPanel
                      deck={deckRows(liveDoc)}
                      topics={outlineRows(liveDoc.root)}
                      isCustom={hasCustomDeck(liveDoc)}
                      onChange={(slides) => mapRef.current?.setSlides(slides)}
                      onRestoreDefault={() => mapRef.current?.setSlides([])}
                    />
                  ),
                });
              if (panels.noteEditorOpen)
                entries.push({
                  key: "note",
                  label: PANEL_LABELS.note.tab,
                  onClose: () => panels.setNoteEditorOpen(false),
                  node: (
                    <NoteEditorPanel
                      selected={selected}
                      value={noteDraft}
                      onChange={onNoteChange}
                      onBlur={flushNote}
                      onClose={() => panels.setNoteEditorOpen(false)}
                      onOpenLink={followInAppLink}
                      spellCheck={panels.spellcheck}
                    />
                  ),
                });
              if (panels.filterOpen)
                entries.push({
                  key: "filter",
                  label: PANEL_LABELS.filter.tab,
                  onClose: () => panels.toggleFilter(),
                  node: (
                    <FilterPanel
                      root={liveDoc.root}
                      floatingTopics={liveDoc.floatingTopics}
                      text={filter.text}
                      markers={filter.markers}
                      tags={filter.tags}
                      due={filter.due}
                      priority={filter.priority}
                      completion={filter.completion}
                      matchCount={filterHits?.matches ?? 0}
                      savedFilters={savedFilters.list}
                      onText={filter.setText}
                      onToggleMarker={filter.toggleMarker}
                      onToggleTag={filter.toggleTag}
                      onDue={filter.setDue}
                      onPriority={filter.setPriority}
                      onCompletion={filter.setCompletion}
                      relDir={filter.relDir}
                      relType={filter.relType}
                      onRelDir={filter.setRelDir}
                      onRelType={filter.setRelType}
                      hide={filter.hide}
                      onHide={filter.setHide}
                      onExtract={extractFilterMatches}
                      onClear={filter.clear}
                      onSaveFilter={savedFilters.save}
                      onApplyFilter={savedFilters.apply}
                      onDeleteFilter={savedFilters.remove}
                    />
                  ),
                });
              if (panels.stylesOpen)
                entries.push({
                  key: "styles",
                  label: PANEL_LABELS.styles.tab,
                  onClose: () => panels.setStylesOpen(false),
                  node: (
                    <StylesPanel
                      rules={liveDoc.rules ?? []}
                      markers={MARKER_PALETTE}
                      namedStyles={namedStyles}
                      onAddRule={(rule) =>
                        mapRef.current?.setRules([...(liveDoc.rules ?? []), rule])
                      }
                      onDeleteRule={(id) =>
                        mapRef.current?.setRules((liveDoc.rules ?? []).filter((r) => r.id !== id))
                      }
                      onSaveStyle={saveNamedStyle}
                      onApplyStyle={(style) => {
                        const ok = mapRef.current?.setSelectedStyle(style);
                        if (!ok) showHint(t("hint.selectTopicForStyle"));
                      }}
                      onDeleteStyle={deleteNamedStyle}
                    />
                  ),
                });
              if (panels.historyOpen)
                entries.push({
                  key: "history",
                  label: PANEL_LABELS.history.tab,
                  onClose: () => panels.setHistoryOpen(false),
                  node: (
                    <HistoryPanel
                      versions={versions}
                      onSaveNow={saveVersionNow}
                      onPlay={startPlayback}
                      onRestore={restoreVersion}
                      onClose={() => panels.setHistoryOpen(false)}
                    />
                  ),
                });
              return (
                <PanelDock
                  entries={entries}
                  active={activeDock}
                  onActivate={setActiveDock}
                  width={panels.dockWidth}
                  onResize={panels.setDockWidth}
                />
              );
            })()}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <MindMap
                key={playback ? `pb:${playback.index}` : `${doc.id}:${restoreRev}`}
                ref={mapRef}
                doc={playback ? playback.snaps[playback.index].doc : doc}
                // Restore this tab's stashed viewport + undo/redo on a switch-back (never during
                // history playback). Consumed one-shot by the effect below so a later version-restore
                // remount starts fresh, not from a stale session.
                initialSession={playback ? undefined : sessionCache.current.get(doc.id)}
                theme={theme.theme}
                direction={layout}
                numbered={panels.numbered}
                spellcheck={panels.spellcheck}
                litIds={playback ? null : litIds}
                hideUnmatched={!playback && filter.hide && panels.filterOpen}
                highlightIds={playback ? null : searchMatchIds}
                drillId={playback ? null : drillId}
                libraryMaps={maps.map((m) => ({ id: m.id, title: m.title }))}
                reducedMotion={reducedMotion}
                activeView={panels.boardOpen ? "board" : panels.outlineOpen ? "outline" : "map"}
                onSetView={(view) => {
                  // A one-click peer switch (MindManager's status-bar view buttons): each choice is
                  // exclusive of the other two — Board is a full-canvas overlay, so it and the Outline
                  // dock never show at once, and picking Map clears both back to the plain canvas.
                  panels.setBoardOpen(view === "board");
                  panels.setOutlineOpen(view === "outline");
                }}
                onChange={(d) => {
                  if (playback) return; // read-only while reviewing history
                  liveDocRef.current = d;
                  setLiveDoc(d);
                  scheduleSave();
                  // If this map is bound to a disk file, mark it unsaved-to-disk and write through.
                  if (handleCache.current.has(d.id)) {
                    setDirty(true);
                    scheduleFileSave();
                  }
                  if (!firstRunSeen) dismissFirstRun(); // the first edit retires the tips card (#13)
                }}
                onSelect={handleSelect}
                onSelectionCount={setSelectedCount}
                onSelectionFields={setSelectionFields}
                onSelectionMarkerTags={setSelectionMarkerTags}
                onSelectEdge={setSelectedEdge}
                onSelectOverlay={setSelectedOverlay}
                onOpenNote={() => {
                  panels.setInfoMinimized(false);
                  panels.setInfoOpen(true);
                  bumpNoteNonce();
                }}
                onMapLink={(id, nodeId) => {
                  // Cross-map topic link: focus the target node once the new map mounts (the
                  // pendingFocus effect, keyed on doc). If it's already the current map, focus directly —
                  // switchMap early-returns on the same id, so pendingFocus would never fire.
                  if (id === liveDocRef.current.id) {
                    if (nodeId) mapRef.current?.focusNode(nodeId);
                  } else {
                    if (nodeId) pendingFocus.current = nodeId;
                    void switchMap(id);
                  }
                }}
                onDropFilesOnNode={async (id, files) => {
                  // An image becomes the topic's picture (first image wins); everything else attaches.
                  try {
                    let usedImage = false;
                    for (const file of files) {
                      if (!usedImage && file.type.startsWith("image/")) {
                        mapRef.current?.setNodeImage(id, await fileToMapImage(file));
                        usedImage = true;
                      } else {
                        mapRef.current?.addNodeAttachment(id, await fileToAttachment(file));
                      }
                    }
                  } catch (err) {
                    showHint(err instanceof Error ? err.message : t("hint.fileFailed"));
                  }
                }}
                onExportBranch={(id) => setBranchExportId(id)}
                onHistory={(u, r) => {
                  setCanUndo(u);
                  setCanRedo(r);
                }}
                onDelete={(topic, descendants) => {
                  const detail =
                    descendants > 0
                      ? ` and ${descendants} sub-topic${descendants === 1 ? "" : "s"}`
                      : "";
                  showToast("info", `Deleted “${topic}”${detail}`, {
                    action: { label: t("cmd.undo"), run: () => mapRef.current?.undo() },
                  });
                }}
                onHint={showHint}
              />
              {/* First-run tips (#13) — overlays the canvas for a brand-new user; gone after the
                  first edit or an explicit dismiss. */}
              {!firstRunSeen ? <FirstRunCard onDismiss={dismissFirstRun} /> : null}
              {/* Find & Replace overlay — top-right of the canvas, non-modal (Ctrl/⌘+F or "/"). */}
              {findOpen ? (
                <FindReplaceOverlay find={toolbarProps.find} onClose={() => setFindOpen(false)} />
              ) : null}
              {/* Kanban board overlays the canvas (the map stays mounted underneath). */}
              {panels.boardOpen && (
                <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
                  <Kanban
                    doc={liveDoc}
                    onPick={(id) => {
                      panels.setBoardOpen(false);
                      mapRef.current?.focusNode(id);
                    }}
                    onRetag={(id, tags) => mapRef.current?.setNodeTags(id, tags)}
                    onSetMarkers={(id, icons) => mapRef.current?.setNodeMarkers(id, icons)}
                    onSetDue={(id, due) => mapRef.current?.setNodeDue(id, due)}
                    onClose={() => panels.setBoardOpen(false)}
                  />
                </div>
              )}
              {/* Version-history timeline playback overlay (the canvas above shows the snapshot). */}
              {playback && (
                <PlaybackBar
                  index={playback.index}
                  count={playback.snaps.length}
                  playing={playback.playing}
                  label={`${playback.index + 1} / ${playback.snaps.length} · ${timeAgo(
                    playback.snaps[playback.index].ts,
                  )}`}
                  onPlayPause={() =>
                    setPlayback((p) =>
                      p ? { ...p, ...togglePlay(p.index, p.snaps.length, p.playing) } : p,
                    )
                  }
                  onStep={(delta) =>
                    setPlayback((p) =>
                      p
                        ? {
                            ...p,
                            index: clampIndex(p.index + delta, p.snaps.length),
                            playing: false,
                          }
                        : p,
                    )
                  }
                  onSeek={(i) =>
                    setPlayback((p) =>
                      p ? { ...p, index: clampIndex(i, p.snaps.length), playing: false } : p,
                    )
                  }
                  onRestore={() => {
                    const id = playback.snaps[playback.index].id;
                    setPlayback(null);
                    void restoreVersion(id);
                  }}
                  onExit={() => setPlayback(null)}
                />
              )}
              {guidedWalk.index != null && guidedWalk.node && !playback ? (
                <WalkBar
                  index={guidedWalk.index}
                  total={guidedWalk.total}
                  topic={guidedWalk.node.topic}
                  note={guidedWalk.node.note}
                  onPrev={() => guidedWalk.step(-1)}
                  onNext={() => guidedWalk.step(1)}
                  onExit={guidedWalk.exit}
                  cinematic={guidedWalk.cinematic}
                  onToggleCinematic={guidedWalk.toggleCinematic}
                />
              ) : null}
            </div>
          </div>
          {panels.infoOpen ? (
            selectedEdge ? (
              <EdgeInspector
                edge={selectedEdge}
                fromTopic={edgeTopics.from}
                toTopic={edgeTopics.to}
                width={panels.inspectorWidth}
                onResize={panels.setInspectorWidth}
                onSetLabel={(label) => mapRef.current?.setLinkLabel(label)}
                onSetArrow={(arrow) => mapRef.current?.setLinkArrow(arrow)}
                onSetStyle={(patch) => mapRef.current?.setLinkStyle(patch)}
                onToggleShowTypes={(on) => mapRef.current?.setShowLinkTypes(on)}
                onDelete={() => mapRef.current?.deleteLink()}
                onMinimize={() => {
                  panels.setInfoOpen(false);
                  panels.setInfoMinimized(true);
                }}
              />
            ) : selectedOverlay ? (
              <OverlayInspector
                overlay={selectedOverlay}
                caption={overlayCaption}
                width={panels.inspectorWidth}
                onResize={panels.setInspectorWidth}
                onSetLabel={(label) => mapRef.current?.setOverlayLabel(label)}
                onSetColor={(color) => mapRef.current?.setOverlayColor(color)}
                onSetShape={(shape) => mapRef.current?.setOverlayShape(shape)}
                onSetDash={(dash) => mapRef.current?.setOverlayDash(dash)}
                onDelete={() => mapRef.current?.deleteOverlay()}
                onMinimize={() => {
                  panels.setInfoOpen(false);
                  panels.setInfoMinimized(true);
                }}
              />
            ) : selected ? (
              <InfoPanel
                selected={selected}
                selectedCount={selectedCount}
                fields={selectionFields}
                openNoteNonce={noteNonce}
                width={panels.inspectorWidth}
                onResize={panels.setInspectorWidth}
                breadcrumb={inspectorInfo.breadcrumb}
                facts={inspectorInfo.facts}
                times={inspectorInfo.times}
                node={selectedNode}
                noteDraft={noteDraft}
                onNoteChange={onNoteChange}
                onNoteBlur={flushNote}
                onOpenLink={followInAppLink}
                onExpandNote={() => panels.setNoteEditorOpen(() => true)}
                markers={MARKER_PALETTE}
                onToggleMarker={(mk) => {
                  const ok = mapRef.current?.toggleSelectedIcon(mk);
                  if (!ok) showHint(t("hint.selectNodeForMarker"));
                }}
                bulkMarkers={selectionMarkerTags?.markers}
                bulkTags={selectionMarkerTags?.tags}
                onBulkToggleMarker={(mk) => mapRef.current?.bulkToggleSelectedIcon(mk)}
                onBulkToggleTag={(t) => mapRef.current?.bulkToggleSelectedTag(t)}
                onPickSticker={(s) => {
                  const ok = mapRef.current?.setSelectedImage(stickerImage(s));
                  if (!ok) showHint(t("hint.selectNodeForSticker"));
                }}
                onStyle={(patch) => {
                  const ok = mapRef.current?.setSelectedStyle(patch);
                  if (!ok) showHint(t("hint.selectNodeForStyle"));
                }}
                onBranchColor={(color) => {
                  const ok = mapRef.current?.setSelectedBranchColor(color);
                  if (!ok) showHint(t("hint.selectNodeForBranchColour"));
                }}
                namedStyles={namedStyles}
                onSetFillImage={async (file) => {
                  try {
                    const { url } = await fileToMapImage(file);
                    const ok = mapRef.current?.setSelectedStyle({ fillImage: url });
                    if (!ok) showHint(t("hint.selectTopicForFillImage"));
                  } catch (err) {
                    showHint(err instanceof Error ? err.message : t("hint.fillImageFailed"));
                  }
                }}
                onClearFillImage={() => mapRef.current?.setSelectedStyle({ fillImage: "" })}
                spellCheck={panels.spellcheck}
                onAddTag={(t) => {
                  const cur = selectedNode?.tags ?? [];
                  if (!cur.includes(t)) mapRef.current?.setSelectedTags([...cur, t]);
                }}
                onRemoveTag={(t) =>
                  mapRef.current?.setSelectedTags((selectedNode?.tags ?? []).filter((x) => x !== t))
                }
                allTags={allTags}
                onSetProgress={(progress) => {
                  const ok = mapRef.current?.setSelectedProgress(progress);
                  if (!ok) showHint(t("hint.selectNodeForProgress"));
                }}
                onSetDue={(d) => {
                  const ok = mapRef.current?.setSelectedDue(d);
                  if (!ok) showHint(t("hint.selectNodeForDue"));
                }}
                onSetStart={(d) => {
                  const ok = mapRef.current?.setSelectedStart(d);
                  if (!ok) showHint(t("hint.selectNodeForStart"));
                }}
                onSetPriority={(p) => {
                  const ok = mapRef.current?.setSelectedPriority(p);
                  if (!ok) showHint(t("hint.selectNodeForPriority"));
                }}
                onAddAttachment={async (file) => {
                  try {
                    const att = await fileToAttachment(file);
                    const ok = mapRef.current?.addSelectedAttachment(att);
                    if (!ok) showHint(t("hint.selectNodeForAttachment"));
                  } catch (err) {
                    showHint(err instanceof Error ? err.message : t("hint.attachFailed"));
                  }
                }}
                onRemoveAttachment={(i) => mapRef.current?.removeSelectedAttachment(i)}
                onSetHyperlink={(url) => {
                  const ok = mapRef.current?.setSelectedHyperlink(url);
                  if (!ok) showHint(t("hint.selectNodeForLink"));
                }}
                onAddHyperlink={(url) => {
                  const ok = mapRef.current?.addSelectedHyperlink(url);
                  if (!ok) showHint(t("hint.selectNodeForLink"));
                }}
                onRemoveHyperlink={(i) => mapRef.current?.removeSelectedHyperlink(i)}
                maps={maps
                  .filter((mm) => mm.id !== doc.id)
                  .map((mm) => ({ id: mm.id, title: mm.title }))}
                onLinkMap={(mapId) =>
                  mapRef.current?.setSelectedHyperlink(`${MAP_LINK_PREFIX}${mapId}`)
                }
                jumpTargets={outlineRows(liveDoc.root)
                  .filter((r) => r.id !== selected?.id)
                  .map((r) => ({ id: r.id, topic: r.topic, depth: r.depth }))}
                onJump={(id) => mapRef.current?.setSelectedHyperlink(`${NODE_LINK_PREFIX}${id}`)}
                crossLinkMapId={crossLinkMapId}
                crossLinkTopics={crossLinkTopics}
                backlinks={backlinks}
                outgoingLinks={outgoingLinks}
                onFollowBacklink={(id) => mapRef.current?.focusNode(id)}
                crossMapBacklinks={crossMapBacklinks}
                onFollowCrossMapBacklink={(mapId, nodeId) => {
                  pendingFocus.current = nodeId;
                  void switchMap(mapId);
                }}
                onMinimize={() => {
                  panels.setInfoOpen(false);
                  panels.setInfoMinimized(true);
                }}
              />
            ) : (
              <MapPanel
                doc={liveDoc}
                theme={theme}
                setThemeId={setThemeId}
                customThemes={customThemes}
                onManageThemes={() => setThemeDesignerOpen(true)}
                onApplyDesign={applyDesign}
                layout={layout}
                changeLayout={changeLayout}
                freeform={liveDoc.meta?.freeform}
                background={liveDoc.meta?.background}
                onSetBackground={(c) => mapRef.current?.setBackground(c)}
                accentColor={liveDoc.meta?.accentColor}
                onSetAccentColor={(c) => mapRef.current?.setAccentColor(c)}
                onSetBackgroundImage={(u) => mapRef.current?.setBackgroundImage(u)}
                handleBackgroundImage={handleBackgroundImage}
                lineJumps={!!liveDoc.meta?.lineJumps}
                onToggleLineJumps={() => mapRef.current?.setLineJumps(!liveDoc.meta?.lineJumps)}
                onSetConnectorStyle={(s) => mapRef.current?.setConnectorStyle(s)}
                onSetBranchGrowth={(w) => mapRef.current?.setBranchGrowth(w)}
                onSetFontFamily={(f) => mapRef.current?.setFontFamily(f)}
                onSetFontScale={(s) => mapRef.current?.setFontScale(s)}
                onSetBackdrop={(k) => mapRef.current?.setBackdrop(k)}
                onRenameMap={(t) => mapRef.current?.renameMap(t)}
                onBackdropRings={(d) => mapRef.current?.setBackdropRings(d)}
                onSetBackdropColor={(c) => mapRef.current?.setBackdropColor(c)}
                onClearBackdrop={() => mapRef.current?.clearBackdrop()}
                filteredCount={filterHits?.matches}
                width={panels.inspectorWidth}
                onResize={panels.setInspectorWidth}
                onMinimize={() => {
                  panels.setInfoOpen(false);
                  panels.setInfoMinimized(true);
                }}
              />
            )
          ) : panels.infoMinimized ? (
            <InspectorRail
              onExpand={() => {
                panels.setInfoMinimized(false);
                panels.setInfoOpen(true);
              }}
            />
          ) : null}
        </div>
      </div>

      {presentDoc && (
        <Suspense fallback={null}>
          <Presentation doc={presentDoc} onExit={() => setPresentDoc(null)} />
        </Suspense>
      )}

      {/* Search all maps — controlled <Dialog>; on open, load every map (live current map merged over
          its saved copy) so search sees the latest edits, then focus the query field. */}
      <Dialog
        open={searchAllOpen}
        onClose={() => setSearchAllOpen(false)}
        onOpen={() => {
          (document.querySelector('input[aria-label="Search query"]') as HTMLInputElement)?.focus();
          (async () => {
            const all = await getAllMaps().catch(() => [] as MindMapDoc[]);
            const live = liveDocRef.current;
            setLibDocs([live, ...all.filter((d) => d.id !== live.id)]);
          })();
        }}
        ariaLabel={t("search.title")}
        style={{
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          padding: "18px 20px",
          maxWidth: 520,
          width: "calc(100% - 32px)",
          color: "var(--ed-ink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 15, flex: 1 }}>{t("search.title")}</strong>
          <button
            type="button"
            onClick={() => setSearchAllOpen(false)}
            style={controlStyle}
            aria-label={t("search.close")}
          >
            ✕
          </button>
        </div>
        <input
          value={libQuery}
          onChange={(e) => setLibQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          // The operator list stays literal: `tag:`, `marker:`, `due:overdue` are SYNTAX the user
          // types, not prose — the same reasoning that keeps physical key names literal in the cheat
          // sheet. Only the sentence introducing them is a message.
          title={`${t("search.operatorsHelp")}\ntag:foo  marker:flag-red  priority:1  due:overdue  has:note  level:>=2  -exclude  "exact phrase"`}
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          aria-label={t("search.queryLabel")}
        />
        {libQuery.trim() && (
          <SearchResults
            rows={searchLibrary(libDocs, libQuery).map((h) => ({
              key: `${h.mapId}:${h.nodeId}`,
              topic: h.topic,
              path: h.path,
              snippet: h.snippet,
              mapTitle: h.mapTitle,
              payload: h,
            }))}
            onPick={goToHit}
          />
        )}
      </Dialog>

      {/* About — controlled <Dialog>; the browser handles modal semantics, focus trap and Esc. */}
      <Dialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        ariaLabel={t("cmd.about")}
        style={{
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          padding: "22px 24px",
          maxWidth: 440,
          width: "calc(100% - 32px)",
          color: "var(--ed-ink)",
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>{t("about.appName")}</h2>
          <button
            type="button"
            onClick={() => setAboutOpen(false)}
            style={controlStyle}
            aria-label={t("about.close")}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "8px 0 14px", color: "var(--ed-muted)", fontSize: 13 }}>
          {t("about.tagline")}
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 13 }}>© 2026 Dann Bleeker Pedersen</p>
        <div style={{ fontSize: 13, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t("about.licenseHeading")}</div>
          <div>{t("about.licenseCode")}</div>
          <div>{t("about.licenseBook")}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13 }}>
          <a href="/user-guide.html" target="_blank" rel="noopener noreferrer">
            {t("about.userGuide")}
          </a>
          <a href="/Thinking-in-Maps.pdf" target="_blank" rel="noopener noreferrer">
            {t("app.bookPdf")}
          </a>
          <a href="/Thinking-in-Maps.epub" target="_blank" rel="noopener noreferrer">
            {t("app.bookEpub")}
          </a>
          <a href="/notices.html" target="_blank" rel="noopener noreferrer">
            {t("about.thirdParty")}
          </a>
          <a href="/dashboard.html" target="_blank" rel="noopener noreferrer">
            {t("about.dashboard")}
          </a>
          <a href="https://github.com/KIDULTANK/iThread" target="_blank" rel="noopener noreferrer">
            {t("about.source")}
          </a>
        </div>
        <div
          style={{
            marginTop: 16,
            borderTop: "1px solid var(--ed-border)",
            paddingTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              // Close so the result toast (top of the app) isn't hidden behind the modal.
              setAboutOpen(false);
              void checkForUpdates();
            }}
            style={controlStyle}
          >
            {t("about.checkUpdates")}
          </button>
          {/* Renders only when installation is offered (otherwise nothing). */}
          {aboutOpen && (
            <Suspense fallback={null}>
              <InstallButton className="mm-install-about" />
            </Suspense>
          )}
        </div>
      </Dialog>

      {/* Keyboard shortcuts cheat-sheet (#2) — opened from the icon-rail (?) and ⌘K. */}
      {shortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsDialog open onClose={() => setShortcutsOpen(false)} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <AltShortcutOverlay enabled={view === "editor" && !shortcutsOpen} />
      </Suspense>

      {/* "Export this branch…" format picker (B4), scoped to the chosen subtree. Lazy: only mounted
          (and fetched) once a branch export is chosen, so it stays out of the entry bundle. */}
      {branchExportId != null && (
        <Suspense fallback={null}>
          <BranchExportDialog
            nodeId={branchExportId}
            mapRef={mapRef}
            getDoc={() => liveDocRef.current}
            numbered={() => panels.numbered}
            showHint={showHint}
            onClose={() => setBranchExportId(null)}
          />
        </Suspense>
      )}

      {/* Custom theme designer (C3) — lazy; refreshes the theme list on save/delete/import. */}
      {themeDesignerOpen && (
        <Suspense fallback={null}>
          <ThemeDesignerDialog
            onClose={() => setThemeDesignerOpen(false)}
            onChange={reloadCustomThemes}
          />
        </Suspense>
      )}

      {/* Host for the imperative themed prompt/confirm (editorPrompt / editorConfirm) used across the
          canvas + panels in place of native window.prompt/confirm. */}
      <DialogHost />

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDialog
            open
            onClose={() => setSettingsOpen(false)}
            appearance={appearance}
            setAppearance={setAppearance}
            motionPref={motionPref}
            setMotionPref={setMotionPref}
            contrastPref={contrastPref}
            setContrastPref={setContrastPref}
            onReShowGettingStarted={reShowFirstRun}
            onClearRecents={() => {
              clearRecents();
              showHint(t("hint.commandHistoryCleared"));
            }}
            onClearBranchClipboard={() => {
              clearBranch();
              showHint(t("hint.branchClipboardCleared"));
            }}
            onExportSettings={() => {
              const file = collectSettings(new Date().toISOString());
              const keys = settingsKeysIn(file);
              if (keys.length === 0) {
                showHint(t("settings.prefsFile.nothingToExport"));
                return;
              }
              downloadBlob(
                new Blob([serializeSettings(file)], { type: "application/json" }),
                "ithread-preferences.json",
              );
              showHint(
                t("settings.prefsFile.exported", {
                  count: t("count.preferences", { n: keys.length }),
                }),
              );
            }}
            onImportSettings={(f) => {
              void (async () => {
                let parsed: SettingsFile;
                try {
                  parsed = parseSettingsFile(await f.text());
                } catch (err) {
                  setError(err instanceof Error ? err.message : t("settings.prefsFile.unreadable"));
                  return;
                }
                const keys = settingsKeysIn(parsed);
                if (keys.length === 0) {
                  setError(t("settings.prefsFile.unusable"));
                  return;
                }
                // Preferences are read at mount, so applying them needs a reload to take effect —
                // confirm first, and say exactly how many are being replaced.
                const ok = await editorConfirm({
                  title: t("settings.prefsFile.confirmTitle"),
                  body: t("settings.prefsFile.confirmBody", {
                    count: t("count.preferences", { n: keys.length }),
                  }),
                  confirmText: t("settings.prefsFile.confirmAction"),
                });
                if (!ok) return;
                applySettings(parsed);
                location.reload();
              })();
            }}
            onClearAllData={clearAllLocalData}
          />
        </Suspense>
      )}

      {/* Paste text → map — controlled <Dialog>; focus the textarea on open. (No drop shadow here —
          the original Paste dialog had none, so cancel the shared base shadow.) */}
      <Dialog
        open={paste.open}
        onClose={() => paste.setOpen(false)}
        onOpen={() =>
          (
            document.querySelector(
              'textarea[aria-label="Paste outline text"]',
            ) as HTMLTextAreaElement
          )?.focus()
        }
        style={{ padding: 0, width: "min(560px, 92vw)" }}
      >
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ color: "var(--ed-ink)" }}>{t("cmd.paste-topics")}</strong>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ed-muted)" }}>
            {tNodes("app.pasteOutlineExplain", {
              hashHeadings: <code>#</code>,
              tagsColumn: <code>{t("common.tags")}</code>,
            })}
          </p>
          <textarea
            value={paste.text}
            onChange={(e) => paste.setText(e.target.value)}
            placeholder={t("app.pasteOutlinePlaceholder")}
            aria-label={t("paste.inputLabel")}
            rows={10}
            style={{
              resize: "vertical",
              border: "1px solid var(--ed-border)",
              borderRadius: 8,
              padding: 8,
              fontSize: 13,
              fontFamily: "ui-monospace, monospace",
              color: "var(--ed-ink)",
              background: "var(--ed-card)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--ed-muted)" }}>
              {t("count.topics", { n: paste.count })}
            </span>
            <span style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => paste.setOpen(false)}
                style={{ ...controlStyle, background: "var(--ed-card)" }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={paste.addUnderSelected}
                disabled={!selected}
                style={controlStyle}
                title={
                  selected
                    ? t("paste.addUnder", { topic: selected.topic })
                    : t("hint.selectNodeShort")
                }
              >
                ➕ {t("app.addUnderSelected")}
              </button>
              <button type="button" onClick={paste.addAsNewMap} style={controlStyle}>
                {"📋 "}
                {t("common.newMap")}
              </button>
            </span>
          </div>
        </div>
      </Dialog>

      {/* In-editor ⌘K command palette — every toolbar action as a searchable command. */}
      {cmdkOpen && (
        <CommandPalette
          commands={buildEditorCommands(toolbarProps)}
          onClose={() => setCmdkOpen(false)}
          placeholder={t("palette.placeholder")}
          // When a topic is selected these kinds are enabled, so ⌘K (empty query) leads with the
          // node-scoped actions under a "For the selected topic" header.
          contextKinds={["node", "marker", "priority"]}
        />
      )}
    </div>
  );
}
