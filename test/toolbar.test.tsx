import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../src/components/Toolbar";
import { type Locale, registerMessages, setLocale } from "../src/i18n";
import type { MindMapHandle, SelectedNode } from "../src/mindmap";
import { themeById } from "../src/mindmap/theme";
import type { MindMapDoc } from "../src/model/types";

// Toolbar — the redesigned two-row top bar. A pure prop-driven view, so the test drives it entirely
// through mocked prop groups + a mocked canvas handle and asserts each control / menu item calls the
// right callback. Covers row 1 (file/identity), row 2 (view/edit/canvas menus), find + quick-add.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "m1",
  title: "Map One",
  root: { id: "root", topic: "Map One", children: [] },
};

function mockHandle(): MindMapHandle {
  // Memoise one spy per method so the test asserts the same spy the component called.
  const cache = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy({} as MindMapHandle, {
    get: (_t, prop) => {
      if (!cache.has(prop)) cache.set(prop, vi.fn());
      return cache.get(prop);
    },
  });
}

function setup(
  over: {
    selected?: SelectedNode | null;
    isMobile?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    freeform?: boolean;
    selectedCount?: number;
    numbered?: boolean;
  } = {},
) {
  const handle = mockHandle();
  const mapRef = createRef<MindMapHandle>() as RefObject<MindMapHandle | null>;
  mapRef.current = handle;
  const nav = {
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
    canBack: false,
    canForward: false,
  };
  const panels = {
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
    numbered: over.numbered ?? false,
    setNumbered: vi.fn(),
    spellcheck: false,
    setSpellcheck: vi.fn(),
  };
  const map = {
    doc,
    liveDoc: doc,
    maps: [
      { id: "m1", title: "Map One" },
      { id: "m2", title: "Map Two" },
    ],
    mapOptions: [
      { id: "m1", title: "Map One" },
      { id: "m2", title: "Map Two" },
    ],
    switchMap: vi.fn(),
    load: vi.fn(),
    duplicateMap: vi.fn(),
    deleteCurrent: vi.fn(),
    promoteBranch: vi.fn(),
    mergeMap: vi.fn(),
    present: vi.fn(),
    refreshRollupsNow: vi.fn(),
  };
  const canvas = {
    theme: themeById("light"),
    setThemeId: vi.fn(),
    layout: "side" as const,
    changeLayout: vi.fn(),
    selected: over.selected ?? null,
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
    selectedCount: over.selectedCount ?? 0,
    freeform: over.freeform ?? false,
  };
  const find = {
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
    runSearch: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
    findNext: vi.fn(),
    findPrev: vi.fn(),
    runReplace: vi.fn(),
  };
  const io = {
    ...Object.fromEntries(
      [
        "exportJson",
        "exportMarkdown",
        "exportMermaid",
        "exportXmind",
        "exportSmmx",
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
        "openRecentFile",
      ].map((k) => [k, vi.fn()]),
    ),
    recentFiles: [],
  } as unknown as Parameters<typeof Toolbar>[0]["io"];
  const showHint = vi.fn();
  const views = { list: [], onSave: vi.fn(), onApply: vi.fn(), onDelete: vi.fn() };
  const history = {
    canUndo: over.canUndo ?? false,
    canRedo: over.canRedo ?? false,
    undo: vi.fn(),
    redo: vi.fn(),
  };
  render(
    <Toolbar
      isMobile={over.isMobile ?? false}
      mapRef={mapRef}
      nav={nav}
      panels={panels}
      map={map}
      canvas={canvas}
      find={find}
      io={io}
      views={views}
      history={history}
      showHint={showHint}
    />,
  );
  return { handle, nav, panels, map, canvas, find, io, views, history, showHint };
}

const u = userEvent.setup();

describe("Toolbar — row 1 (file/identity)", () => {
  it("renders the map switcher, +New, All maps, Export and More", () => {
    setup();
    expect(screen.getByLabelText("Open map")).toBeTruthy();
    expect(screen.getByLabelText(/New map from a template/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /all maps/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^export/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^more/i })).toBeTruthy();
  });

  it("switches maps + opens All maps", async () => {
    const t = setup();
    await u.selectOptions(screen.getByLabelText("Open map"), "m2");
    expect(t.map.switchMap).toHaveBeenCalledWith("m2");
    await u.click(screen.getByRole("button", { name: /all maps/i }));
    expect(t.nav.openSearchAll).toHaveBeenCalled();
  });

  it("disables Undo/Redo when there's no history, enables + fires them when there is (#8)", async () => {
    setup();
    expect((screen.getByRole("button", { name: /undo \(/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: /redo \(/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    cleanup();
    const t = setup({ canUndo: true, canRedo: true });
    await u.click(screen.getByRole("button", { name: /undo \(/i }));
    expect(t.history.undo).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: /redo \(/i }));
    expect(t.history.redo).toHaveBeenCalled();
  });

  it("loads a new map from the +New template menu", async () => {
    const t = setup();
    await u.selectOptions(screen.getByLabelText(/New map from a template/i), "swot");
    expect(t.map.load).toHaveBeenCalledTimes(1);
  });

  it("opens Find & Replace from the toolbar button", async () => {
    const t = setup();
    // Find & Replace now lives in an overlay (Ctrl/⌘+F or "/"); the toolbar just opens it.
    await u.click(screen.getByRole("button", { name: "Find" }));
    expect(t.nav.openFind).toHaveBeenCalled();
  });
});

describe("Toolbar — Export menu", () => {
  it("opens and dispatches per-format handlers", async () => {
    const t = setup();
    await u.click(screen.getByRole("button", { name: /^export/i }));
    await u.click(screen.getByRole("menuitem", { name: /\.json/i }));
    expect(t.io.exportJson).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: /^export/i }));
    await u.click(screen.getByRole("menuitem", { name: /\.pptx/i }));
    expect(t.io.exportPptx).toHaveBeenCalled();
  });

  it("pins the last-used format atop the menu and re-runs it", async () => {
    localStorage.removeItem("mindmap-last-export");
    const t = setup();
    // First export records the format…
    await u.click(screen.getByRole("button", { name: /^export/i }));
    await u.click(screen.getByRole("menuitem", { name: /\.pptx/i }));
    expect(t.io.exportPptx).toHaveBeenCalledTimes(1);
    // …so reopening shows a pinned "Last: …pptx" row that re-runs it (read fresh on open).
    await u.click(screen.getByRole("button", { name: /^export/i }));
    await u.click(await screen.findByRole("menuitem", { name: /^Last:.*pptx/i }));
    expect(t.io.exportPptx).toHaveBeenCalledTimes(2);
  });

  it("keeps resolving the last-used format across a locale change", async () => {
    // THE REGRESSION GUARD. "Last used" persisted the rendered LABEL under "mindmap-last-export" and
    // matched it back with `lbl === last`. A label is not an identity — it follows the locale — so a
    // user who exported in English, then switched the app to Danish, would find the pinned row simply
    // gone: the stored English label no longer matched any (now-Danish) export entry, and the feature
    // would silently never fire again for that install. Persisting the stable id fixes it.
    localStorage.removeItem("mindmap-last-export");
    registerMessages("da" as Locale, { "cmd.export.pptx": "PowerPoint (da)" });

    const t = setup();
    await u.click(screen.getByRole("button", { name: /^export/i }));
    await u.click(screen.getByRole("menuitem", { name: /\.pptx/i }));
    expect(t.io.exportPptx).toHaveBeenCalledTimes(1);

    setLocale("da" as Locale);
    cleanup();
    const t2 = setup();
    await u.click(screen.getByRole("button", { name: /^export/i }));
    // Still resolves and still re-runs the SAME format — because the id survived the locale change,
    // even though the label it was recorded under no longer exists in any catalogue.
    await u.click(await screen.findByRole("menuitem", { name: /^Last:.*PowerPoint \(da\)/i }));
    expect(t2.io.exportPptx).toHaveBeenCalledTimes(1);

    setLocale("en");
  });
});

describe("Toolbar — More menu", () => {
  it("dispatches map + file actions", async () => {
    const t = setup();
    const open = () => u.click(screen.getByRole("button", { name: /^more/i }));
    await open();
    await u.click(screen.getByRole("menuitem", { name: /^present/i }));
    expect(t.map.present).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /duplicate map/i }));
    expect(t.map.duplicateMap).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /delete map/i }));
    expect(t.map.deleteCurrent).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /copy outline/i }));
    expect(t.io.copyOutline).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /back up/i }));
    expect(t.io.exportLibrary).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /about/i }));
    expect(t.nav.openAbout).toHaveBeenCalled();
  });

  it("exposes Settings + Keyboard shortcuts and shows shortcut chips on the File items (#P4)", async () => {
    const t = setup();
    const open = () => u.click(screen.getByRole("button", { name: /^more/i }));
    await open();
    // The shortcut moved out of the label into an aria-hidden chip; the accessible name is clean.
    expect(screen.getByRole("menuitem", { name: "Open file…" })).toBeTruthy();
    expect(screen.getByText("Ctrl/⌘ + O")).toBeTruthy(); // the chip itself
    // Settings + Keyboard-shortcuts were threaded into nav but rendered nowhere before — now in More.
    await u.click(screen.getByRole("menuitem", { name: /settings & preferences/i }));
    expect(t.nav.openSettings).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /keyboard shortcuts/i }));
    expect(t.nav.openShortcuts).toHaveBeenCalled();
  });

  it("the Import-files item is a real menuitem button that opens the hidden file input (a11y 2.1.1)", async () => {
    setup();
    await u.click(screen.getByRole("button", { name: /^more/i }));
    // A real <button role=menuitem>, not a <label> wrapping a hidden input — natively keyboard-operable.
    const item = screen.getByRole("menuitem", { name: /import files/i });
    expect(item.tagName).toBe("BUTTON");
    const input = document.getElementById("mmap-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(item);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: /import files/i })).toBeNull();
    expect(document.getElementById("mmap-input")).toBe(input);
  });
});

describe("Toolbar — row 2 (view/edit/canvas)", () => {
  it("View menu: fit / collapse / expand + the labelled display toggles (#4)", async () => {
    const t = setup();
    // Fit / collapse / expand are folded into the View menu (one labelled dropdown, not 4 icons).
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitem", { name: /fit map/i }));
    expect(t.handle.fit).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitem", { name: /collapse all/i }));
    expect(t.handle.setAllExpanded).toHaveBeenCalledWith(false);
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitem", { name: /expand all/i }));
    expect(t.handle.setAllExpanded).toHaveBeenCalledWith(true);
    // The display toggles now live in the View menu as labelled checkboxes (moved off the cramped,
    // non-mnemonic Row-2 icon strip). They keep the menu open (closeOnSelect=false).
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitemcheckbox", { name: /outline numbering/i }));
    expect(t.panels.setNumbered).toHaveBeenCalled();
    await u.click(screen.getByRole("menuitemcheckbox", { name: /line jumps/i }));
    expect(t.handle.setLineJumps).toHaveBeenCalled();
    await u.click(screen.getByRole("menuitemcheckbox", { name: /legend/i }));
    expect(t.handle.setLegend).toHaveBeenCalled();
    await u.click(screen.getByRole("menuitemcheckbox", { name: /spell-check/i }));
    expect(t.panels.setSpellcheck).toHaveBeenCalled();
  });

  it("View menu: the numbering-style toggle appears once numbering is on (#4)", async () => {
    const t = setup({ numbered: true });
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitem", { name: /numbering style/i }));
    expect(t.handle.setNumberStyle).toHaveBeenCalled();
  });

  it("View menu: the Arrange group shows only in free-canvas mode (#4)", async () => {
    // Not freeform → no Arrange group.
    setup();
    await u.click(screen.getByRole("button", { name: /^view/i }));
    expect(screen.queryByRole("menuitem", { name: /align left/i })).toBeNull();
    cleanup();
    // Freeform + 2 selected → align/distribute appear and dispatch.
    const b = setup({ freeform: true, selectedCount: 3 });
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitem", { name: /align left/i }));
    expect(b.canvas.alignSelection).toHaveBeenCalledWith("left");
    await u.click(screen.getByRole("button", { name: /^view/i })); // align closed the menu — reopen
    await u.click(screen.getByRole("menuitem", { name: /distribute horizontally/i }));
    expect(b.canvas.distributeSelection).toHaveBeenCalledWith("h");
  });

  it("Focus is disabled in the View menu without a selection (#4)", async () => {
    setup();
    await u.click(screen.getByRole("button", { name: /^view/i }));
    expect(screen.getByRole("menuitem", { name: /focus the selected/i })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("Focus fires from the View menu with a selection (#4)", async () => {
    const t = setup({ selected: { id: "n1", topic: "Node", note: "" } });
    await u.click(screen.getByRole("button", { name: /^view/i }));
    await u.click(screen.getByRole("menuitem", { name: /focus the selected/i }));
    expect(t.canvas.setFocus).toHaveBeenCalledWith({ id: "n1", topic: "Node" });
  });

  it("Panels menu toggles each side panel", async () => {
    const t = setup();
    // PanelToggle items don't close the menu, so open once and click several.
    await u.click(screen.getByRole("button", { name: /^panels/i }));
    await u.click(screen.getByRole("menuitemcheckbox", { name: /outline/i }));
    expect(t.panels.setOutlineOpen).toHaveBeenCalled();
    await u.click(screen.getByRole("menuitemcheckbox", { name: /power filter/i }));
    expect(t.panels.toggleFilter).toHaveBeenCalled();
    await u.click(screen.getByRole("menuitemcheckbox", { name: /board/i }));
    expect(t.panels.setBoardOpen).toHaveBeenCalled();
  });

  it("Insert menu: sticky note + roll-up refresh", async () => {
    const t = setup();
    const open = () => u.click(screen.getByRole("button", { name: /^insert/i }));
    await open();
    await u.click(screen.getByRole("menuitem", { name: /sticky note/i }));
    expect(t.handle.addStickyNote).toHaveBeenCalled();
    await open();
    await u.click(screen.getByRole("menuitem", { name: /refresh all roll-ups/i }));
    expect(t.map.refreshRollupsNow).toHaveBeenCalled();
  });

  it("the Insert→Image item is a real menuitem button that opens the hidden file input (a11y 2.1.1)", async () => {
    setup();
    await u.click(screen.getByRole("button", { name: /^insert/i }));
    const item = screen.getByRole("menuitem", { name: /image on selected node/i });
    expect(item.tagName).toBe("BUTTON");
    const input = item.nextElementSibling as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(item);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("Insert: Group/Summary are disabled (with a why-tooltip) when nothing is selected", async () => {
    setup(); // no selection
    await u.click(screen.getByRole("button", { name: /^insert/i }));
    const group = screen.getByRole("menuitem", { name: /group branch/i });
    const summary = screen.getByRole("menuitem", { name: /summary bracket/i });
    expect(group).toHaveProperty("disabled", true);
    expect(summary).toHaveProperty("disabled", true);
    expect(group.getAttribute("title")).toMatch(/select a topic first/i);
  });

  it("Insert: Group/Summary are enabled and fire on the selection", async () => {
    const t = setup({ selected: { id: "n1", topic: "N", note: "" } });
    await u.click(screen.getByRole("button", { name: /^insert/i }));
    const group = screen.getByRole("menuitem", { name: /group branch/i });
    expect(group).toHaveProperty("disabled", false);
    await u.click(group);
    expect(t.handle.groupBranch).toHaveBeenCalledWith("n1");
  });

  it("Insert: Map parts + Templates are fly-out submenus, not a flat inline list", async () => {
    const t = setup({ selected: { id: "n1", topic: "N", note: "" } });
    await u.click(screen.getByRole("button", { name: /^insert/i }));
    // Collapsed: the submenu trigger rows are present, but their contents aren't in the DOM yet.
    const mapPartsRow = screen.getByRole("menuitem", { name: /^map parts/i });
    expect(screen.getByRole("menuitem", { name: /^templates/i })).toBeTruthy();
    expect(mapPartsRow.getAttribute("aria-haspopup")).toBe("menu");
    expect(screen.queryByRole("menuitem", { name: /^swot/i })).toBeNull();
    // Opening "Map parts" reveals its items; selecting one inserts that part under the selection.
    await u.click(mapPartsRow);
    await u.click(screen.getByRole("menuitem", { name: /^swot/i }));
    expect(t.handle.addSubtreeToSelected).toHaveBeenCalledTimes(1);
    // Opening "Templates" reveals its items; selecting one builds + inserts that template's subtree.
    await u.click(screen.getByRole("button", { name: /^insert/i }));
    await u.click(screen.getByRole("menuitem", { name: /^templates/i }));
    await u.click(screen.getByRole("menuitem", { name: /^swot/i })); // Templates also has a SWOT entry
    expect(t.handle.addSubtreeToSelected).toHaveBeenCalledTimes(2);
  });

  it("Canvas menu: free layout + opens the Map panel for styling (T5, T3-25)", async () => {
    // Persistent styling — theme/layout/design presets/background/connectors/fonts/backdrop — all
    // live in the Map panel now; the Canvas menu keeps only Free layout + a link to the panel.
    const t = setup();
    await u.click(screen.getByRole("button", { name: /^canvas/i }));
    await u.click(screen.getByRole("menuitemcheckbox", { name: /free layout/i }));
    expect(t.handle.setFreeform).toHaveBeenCalled();
    // The Free-layout checkbox keeps the menu open, so the styling link is reachable directly.
    await u.click(screen.getByRole("menuitem", { name: /theme, design presets/i }));
    expect(t.canvas.openMapPanel).toHaveBeenCalled();
  });

  it("layout select + quick add", async () => {
    const t = setup();
    await u.selectOptions(screen.getByLabelText("Layout"), "radial");
    expect(t.canvas.changeLayout).toHaveBeenCalledWith("radial");
    const qa = screen.getByLabelText("Quick add topic");
    await u.type(qa, "New topic{Enter}");
    expect(t.handle.quickAdd).toHaveBeenCalledWith("New topic");
  });
});

// A behaviour snapshot of the menus' accessibility contract, captured BEFORE the menu primitive is
// extracted (the upcoming restructure). Keeping these assertions green through that refactor is the
// proof it's behaviour-preserving — every menu trigger keeps its ARIA wiring and every menu still
// surfaces real menuitems, so the migration to a shared <Menu> can't silently regress a11y.
describe("Toolbar — menu a11y parity net", () => {
  const MENU_TRIGGERS = [/^export/i, /^more/i, /^panels/i, /^insert/i, /^canvas/i, /^view/i];

  it("every menu trigger advertises aria-haspopup=menu and toggles aria-expanded on open", async () => {
    setup();
    for (const name of MENU_TRIGGERS) {
      const trigger = screen.getByRole("button", { name });
      expect(trigger.getAttribute("aria-haspopup"), `${name} haspopup`).toBe("menu");
      expect(trigger.getAttribute("aria-expanded"), `${name} closed`).toBe("false");
      await u.click(trigger);
      expect(trigger.getAttribute("aria-expanded"), `${name} open`).toBe("true");
      // Opening surfaces at least one actionable item (plain menuitem or a panel checkbox).
      const items = [
        ...screen.queryAllByRole("menuitem"),
        ...screen.queryAllByRole("menuitemcheckbox"),
      ];
      expect(items.length, `${name} items`).toBeGreaterThan(0);
      await u.click(trigger); // toggle closed before the next trigger
    }
  });

  it("every toolbar button exposes a non-empty accessible name", () => {
    setup();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      const name = (b.getAttribute("aria-label") || b.textContent || "").trim();
      expect(name, b.outerHTML.slice(0, 140)).not.toBe("");
    }
  });

  it("the Panels menu exposes its toggles as menuitemcheckbox with aria-checked state", async () => {
    setup();
    await u.click(screen.getByRole("button", { name: /^panels/i }));
    const checks = screen.getAllByRole("menuitemcheckbox");
    expect(checks.length).toBeGreaterThanOrEqual(6);
    // All side panels start closed in the mocked props → every checkbox reads unchecked.
    for (const c of checks) expect(c.getAttribute("aria-checked")).toBe("false");
  });

  it("compacts the toolbar in mobile mode (primary menus inline, extras in the Options menu)", async () => {
    const t = setup({ isMobile: true });
    // Primary menus stay inline so they're always reachable on a phone.
    expect(screen.getByRole("button", { name: /^view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^insert/i })).toBeTruthy();
    // The view toggles + Layout collapse behind a dedicated "Options" overflow menu…
    expect(screen.getByRole("button", { name: /^options/i })).toBeTruthy();
    // …and the lowest-value widgets (Quick-add input, Timer) are dropped on phone.
    expect(screen.queryByLabelText("Quick add topic")).toBeNull();
    // Export still dispatches.
    await u.click(screen.getByRole("button", { name: /^export/i }));
    await u.click(screen.getByRole("menuitem", { name: /\.json/i }));
    expect(t.io.exportJson).toHaveBeenCalled();
  });

  it("opens the mobile Options menu with the view toggles + Layout", async () => {
    setup({ isMobile: true });
    await u.click(screen.getByRole("button", { name: /^options/i }));
    // Layout select + the view toggles live inside the sheet.
    expect(screen.getByLabelText("Layout")).toBeTruthy();
    const checks = screen.getAllByRole("menuitemcheckbox");
    expect(checks.length).toBeGreaterThanOrEqual(4); // numbering, line jumps, legend, spell-check
  });
});
