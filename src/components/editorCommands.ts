import { compareText, t } from "../i18n";
import { MARKER_PALETTE } from "../icons";
import { MAP_PARTS, buildMapPart } from "../mapParts";
import type { LayoutKind } from "../mindmap";
import { type SortKey, findAnyNode } from "../mindmap/flow/ops";
import type { MapNode } from "../model/types";
import { PRIORITY_LEVELS, priorityLabel } from "../priority";
import { SHORTCUT_BINDINGS } from "../shortcuts";
import type { Command } from "./CommandPalette";
import type { ToolbarProps } from "./Toolbar";

/** Walk every topic in the doc (central tree + floating subtrees) for the jump-to-topic palette. */
function* walkTopics(node: MapNode): Generator<MapNode> {
  yield node;
  for (const c of node.children) yield* walkTopics(c);
}

/** A one-line, length-capped preview of a topic for a palette row. */
function topicLabel(topic: string): string {
  // `text`, not `t` — the local shadowed the imported translation function, which is why the fallback
  // below stayed hardcoded through the main migration pass: `t("…")` was unreachable in this scope.
  const text = topic.replace(/\s+/g, " ").trim() || t("common.untitled");
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

// The editor command registry — one flat `Command[]`, 1:1 with the toolbar's actions, built from the
// SAME prop groups App already hands `<Toolbar>` (so there's no second source of truth). Drives the
// in-editor ⌘K palette. Selection-dependent actions carry `enabled` so the palette hides them when
// nothing is selected. Pure + side-effect-free to build (each `run` defers to the existing handler),
// so it's trivially unit-testable.

// `label` is a getter: a plain `label: t("…")` in this module-scope array would resolve ONCE at
// import and never follow a later `setLocale`. `id` (the palette entry's identity) stays literal.
const LAYOUTS: { id: LayoutKind; label: string }[] = [
  {
    id: "side",
    get label() {
      return t("cmd.layout.side");
    },
  },
  {
    id: "right",
    get label() {
      return t("cmd.layout.right");
    },
  },
  {
    id: "left",
    get label() {
      return t("cmd.layout.left");
    },
  },
  {
    id: "radial",
    get label() {
      return t("cmd.layout.radial");
    },
  },
  {
    id: "org-down",
    get label() {
      return t("cmd.layout.org-down");
    },
  },
  {
    id: "org-up",
    get label() {
      return t("cmd.layout.org-up");
    },
  },
  {
    id: "timeline",
    get label() {
      return t("cmd.layout.timeline");
    },
  },
  {
    id: "fishbone",
    get label() {
      return t("cmd.layout.fishbone");
    },
  },
  {
    id: "grid",
    get label() {
      return t("cmd.layout.grid");
    },
  },
  {
    id: "swimlane",
    get label() {
      return t("cmd.layout.swimlane");
    },
  },
  {
    id: "brace",
    get label() {
      return t("cmd.layout.brace");
    },
  },
];

const EXPORTS = (io: ToolbarProps["io"]): [string, string, () => void][] => [
  ["json", t("cmd.export.json"), io.exportJson],
  ["md", t("cmd.export.md"), io.exportMarkdown],
  ["opml", t("cmd.export.opml"), io.exportOpml],
  ["freemind", t("cmd.export.freemind"), io.exportFreemind],
  ["mermaid", t("cmd.export.mermaid"), io.exportMermaid],
  ["xmind", t("cmd.export.xmind"), io.exportXmind],
  ["smmx", t("cmd.export.smmx"), io.exportSmmx],
  ["mmap", t("cmd.export.mmap"), io.exportMmap],
  ["ithoughts", t("cmd.export.ithoughts"), io.exportIthoughts],
  ["png", t("cmd.export.png"), () => io.exportPng()],
  ["png2x", t("cmd.export.png2x"), () => io.exportPng({ scale: 2 })],
  ["png4x", t("cmd.export.png4x"), () => io.exportPng({ scale: 4 })],
  ["png-transparent", t("cmd.export.png-transparent"), () => io.exportPng({ transparent: true })],
  ["svg", t("cmd.export.svg"), io.exportSvg],
  ["html", t("cmd.export.html"), io.exportHtml],
  ["ihtml", t("cmd.export.ihtml"), io.exportInteractiveHtml],
  ["pdf-fit", t("cmd.export.pdf-fit"), () => io.exportPdfFile({ pageSize: "fit" })],
  [
    "pdf-a4",
    t("cmd.export.pdf-a4"),
    () => io.exportPdfFile({ pageSize: "a4", orientation: "landscape" }),
  ],
  ["pdf-print", t("cmd.export.pdf-print"), io.exportPdf],
  ["docx", t("cmd.export.docx"), io.exportDocx],
  ["xlsx", t("cmd.export.xlsx"), io.exportXlsx],
  ["deck", t("cmd.export.deck"), io.exportDeck],
  ["pptx", t("cmd.export.pptx"), io.exportPptx],
];

/** Build the editor's command list from the toolbar prop groups (the same object App passes Toolbar). */
export function buildEditorCommands(props: ToolbarProps): Command[] {
  const { mapRef, nav, panels, map, canvas, io, history, showHint } = props;
  const m = () => mapRef.current;
  const sel = canvas.selected;
  const cmds: Command[] = [];
  const add = (
    id: string,
    label: string,
    kind: string,
    run: () => void,
    enabled = true,
    extra?: { keywords?: string },
  ) => cmds.push({ id, label, kind, run, enabled, shortcut: SHORTCUT_BINDINGS[id], ...extra });

  // Map / file
  add("open-file", t("cmd.open-file"), "map", () => io.openFile());
  add("save-file", t("cmd.save-file"), "map", () => io.saveFile());
  add("save-file-as", t("cmd.save-file-as"), "map", () => io.saveFileAs());
  add("present", t("cmd.present"), "map", () => map.present());
  add("duplicate-map", t("cmd.duplicate-map"), "map", () => map.duplicateMap());
  add("delete-map", t("cmd.delete-map"), "map", () => map.deleteCurrent());
  add("refresh-rollups", t("cmd.refresh-rollups"), "map", () => map.refreshRollupsNow());
  add("search-all", t("cmd.search-all"), "map", () => nav.openSearchAll());
  add("nav-back", t("cmd.nav-back"), "nav", () => nav.navBack(), nav.canBack, {
    keywords: "history previous backward alt left",
  });
  add("nav-forward", t("cmd.nav-forward"), "nav", () => nav.navForward(), nav.canForward, {
    keywords: "history next forward alt right",
  });
  add("paste-topics", t("cmd.paste-topics"), "map", () => nav.openPaste());
  add("copy-outline", t("cmd.copy-outline"), "map", () => io.copyOutline());
  add("copy-table", t("cmd.copy-table"), "map", () => io.copyTable());
  add(
    "copy-deep-link",
    sel ? t("cmd.copy-deep-link.topic") : t("cmd.copy-deep-link.map"),
    "map",
    () => io.copyDeepLink(),
    true,
    { keywords: "deep link url share permalink node" },
  );
  add("copy-image", t("cmd.copy-image"), "map", () => io.copyPng(), true, {
    keywords: "png picture clipboard screenshot paste",
  });
  add("backup", t("cmd.backup"), "map", () => io.exportLibrary());
  add("shortcuts", t("cmd.shortcuts"), "map", () => nav.openShortcuts());
  add("settings", t("cmd.settings"), "map", () => nav.openSettings());
  add("about", t("cmd.about"), "map", () => nav.openAbout());
  add("getting-started", t("cmd.getting-started"), "map", () => nav.reShowGettingStarted(), true, {
    keywords: "onboarding tutorial first run 3 things to try help tips",
  });

  // Edit history
  add("undo", t("cmd.undo"), "edit", () => history.undo(), history.canUndo);
  add("redo", t("cmd.redo"), "edit", () => history.redo(), history.canRedo);

  // View
  add("fit", t("cmd.fit"), "view", () => m()?.fit());
  add(
    "balance-map",
    t("cmd.balance-map"),
    "view",
    () => m()?.balanceMap(),
    canvas.layout === "side" && !map.liveDoc.meta?.freeform,
  );
  add("guided-walk", t("cmd.guided-walk"), "view", () => canvas.startWalk());
  add(
    "isolate-branch",
    t("cmd.isolate-branch"),
    "view",
    () => {
      if (sel) m()?.isolateBranch(sel.id);
    },
    !!sel,
  );
  for (const p of MAP_PARTS)
    add(
      `map-part:${p.id}`,
      t("cmd.mapPart", { name: p.name }),
      "view",
      () => {
        const part = buildMapPart(p.id);
        const ok = part ? m()?.addSubtreeToSelected(part) : false;
        showHint(ok ? t("hint.mapPartInserted", { name: p.name }) : t("hint.selectTopicFirst"));
      },
      !!sel,
    );
  add("collapse-all", t("cmd.collapse-all"), "view", () => m()?.setAllExpanded(false));
  add("expand-all", t("cmd.expand-all"), "view", () => m()?.setAllExpanded(true));
  for (const n of [1, 2, 3, 4, 5])
    add(`expand-level:${n}`, t("cmd.expandLevel", { n }), "view", () => m()?.setExpandedToLevel(n));
  add("copy-format", t("cmd.copy-format"), "view", () => canvas.copyFormat(), !!sel);
  add(
    "paste-format",
    t("cmd.paste-format"),
    "view",
    () => canvas.pasteFormat(),
    !!sel && canvas.canPasteFormat,
  );
  add("auto-colour-branches", t("cmd.auto-colour-branches"), "view", () =>
    canvas.shuffleBranchColors(),
  );
  add(
    "focus-branch",
    t("cmd.focus-branch"),
    "view",
    () => {
      if (sel) canvas.setFocus({ id: sel.id, topic: sel.topic });
    },
    !!sel,
  );
  add("drill-in", t("cmd.drill-in"), "view", () => canvas.drillIn(), !!sel);
  // Export the selected branch (B4) — only for a non-leaf, non-root topic (a lone topic has nothing
  // to scope; the whole-map export already covers it).
  const selNode = sel ? findAnyNode(map.liveDoc, sel.id) : null;
  add(
    "export-branch",
    t("cmd.export-branch"),
    "view",
    () => {
      if (sel) canvas.exportBranch(sel.id);
    },
    !!selNode && selNode.id !== map.liveDoc.root.id && selNode.children.length > 0,
  );
  // Arrange (free-canvas only) — needs 2+ selected to align, 3+ to distribute.
  const canAlign = canvas.freeform && canvas.selectedCount >= 2;
  const canDistribute = canvas.freeform && canvas.selectedCount >= 3;
  for (const [mode, label] of [
    ["left", t("cmd.align.left")],
    ["hcenter", t("cmd.align.hcenter")],
    ["right", t("cmd.align.right")],
    ["top", t("cmd.align.top")],
    ["vmiddle", t("cmd.align.vmiddle")],
    ["bottom", t("cmd.align.bottom")],
  ] as const)
    add(`align:${mode}`, label, "view", () => canvas.alignSelection(mode), canAlign);
  add(
    "distribute-h",
    t("cmd.distribute-h"),
    "view",
    () => canvas.distributeSelection("h"),
    canDistribute,
  );
  add(
    "distribute-v",
    t("cmd.distribute-v"),
    "view",
    () => canvas.distributeSelection("v"),
    canDistribute,
  );
  add("toggle-numbering", t("cmd.toggle-numbering"), "view", () => panels.setNumbered((v) => !v));
  add("toggle-spellcheck", t("cmd.toggle-spellcheck"), "view", () =>
    panels.setSpellcheck((v) => !v),
  );
  add("toggle-line-jumps", t("cmd.toggle-line-jumps"), "view", () =>
    m()?.setLineJumps(!map.liveDoc.meta?.lineJumps),
  );

  // Side panels
  add("panel-outline", t("cmd.panel-outline"), "panel", () => panels.setOutlineOpen((v) => !v));
  add("panel-index", t("cmd.panel-index"), "panel", () => panels.setIndexOpen((v) => !v));
  add("panel-filter", t("cmd.panel-filter"), "panel", () => panels.toggleFilter());
  add("panel-styles", t("cmd.panel-styles"), "panel", () => panels.setStylesOpen((v) => !v));
  add("panel-relationships", t("cmd.panel-relationships"), "panel", () =>
    panels.setRelationshipsOpen((v) => !v),
  );
  add("panel-history", t("cmd.panel-history"), "panel", () => panels.setHistoryOpen((v) => !v));
  add("panel-board", t("cmd.panel-board"), "panel", () => panels.setBoardOpen((v) => !v));
  add("panel-stats", t("cmd.panel-stats"), "panel", () => panels.setStatsOpen((v) => !v));
  add("panel-note-editor", t("cmd.panel-note-editor"), "panel", () =>
    panels.setNoteEditorOpen((v) => !v),
  );
  add("panel-info", t("cmd.panel-info"), "panel", () => {
    const shown = panels.infoOpen || panels.infoMinimized;
    panels.setInfoMinimized(() => false);
    panels.setInfoOpen(() => !shown);
  });
  // Parity with the Panels menu (item 19): these four were reachable only from the menu, not ⌘K.
  add("panel-agenda", t("cmd.panel-agenda"), "panel", () => panels.setAgendaOpen((v) => !v));
  add("panel-maps", t("cmd.panel-maps"), "panel", () => panels.setMapsOpen((v) => !v));
  add("panel-inbox", t("cmd.panel-inbox"), "panel", () => panels.setInboxOpen((v) => !v));
  add("panel-deck", t("cmd.panel-deck"), "panel", () => panels.setDeckEditorOpen((v) => !v));

  // Insert
  add("insert-sticky", t("cmd.insert-sticky"), "insert", () => {
    m()?.addStickyNote();
    showHint(t("hint.stickyAdded"));
  });
  add(
    "insert-group",
    t("cmd.insert-group"),
    "insert",
    () => {
      if (sel) m()?.groupBranch(sel.id);
    },
    !!sel,
  );
  add(
    "insert-group-selection",
    t("cmd.insert-group-selection"),
    "insert",
    () => {
      m()?.groupSelection();
    },
    canvas.selectedCount >= 2,
  );
  add(
    "insert-summary",
    t("cmd.insert-summary"),
    "insert",
    () => {
      if (sel) m()?.groupSummary(sel.id);
    },
    !!sel,
  );

  // Selected node — shown only when a node is selected (Command.enabled). These give mouse-free
  // parity with the right-click menu: add a child, set a marker/priority, or delete. (#12)
  add("node-add-child", t("cmd.node-add-child"), "node", () => m()?.addChildToSelected(), !!sel);
  add(
    "start-relationship",
    t("cmd.start-relationship"),
    "node",
    () => m()?.startLinkFromSelected(),
    !!sel,
  );
  add("node-delete", t("cmd.node-delete"), "node", () => m()?.deleteSelected(), !!sel);
  for (const marker of MARKER_PALETTE)
    add(
      `node-marker:${marker}`,
      t("cmd.marker", { marker }),
      "marker",
      () => m()?.toggleSelectedIcon(marker),
      !!sel,
    );
  for (const p of PRIORITY_LEVELS)
    add(
      `node-priority:${p}`,
      t("cmd.priority", { level: priorityLabel(p) }),
      "priority",
      () => m()?.setSelectedPriority(p),
      !!sel,
    );
  add(
    "node-priority:clear",
    t("cmd.node-priority-clear"),
    "priority",
    () => m()?.setSelectedPriority(undefined),
    !!sel,
  );
  // Reorder the selected topic's direct children by a key (topic / priority / due / progress).
  const SORTS: [SortKey, string][] = [
    ["alpha", t("cmd.sortBy.alpha")],
    ["priority", t("cmd.sortBy.priority")],
    ["due", t("cmd.sortBy.due")],
    ["progress", t("cmd.sortBy.progress")],
  ];
  for (const [key, label] of SORTS)
    add(
      `sort-children:${key}`,
      t("cmd.sortChildren", { by: label }),
      "node",
      () => {
        if (sel) m()?.sortChildren(sel.id, key);
      },
      !!sel,
    );

  // Jump to any topic — fuzzy over the topic text AND its note (keywords), then select + centre it.
  for (const n of walkTopics(map.liveDoc.root))
    add(
      `jump:${n.id}`,
      t("cmd.goTo", { topic: topicLabel(n.topic) }),
      "topic",
      () => m()?.focusNode(n.id),
      true,
      {
        keywords: `${n.topic} ${n.note ?? ""}`,
      },
    );
  for (const f of map.liveDoc.floatingTopics ?? [])
    for (const n of walkTopics(f))
      add(
        `jump:${n.id}`,
        t("cmd.goTo", { topic: topicLabel(n.topic) }),
        "topic",
        () => m()?.focusNode(n.id),
        true,
        { keywords: `${n.topic} ${n.note ?? ""}` },
      );

  // Restructure across maps: promote the selected branch to its own map, or merge another library
  // map in as a branch under the selection.
  add("promote-branch", t("cmd.promote-branch"), "map", () => map.promoteBranch(), !!sel);

  // Switch to another library map from the keyboard (the cross-map half of the quick switcher; the
  // in-map "Go to" rows above cover topics within the active map). Skips the map already open. The
  // same other-maps list also powers "Insert map as branch" (merge), gated on a selection. Grouped by
  // library folder (C2): rows sort by folder name then title so a folder's maps cluster, a foldered map
  // reads "<folder> / <map>", and the folder name is folded into the keywords so ⌘K finds a whole
  // folder by name. Top-level maps (no folder) sort first.
  const otherMaps = map.maps
    .filter((summary) => summary.id !== map.liveDoc.id)
    .slice()
    .sort(
      (a, b) =>
        compareText(a.folderName ?? "", b.folderName ?? "") ||
        compareText(a.title || "", b.title || ""),
    );
  for (const summary of otherMaps) {
    // No `|| "(untitled)"` here — `topicLabel` already substitutes it for an empty title.
    const title = topicLabel(summary.title);
    const label = summary.folderName ? `${summary.folderName} / ${title}` : title;
    const folderKw = summary.folderName ? `folder ${summary.folderName}` : "";
    add(
      `map-switch:${summary.id}`,
      t("cmd.switchMap", { title: label }),
      "map",
      () => map.switchMap(summary.id),
      true,
      {
        keywords: folderKw,
      },
    );
    add(
      `merge-map:${summary.id}`,
      t("cmd.mergeMap", { title: label }),
      "map",
      () => map.mergeMap(summary.id),
      !!sel,
      { keywords: `merge insert graft subtree under ${folderKw}` },
    );
  }

  // Layout
  for (const l of LAYOUTS)
    add(`layout:${l.id}`, t("cmd.layout", { name: l.label }), "layout", () =>
      canvas.changeLayout(l.id),
    );

  // Export
  for (const [id, label, fn] of EXPORTS(io))
    add(`export:${id}`, t("cmd.exportAs", { format: label }), "export", fn);

  return cmds;
}
