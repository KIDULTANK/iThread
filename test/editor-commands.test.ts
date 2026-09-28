import { type RefObject, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ToolbarProps } from "../src/components/Toolbar";
import { buildEditorCommands } from "../src/components/editorCommands";
import type { MindMapHandle, SelectedNode } from "../src/mindmap";
import { themeById } from "../src/mindmap/theme";
import type { MindMapDoc } from "../src/model/types";

// buildEditorCommands — the editor's ⌘K registry. It's a pure function over the toolbar prop groups,
// so the test drives it with mocked groups and asserts: the catalogue is exhaustive (every export
// format / panel / layout), each command defers to the right handler, ids are unique, and the
// selection-dependent actions carry `enabled` that tracks the selection.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "m1",
  title: "Map",
  root: { id: "root", topic: "Map", children: [] },
};

function mockHandle(): MindMapHandle {
  const cache = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy({} as MindMapHandle, {
    get: (_t, prop) => {
      if (!cache.has(prop)) cache.set(prop, vi.fn());
      return cache.get(prop);
    },
  });
}

function mkProps(selected: SelectedNode | null = null): ToolbarProps {
  const handle = mockHandle();
  const mapRef = createRef<MindMapHandle>() as RefObject<MindMapHandle | null>;
  mapRef.current = handle;
  const io = Object.fromEntries(
    [
      "exportJson",
      "exportMarkdown",
      "exportMermaid",
      "exportXmind",
      "exportSmmx",
      "exportMmap",
      "exportIthoughts",
      "exportOpml",
      "exportFreemind",
      "exportPng",
      "exportSvg",
      "exportHtml",
      "exportInteractiveHtml",
      "exportDeck",
      "exportPdf",
      "exportPdfFile",
      "exportDocx",
      "exportPptx",
      "exportXlsx",
      "exportLibrary",
      "copyOutline",
      "copyTable",
      "copyDeepLink",
      "copyPng",
      "handleFile",
      "openFile",
      "saveFile",
      "saveFileAs",
    ].map((k) => [k, vi.fn()]),
  ) as unknown as ToolbarProps["io"];
  return {
    isMobile: false,
    mapRef,
    nav: {
      goHome: vi.fn(),
      openAbout: vi.fn(),
      openShortcuts: vi.fn(),
      openSearchAll: vi.fn(),
      openPaste: vi.fn(),
      openFind: vi.fn(),
      openSettings: vi.fn(),
      reShowGettingStarted: vi.fn(),
      navBack: vi.fn(),
      navForward: vi.fn(),
      canBack: true,
      canForward: false,
    },
    panels: {
      outlineOpen: false,
      setOutlineOpen: vi.fn(),
      indexOpen: false,
      setIndexOpen: vi.fn(),
      filterOpen: false,
      toggleFilter: vi.fn(),
      stylesOpen: false,
      setStylesOpen: vi.fn(),
      relationshipsOpen: false,
      setRelationshipsOpen: vi.fn(),
      historyOpen: false,
      setHistoryOpen: vi.fn(),
      boardOpen: false,
      setBoardOpen: vi.fn(),
      statsOpen: false,
      setStatsOpen: vi.fn(),
      agendaOpen: false,
      setAgendaOpen: vi.fn(),
      mapsOpen: false,
      setMapsOpen: vi.fn(),
      inboxOpen: false,
      setInboxOpen: vi.fn(),
      deckEditorOpen: false,
      setDeckEditorOpen: vi.fn(),
      noteEditorOpen: false,
      setNoteEditorOpen: vi.fn(),
      infoOpen: false,
      setInfoOpen: vi.fn(),
      infoMinimized: false,
      setInfoMinimized: vi.fn(),
      numbered: false,
      setNumbered: vi.fn(),
      spellcheck: false,
      setSpellcheck: vi.fn(),
    },
    map: {
      doc,
      liveDoc: doc,
      maps: [],
      mapOptions: [],
      switchMap: vi.fn(),
      load: vi.fn(),
      duplicateMap: vi.fn(),
      deleteCurrent: vi.fn(),
      promoteBranch: vi.fn(),
      mergeMap: vi.fn(),
      present: vi.fn(),
      refreshRollupsNow: vi.fn(),
    },
    canvas: {
      theme: themeById("light"),
      setThemeId: vi.fn(),
      layout: "side",
      changeLayout: vi.fn(),
      selected,
      setFocus: vi.fn(),
      handleImage: vi.fn(),
      handleBackgroundImage: vi.fn(),
      copyFormat: vi.fn(),
      pasteFormat: vi.fn(),
      canPasteFormat: false,
      shuffleBranchColors: vi.fn(),
      openMapPanel: vi.fn(),
      drillIn: vi.fn(),
      exportBranch: vi.fn(),
      startWalk: vi.fn(),
      alignSelection: vi.fn(),
      distributeSelection: vi.fn(),
      selectedCount: 0,
      freeform: false,
    },
    find: {
      query: "",
      setQuery: vi.fn(),
      replaceWith: "",
      setReplaceWith: vi.fn(),
      replaceScope: "topics" as const,
      setReplaceScope: vi.fn(),
      useRegex: false,
      setUseRegex: vi.fn(),
      matchCase: false,
      setMatchCase: vi.fn(),
      matchInfo: "",
      matches: [],
      activeId: null,
      goTo: vi.fn(),
      runSearch: vi.fn(),
      findNext: vi.fn(),
      findPrev: vi.fn(),
      runReplace: vi.fn(),
    },
    io,
    views: { list: [], onSave: vi.fn(), onApply: vi.fn(), onDelete: vi.fn() },
    history: { canUndo: false, canRedo: false, undo: vi.fn(), redo: vi.fn() },
    showHint: vi.fn(),
  };
}

const byId = (props: ToolbarProps) => new Map(buildEditorCommands(props).map((c) => [c.id, c]));

describe("buildEditorCommands", () => {
  it("has unique ids and a non-trivial command set", () => {
    const cmds = buildEditorCommands(mkProps());
    const ids = cmds.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(cmds.length).toBeGreaterThan(40);
  });

  it("covers every export format (23) and each defers to its io handler", () => {
    const props = mkProps();
    const cmds = buildEditorCommands(props);
    const exports = cmds.filter((c) => c.kind === "export");
    // 17 original + png @2×/@4×/transparent + pdf fit/A4 (the print PDF replaced the old single .pdf).
    expect(exports).toHaveLength(23);
    byId(props).get("export:json")?.run();
    expect(props.io.exportJson).toHaveBeenCalled();
    byId(props).get("export:pptx")?.run();
    expect(props.io.exportPptx).toHaveBeenCalled();
    byId(props).get("export:ithoughts")?.run();
    expect(props.io.exportIthoughts).toHaveBeenCalled();
    // The PNG-scale + direct-PDF variants defer to the right io calls (items 6, 7).
    byId(props).get("export:png2x")?.run();
    expect(props.io.exportPng).toHaveBeenCalledWith({ scale: 2 });
    byId(props).get("export:pdf-fit")?.run();
    expect(props.io.exportPdfFile).toHaveBeenCalledWith({ pageSize: "fit" });
  });

  it("covers all 14 side-panel toggles and all 11 layouts", () => {
    const cmds = buildEditorCommands(mkProps());
    // 10 original + agenda/maps/inbox/deck (item 19 — Panels-menu parity in ⌘K).
    expect(cmds.filter((c) => c.kind === "panel")).toHaveLength(14);
    expect(cmds.filter((c) => c.kind === "layout")).toHaveLength(11);
    for (const id of ["panel-agenda", "panel-maps", "panel-inbox", "panel-deck"])
      expect(cmds.some((c) => c.id === id)).toBe(true);
  });

  it("view + map commands defer to the handle / handlers", () => {
    const props = mkProps();
    const cmds = byId(props);
    cmds.get("fit")?.run();
    expect(props.mapRef.current?.fit).toHaveBeenCalled();
    cmds.get("collapse-all")?.run();
    expect(props.mapRef.current?.setAllExpanded).toHaveBeenCalledWith(false);
    cmds.get("present")?.run();
    expect(props.map.present).toHaveBeenCalled();
    cmds.get("layout:timeline")?.run();
    expect(props.canvas.changeLayout).toHaveBeenCalledWith("timeline");
    cmds.get("panel-outline")?.run();
    expect(props.panels.setOutlineOpen).toHaveBeenCalled();
  });

  it("nav back/forward defer to handlers and gate on canBack/canForward", () => {
    const props = mkProps();
    const cmds = byId(props);
    cmds.get("nav-back")?.run();
    expect(props.nav.navBack).toHaveBeenCalled();
    cmds.get("nav-forward")?.run();
    expect(props.nav.navForward).toHaveBeenCalled();
    // mkProps sets canBack:true, canForward:false.
    expect(cmds.get("nav-back")?.enabled).toBe(true);
    expect(cmds.get("nav-forward")?.enabled).toBe(false);
  });

  it("copy-deep-link defers to io and relabels by selection", () => {
    const props = mkProps({ id: "n1", topic: "N", note: "" });
    const cmd = byId(props).get("copy-deep-link");
    expect(cmd?.label).toBe("Copy link to this topic");
    cmd?.run();
    expect(props.io.copyDeepLink).toHaveBeenCalled();
    expect(byId(mkProps(null)).get("copy-deep-link")?.label).toBe("Copy link to this map");
  });

  it("focus / group / summary are disabled without a selection, enabled with one", () => {
    const none = byId(mkProps(null));
    for (const id of ["focus-branch", "insert-group", "insert-summary"])
      expect(none.get(id)?.enabled, id).toBe(false);

    const withSel = byId(mkProps({ id: "n1", topic: "N", note: "" }));
    for (const id of ["focus-branch", "insert-group", "insert-summary"])
      expect(withSel.get(id)?.enabled, id).toBe(true);
  });

  it("a selection-gated command acts on the selected node when run", () => {
    const props = mkProps({ id: "n1", topic: "N", note: "" });
    byId(props).get("insert-group")?.run();
    expect(props.mapRef.current?.groupBranch).toHaveBeenCalledWith("n1");
  });

  it("offers sort-children commands (gated on a selection) that defer to the handle", () => {
    expect(byId(mkProps(null)).get("sort-children:alpha")?.enabled).toBe(false);
    const props = mkProps({ id: "n1", topic: "N", note: "" });
    byId(props).get("sort-children:due")?.run();
    expect(props.mapRef.current?.sortChildren).toHaveBeenCalledWith("n1", "due");
  });

  it("offers a 'Copy map as image' command that defers to io.copyPng", () => {
    const props = mkProps();
    byId(props).get("copy-image")?.run();
    expect(props.io.copyPng).toHaveBeenCalled();
  });

  it("lists a cross-map switch command for every OTHER library map (not the open one)", () => {
    const props = mkProps();
    // liveDoc is the open map (id "m1"); the library also holds "m2".
    props.map.maps = [
      { id: "m1", title: "Map" },
      { id: "m2", title: "Other map" },
    ];
    const cmds = byId(props);
    expect(cmds.get("map-switch:m1")).toBeUndefined(); // the open map isn't offered
    const other = cmds.get("map-switch:m2");
    expect(other?.label).toBe("Switch to map: Other map");
    other?.run();
    expect(props.map.switchMap).toHaveBeenCalledWith("m2");
  });

  it("groups the ⌘K switch/merge rows by folder — labelled, sorted, and searchable by folder (C2)", () => {
    const props = mkProps();
    // Library: two foldered maps + one loose, plus the open map (filtered out).
    props.map.maps = [
      { id: "m1", title: "Map" }, // the open map (liveDoc.id === "m1")
      { id: "loose", title: "Loose plan" },
      { id: "mkt-b", title: "Budget", folderId: "f1", folderName: "Marketing" },
      { id: "mkt-a", title: "Ads", folderId: "f1", folderName: "Marketing" },
    ];
    const cmds = buildEditorCommands(props);
    const switches = cmds.filter((c) => c.id.startsWith("map-switch:"));

    // Order: top-level first (empty folder sorts first), then by folder name, then by title.
    expect(switches.map((c) => c.id)).toEqual([
      "map-switch:loose",
      "map-switch:mkt-a",
      "map-switch:mkt-b",
    ]);
    // A foldered map reads "<folder> / <map>"; a loose one is bare.
    const byId = new Map(cmds.map((c) => [c.id, c]));
    expect(byId.get("map-switch:loose")?.label).toBe("Switch to map: Loose plan");
    expect(byId.get("map-switch:mkt-a")?.label).toBe("Switch to map: Marketing / Ads");
    expect(byId.get("merge-map:mkt-a")?.label).toBe("Insert map as branch: Marketing / Ads");
    // The folder name is folded into keywords so ⌘K surfaces a whole folder by name.
    expect(byId.get("map-switch:mkt-a")?.keywords).toContain("Marketing");
    expect(byId.get("merge-map:mkt-b")?.keywords).toContain("Marketing");
    // Running still defers to the right handler.
    byId.get("map-switch:mkt-a")?.run();
    expect(props.map.switchMap).toHaveBeenCalledWith("mkt-a");
  });

  it("promotes a branch (selection-gated) and merges other maps as a branch", () => {
    // Promote needs a selection.
    expect(byId(mkProps(null)).get("promote-branch")?.enabled).toBe(false);
    const props = mkProps({ id: "n1", topic: "N", note: "" });
    props.map.maps = [
      { id: "m1", title: "Map" },
      { id: "m2", title: "Other map" },
    ];
    const cmds = byId(props);
    cmds.get("promote-branch")?.run();
    expect(props.map.promoteBranch).toHaveBeenCalled();
    // Merge: one command per OTHER map, gated on the selection, deferring to mergeMap(id).
    expect(cmds.get("merge-map:m1")).toBeUndefined(); // not the open map
    const merge = cmds.get("merge-map:m2");
    expect(merge?.label).toBe("Insert map as branch: Other map");
    merge?.run();
    expect(props.map.mergeMap).toHaveBeenCalledWith("m2");
  });

  it("exposes a 'Keyboard shortcuts' command that opens the cheat-sheet (#2)", () => {
    const props = mkProps();
    byId(props).get("shortcuts")?.run();
    expect(props.nav.openShortcuts).toHaveBeenCalled();
  });

  it("exposes a 'getting-started' command that re-shows the first-run tips (O8)", () => {
    const props = mkProps();
    byId(props).get("getting-started")?.run();
    expect(props.nav.reShowGettingStarted).toHaveBeenCalled();
  });

  it("offers a jump-to-topic command per topic that selects + centres on run (#12)", () => {
    const props = mkProps();
    const jump = byId(props).get("jump:root");
    expect(jump?.kind).toBe("topic");
    expect(jump?.enabled).toBe(true); // jump is always available
    jump?.run();
    expect(props.mapRef.current?.focusNode).toHaveBeenCalledWith("root");
  });

  it("every command's run() executes without throwing (selection + freeform present)", () => {
    const props = mkProps({ id: "root", topic: "Map", note: "" });
    // Enable the free-canvas arrange commands so their bodies run, not just the disabled shells.
    props.canvas.freeform = true;
    props.canvas.selectedCount = 3;
    const cmds = buildEditorCommands(props);
    for (const c of cmds) expect(() => c.run(), c.id).not.toThrow();
    // The sweep actually drove handlers (sanity: not a no-op proxy that swallows everything).
    expect(props.showHint).toHaveBeenCalled();
  });

  it("insert-map-part hints 'select a topic first' with no selection", () => {
    const props = mkProps(null);
    const part = buildEditorCommands(props).find((c) => c.id.startsWith("map-part:"));
    part?.run();
    expect(props.showHint).toHaveBeenCalledWith("Select a topic first.");
  });

  it("toggle-line-jumps flips the per-map flag through the handle", () => {
    const props = mkProps();
    byId(props).get("toggle-line-jumps")?.run();
    expect(props.mapRef.current?.setLineJumps).toHaveBeenCalledWith(true); // doc flag is unset → on
  });

  it("offers a jump command for floating topics too (#12)", () => {
    const props = mkProps();
    props.map.liveDoc = {
      ...doc,
      floatingTopics: [{ id: "f1", topic: "Detached", children: [] }],
    };
    const jump = byId(props).get("jump:f1");
    expect(jump?.kind).toBe("topic");
    jump?.run();
    expect(props.mapRef.current?.focusNode).toHaveBeenCalledWith("f1");
  });

  it("gates add-child / delete / marker / priority on a selection and routes them (#12)", () => {
    const gatedIds = ["node-add-child", "node-delete", "node-marker:⭐", "node-priority:1"];
    const none = byId(mkProps(null));
    for (const id of gatedIds) expect(none.get(id)?.enabled, id).toBe(false);

    const props = mkProps({ id: "n1", topic: "N", note: "" });
    const cmds = byId(props);
    for (const id of gatedIds) expect(cmds.get(id)?.enabled, id).toBe(true);
    cmds.get("node-add-child")?.run();
    expect(props.mapRef.current?.addChildToSelected).toHaveBeenCalled();
    cmds.get("node-delete")?.run();
    expect(props.mapRef.current?.deleteSelected).toHaveBeenCalled();
    cmds.get("node-marker:⭐")?.run();
    expect(props.mapRef.current?.toggleSelectedIcon).toHaveBeenCalledWith("⭐");
    cmds.get("node-priority:1")?.run();
    expect(props.mapRef.current?.setSelectedPriority).toHaveBeenCalledWith(1);
  });

  // Localisation: every label comes from the catalogue now. Building the registry is itself the
  // completeness check — t() throws in dev on a missing key — so this adds what that would NOT catch:
  // a placeholder that never got substituted, which would ship "Layout: {name}" to a user.
  it("resolves every command label with no key or placeholder leaking", () => {
    const cmds = buildEditorCommands(mkProps({ id: "n1", topic: "N", note: "" }));
    expect(cmds.length).toBeGreaterThan(40);
    for (const c of cmds) {
      expect(c.label.length, c.id).toBeGreaterThan(0);
      expect(c.label, `${c.id} leaks a raw message key`).not.toMatch(/^(cmd|hint)\./);
      expect(c.label, `${c.id} has an unsubstituted placeholder`).not.toMatch(/\{\w+\}/);
    }
  });
});
