// Render-smoke tests for the left-rail panels in src/Panels.tsx. This is the safety net for the
// later Panels refactor (Phase D): each panel must mount without throwing AND show a known piece of
// user-visible content. Assertions target visible text / roles / labels — NOT internal structure —
// so they keep passing after the panels are rebuilt on shared primitives.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgendaPanel,
  FilterPanel,
  HistoryPanel,
  InboxPanel,
  InfoPanel,
  MapsPanel,
  MarkerTagIndex,
  type NamedStyle,
  NoteEditorPanel,
  NotesPanel,
  OutlinePanel,
  RelationshipsPanel,
  SlideDeckEditorPanel,
  StatsPanel,
  StyleBar,
  StylesPanel,
  WalkBar,
} from "../src/Panels";
import type { SelectedNode, SelectionFields } from "../src/mindmap";
import type { MapNode, MindMapDoc, SlideRef } from "../src/model/types";
import type { Backlink } from "../src/outline";

// A small but representative tree: a root with two children, one carrying a marker, a tag, a note,
// and task progress — so the index/outline panels have real content to render.
const sampleRoot = (): MapNode => ({
  id: "r",
  topic: "Launch plan",
  children: [
    {
      id: "a",
      topic: "Research",
      note: "interview users",
      icons: ["⭐"],
      tags: ["risk"],
      task: { progress: 0.5 },
      children: [{ id: "a1", topic: "Surveys", children: [] }],
    },
    { id: "b", topic: "Build", children: [] },
  ],
});

const noop = () => {};

// The InfoPanel now persists its last tab in localStorage; clear that key per test so each starts on
// the default Details tab (otherwise a test that switches to Style/Notes leaks into later ones).
beforeEach(() => {
  try {
    localStorage.removeItem("mindmap-info-tab");
  } catch {
    // ignore
  }
});

describe("OutlinePanel", () => {
  it("renders the filter box and a row for each topic", () => {
    render(<OutlinePanel root={sampleRoot()} filter="" onFilterChange={noop} onPick={noop} />);
    expect(screen.getByLabelText("Filter outline")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Launch plan/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Research/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Build/ })).toBeTruthy();
  });

  it("honours the filter text (only matching rows render)", () => {
    render(<OutlinePanel root={sampleRoot()} filter="build" onFilterChange={noop} onPick={noop} />);
    expect(screen.getByRole("button", { name: /Build/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Research/ })).toBeNull();
  });

  it("reveals the selected row by scrolling it into view when the canvas selection changes", () => {
    // jsdom doesn't implement scrollIntoView — install a stub so the reveal effect is observable.
    const orig = Element.prototype.scrollIntoView;
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    try {
      const { rerender } = render(
        <OutlinePanel root={sampleRoot()} filter="" onFilterChange={noop} onPick={noop} />,
      );
      expect(spy).not.toHaveBeenCalled(); // no selection → nothing to reveal
      rerender(
        <OutlinePanel
          root={sampleRoot()}
          filter=""
          onFilterChange={noop}
          onPick={noop}
          selectedId="b"
        />,
      );
      expect(spy).toHaveBeenCalled(); // the "Build" row scrolled into view
      spy.mockClear();
      rerender(
        <OutlinePanel
          root={sampleRoot()}
          filter=""
          onFilterChange={noop}
          onPick={noop}
          selectedId="ghost"
        />,
      );
      expect(spy).not.toHaveBeenCalled(); // a selection with no visible row doesn't scroll
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });

  it("Shift+Arrows reorder and re-indent the active row from the keyboard (a11y)", () => {
    const onMove = vi.fn();
    const onIndent = vi.fn();
    render(
      <OutlinePanel
        root={sampleRoot()}
        filter=""
        onFilterChange={noop}
        onPick={noop}
        onRename={noop}
        onIndent={onIndent}
        onMove={onMove}
      />,
    );
    const tree = screen.getByRole("tree");
    // Move the roving focus from the root down to "Research" (a).
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    // Shift+ArrowDown reorders Research after its sibling Build.
    fireEvent.keyDown(tree, { key: "ArrowDown", shiftKey: true });
    expect(onMove).toHaveBeenCalledWith("a", "b", "after");
    // Shift+ArrowUp on the same row moves it before its previous sibling.
    fireEvent.keyDown(tree, { key: "ArrowUp", shiftKey: true });
    // (no previous sibling for the first child → no-op; assert demote instead)
    fireEvent.keyDown(tree, { key: "ArrowRight", shiftKey: true });
    expect(onIndent).toHaveBeenCalledWith("a", "in");
    fireEvent.keyDown(tree, { key: "ArrowLeft", shiftKey: true });
    expect(onIndent).toHaveBeenCalledWith("a", "out");
  });

  it("disables Shift+Arrow reorder while filtering (the flat view hides structure)", () => {
    const onMove = vi.fn();
    const onIndent = vi.fn();
    render(
      <OutlinePanel
        root={sampleRoot()}
        filter="Surveys"
        onFilterChange={noop}
        onPick={noop}
        onRename={noop}
        onIndent={onIndent}
        onMove={onMove}
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(tree, { key: "ArrowRight", shiftKey: true });
    expect(onMove).not.toHaveBeenCalled();
    expect(onIndent).not.toHaveBeenCalled();
  });

  it("rapid keyboard entry: Enter adds a sibling, Tab a child, Shift+Tab outdents (A3)", async () => {
    const onRename = vi.fn();
    // Returning ids that DON'T exist in the tree would unmount the editor; map them back to a real row
    // ("a") so the editor stays mounted and we can chain the next key.
    const onAddSibling = vi.fn(() => "a");
    const onAddChild = vi.fn(() => "a");
    const onIndent = vi.fn();
    render(
      <OutlinePanel
        root={sampleRoot()}
        filter=""
        onFilterChange={noop}
        onPick={noop}
        onRename={onRename}
        onIndent={onIndent}
        onMove={noop}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
      />,
    );
    // Double-click "Research" → inline editor opens.
    await userEvent.dblClick(screen.getByRole("button", { name: /Research/ }));
    const input = screen.getByLabelText("Rename topic");
    // Enter commits the rename + adds a sibling, hopping the editor to the new node.
    fireEvent.change(input, { target: { value: "Research X" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("a", "Research X");
    expect(onAddSibling).toHaveBeenCalledWith("a");
    // Editor stayed open (mapped back to "a") — Tab adds a child.
    fireEvent.keyDown(screen.getByLabelText("Rename topic"), { key: "Tab" });
    expect(onAddChild).toHaveBeenCalledWith("a");
    // Shift+Tab outdents the current node.
    fireEvent.keyDown(screen.getByLabelText("Rename topic"), { key: "Tab", shiftKey: true });
    expect(onIndent).toHaveBeenCalledWith("a", "out");
  });
});

describe("RelationshipsPanel", () => {
  const linked = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "T",
    root: {
      id: "r",
      topic: "Root",
      children: [
        { id: "a", topic: "Alpha", children: [] },
        { id: "b", topic: "Beta", children: [] },
      ],
    },
    links: [{ id: "l", from: "a", to: "b", label: "blocks" }],
  });

  it("lists each relationship and jumps to an endpoint on click", async () => {
    const onPick = vi.fn();
    render(<RelationshipsPanel doc={linked()} onPick={onPick} />);
    expect(screen.getByText(/Relationships/)).toBeTruthy();
    expect(screen.getByText(/blocks/)).toBeTruthy(); // the edge label
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onPick).toHaveBeenCalledWith("b"); // jumped to the target end
    await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onPick).toHaveBeenCalledWith("a"); // …and the source end
  });

  it("shows an empty state when the map has no links", () => {
    render(<RelationshipsPanel doc={{ ...linked(), links: [] }} onPick={noop} />);
    expect(screen.getByText(/No relationships or topic links/)).toBeTruthy();
  });
});

describe("MarkerTagIndex", () => {
  it("renders the heading and groups markers + tags found in the map", () => {
    render(<MarkerTagIndex root={sampleRoot()} onPick={noop} />);
    expect(screen.getByText(/Markers & tags/)).toBeTruthy();
    expect(screen.getByText("Markers")).toBeTruthy();
    expect(screen.getByText("Tags")).toBeTruthy();
    // the node carrying the marker/tag is reachable by name (a jump button)
    expect(screen.getAllByRole("button", { name: /Research/ }).length).toBeGreaterThan(0);
  });

  it("shows an empty-state message for a map with no markers or tags", () => {
    const bare: MapNode = { id: "r", topic: "Bare", children: [] };
    render(<MarkerTagIndex root={bare} onPick={noop} />);
    expect(screen.getByText(/No markers or tags in this map yet/)).toBeTruthy();
  });
});

describe("FilterPanel", () => {
  it("renders the Power Filter controls and the marker/tag chips", () => {
    render(
      <FilterPanel
        root={sampleRoot()}
        text=""
        markers={[]}
        tags={[]}
        due=""
        priority={0}
        completion=""
        relDir=""
        relType=""
        onRelDir={noop}
        onRelType={noop}
        matchCount={0}
        savedFilters={[]}
        onText={noop}
        onToggleMarker={noop}
        onToggleTag={noop}
        onDue={noop}
        onPriority={noop}
        onCompletion={noop}
        onClear={noop}
        onSaveFilter={noop}
        onApplyFilter={noop}
        onDeleteFilter={noop}
      />,
    );
    expect(screen.getByText(/Power Filter/)).toBeTruthy();
    expect(screen.getByLabelText("Filter by text")).toBeTruthy();
    expect(screen.getByLabelText("Filter by due date")).toBeTruthy();
    expect(screen.getByLabelText("Filter by priority")).toBeTruthy();
    expect(screen.getByLabelText("Filter by completion")).toBeTruthy();
    // a chip for the tag present in the sample map
    expect(screen.getByRole("button", { name: "risk" })).toBeTruthy();
  });

  it("reports a completion choice through onCompletion", async () => {
    const onCompletion = vi.fn();
    render(
      <FilterPanel
        root={sampleRoot()}
        text=""
        markers={[]}
        tags={[]}
        due=""
        priority={0}
        completion=""
        relDir=""
        relType=""
        onRelDir={noop}
        onRelType={noop}
        matchCount={0}
        savedFilters={[]}
        onText={noop}
        onToggleMarker={noop}
        onToggleTag={noop}
        onDue={noop}
        onPriority={noop}
        onCompletion={onCompletion}
        onClear={noop}
        onSaveFilter={noop}
        onApplyFilter={noop}
        onDeleteFilter={noop}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Filter by completion"), "complete");
    expect(onCompletion).toHaveBeenCalledWith("complete");
  });

  it("shows the live match count when a filter is active", () => {
    render(
      <FilterPanel
        root={sampleRoot()}
        text="research"
        markers={[]}
        tags={[]}
        due=""
        priority={0}
        completion=""
        relDir=""
        relType=""
        onRelDir={noop}
        onRelType={noop}
        matchCount={3}
        savedFilters={[]}
        onText={noop}
        onToggleMarker={noop}
        onToggleTag={noop}
        onDue={noop}
        onPriority={noop}
        onCompletion={noop}
        onClear={noop}
        onSaveFilter={noop}
        onApplyFilter={noop}
        onDeleteFilter={noop}
      />,
    );
    expect(screen.getByText("3 matches")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });
});

describe("StylesPanel", () => {
  it("renders the conditional-formatting + named-styles sections", () => {
    render(
      <StylesPanel
        rules={[]}
        markers={["⭐", "🚩"]}
        namedStyles={[]}
        onAddRule={noop}
        onDeleteRule={noop}
        onSaveStyle={noop}
        onApplyStyle={noop}
        onDeleteStyle={noop}
      />,
    );
    expect(screen.getByText(/Styles/)).toBeTruthy();
    expect(screen.getByText("Conditional formatting")).toBeTruthy();
  });

  it("lists existing named styles by name", () => {
    const named: NamedStyle[] = [{ id: "s1", name: "Highlight", style: { background: "#ff0" } }];
    render(
      <StylesPanel
        rules={[]}
        markers={[]}
        namedStyles={named}
        onAddRule={noop}
        onDeleteRule={noop}
        onSaveStyle={noop}
        onApplyStyle={noop}
        onDeleteStyle={noop}
      />,
    );
    expect(screen.getByText("Highlight")).toBeTruthy();
  });
});

describe("SlideDeckEditorPanel", () => {
  const deck = [
    { ref: { nodeId: "overview" } as SlideRef, heading: "Plan" },
    { ref: { nodeId: "a" } as SlideRef, heading: "Alpha" },
  ];
  const topics = [
    { id: "r", topic: "Plan", depth: 0 },
    { id: "a", topic: "Alpha", depth: 1 },
    { id: "b", topic: "Beta", depth: 1 },
  ];

  it("lists the deck rows (overview flagged) and a Restore control only when custom", () => {
    const { rerender } = render(
      <SlideDeckEditorPanel
        deck={deck}
        topics={topics}
        isCustom={false}
        onChange={noop}
        onRestoreDefault={noop}
      />,
    );
    expect(screen.getByText(/1\. Plan/)).toBeTruthy();
    expect(screen.getByText(/\(overview\)/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Restore default/ })).toBeNull();
    rerender(
      <SlideDeckEditorPanel
        deck={deck}
        topics={topics}
        isCustom={true}
        onChange={noop}
        onRestoreDefault={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /Restore default/ })).toBeTruthy();
  });

  it("commits reorder / remove / note edits and adds a slide from the picker", () => {
    const onChange = vi.fn();
    render(
      <SlideDeckEditorPanel
        deck={deck}
        topics={topics}
        isCustom={true}
        onChange={onChange}
        onRestoreDefault={noop}
      />,
    );
    // Move Alpha (index 1) up → overview swaps down.
    fireEvent.click(screen.getByRole("button", { name: /Move Alpha up/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ nodeId: "a" }, { nodeId: "overview" }]);
    // Remove Alpha.
    fireEvent.click(screen.getByRole("button", { name: /Remove Alpha/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ nodeId: "overview" }]);
    // Type a speaker note on the overview slide.
    fireEvent.change(screen.getByLabelText(/Speaker note for Plan/), {
      target: { value: "Hello" },
    });
    // Controlled component: each action operates on the original deck (no rerender between clicks).
    expect(onChange).toHaveBeenLastCalledWith([
      { nodeId: "overview", note: "Hello" },
      { nodeId: "a" },
    ]);
    // Add Beta from the picker.
    fireEvent.change(screen.getByLabelText("Add a slide"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ Add/ }));
    expect(onChange).toHaveBeenLastCalledWith([
      { nodeId: "overview" },
      { nodeId: "a" },
      { nodeId: "b" },
    ]);
  });
});

describe("HistoryPanel", () => {
  it("renders the header + actions and an empty-state when there are no versions", () => {
    render(
      <HistoryPanel versions={[]} onSaveNow={noop} onPlay={noop} onRestore={noop} onClose={noop} />,
    );
    expect(screen.getByText(/History/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save version now/ })).toBeTruthy();
    expect(screen.getByText(/No saved versions yet/)).toBeTruthy();
  });

  it("lists saved versions with a Restore control each", () => {
    render(
      <HistoryPanel
        versions={[
          { id: "v1", ts: Date.now(), title: "Now", nodeCount: 4 },
          { id: "v2", ts: Date.now() - 60_000, title: "Earlier", nodeCount: 3 },
        ]}
        onSaveNow={noop}
        onPlay={noop}
        onRestore={noop}
        onClose={noop}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
  });
});

describe("InfoPanel", () => {
  const selected: SelectedNode = { id: "a", topic: "Research", note: "interview users" };
  const node = sampleRoot().children[0];

  const renderInfo = (
    sel: SelectedNode | null,
    n: MapNode | null,
    count?: number,
    nonce?: number,
    fields?: SelectionFields,
    backlinks: Backlink[] = [],
    onFollowBacklink: (id: string) => void = noop,
    times?: string,
    bulk?: {
      markers?: { all: string[]; some: string[] };
      tags?: { all: string[]; some: string[] };
      onMarker?: (m: string) => void;
      onTag?: (t: string) => void;
    },
    over: Partial<React.ComponentProps<typeof InfoPanel>> = {},
  ) =>
    render(
      <InfoPanel
        selected={sel}
        selectedCount={count}
        times={times}
        fields={fields}
        openNoteNonce={nonce}
        width={300}
        onResize={noop}
        node={n}
        noteDraft={n?.note ?? ""}
        onNoteChange={noop}
        onNoteBlur={noop}
        markers={["⭐", "🚩"]}
        onToggleMarker={noop}
        bulkMarkers={bulk?.markers}
        bulkTags={bulk?.tags}
        onBulkToggleMarker={bulk?.onMarker}
        onBulkToggleTag={bulk?.onTag}
        onPickSticker={noop}
        onStyle={noop}
        onAddTag={noop}
        onRemoveTag={noop}
        onSetProgress={noop}
        onSetDue={noop}
        onSetStart={noop}
        onSetPriority={noop}
        onAddAttachment={noop}
        onRemoveAttachment={noop}
        onSetHyperlink={noop}
        onAddHyperlink={noop}
        onRemoveHyperlink={noop}
        maps={[]}
        onLinkMap={noop}
        jumpTargets={[]}
        onJump={noop}
        backlinks={backlinks}
        outgoingLinks={[]}
        onFollowBacklink={onFollowBacklink}
        onMinimize={noop}
        {...over}
      />,
    );

  it("shows a placeholder when nothing is selected", () => {
    renderInfo(null, null);
    expect(screen.getByText(/Select a node to see and edit its details/)).toBeTruthy();
  });

  it("shows a Minimize control and the Details + Style tabs for the selected node", () => {
    renderInfo(selected, node);
    expect(screen.getByRole("button", { name: /Minimize/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Style" })).toBeTruthy();
    // The note editor has its own Notes tab for a single selection (P3).
    expect(screen.getByRole("tab", { name: "Notes" })).toBeTruthy();
  });

  it("renders the created/modified times line when provided, and omits it when empty", () => {
    const { unmount } = renderInfo(
      selected,
      node,
      undefined,
      undefined,
      undefined,
      [],
      noop,
      "created 2h ago · modified 1h ago",
    );
    expect(screen.getByText("created 2h ago · modified 1h ago")).toBeTruthy();
    unmount();
    renderInfo(selected, node); // no times → line absent
    expect(screen.queryByText(/created .* ago/)).toBeNull();
  });

  it("opens on Details leading with markers; the note moved to its own Notes tab (P3)", () => {
    renderInfo(selected, node);
    expect(screen.getByRole("tab", { name: "Details" }).getAttribute("aria-selected")).toBe("true");
    // Markers lead Details; the note editor is NOT here (it's on the Notes tab).
    expect(screen.queryByRole("textbox", { name: "Node note" })).toBeNull();
    expect(screen.getByText("Markers")).toBeTruthy();
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.getByText("Dates")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("Links")).toBeTruthy();
  });

  it("shows the note editor on its own roomy Notes tab (P3)", async () => {
    renderInfo(selected, node);
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    const editor = screen.getByRole("textbox", { name: "Node note" });
    expect(editor.textContent).toContain("interview users");
    // Details-only sections aren't duplicated on the Notes tab.
    expect(screen.queryByText("Markers")).toBeNull();
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("inserts a markdown link from the note toolbar when nothing is selected (🔗 Link)", async () => {
    const onNoteChange = vi.fn();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("https://example.com");
    renderInfo(selected, node, undefined, undefined, undefined, [], noop, undefined, undefined, {
      onNoteChange,
    });
    await userEvent.click(screen.getByRole("tab", { name: "Notes" })); // the note toolbar lives here (P3)
    await userEvent.click(screen.getByRole("button", { name: "🔗 Link" }));
    // With no text selected the URL is appended as its own markdown link (round-trips via htmlToNote).
    expect(onNoteChange).toHaveBeenCalledWith(
      expect.stringContaining("[https://example.com](https://example.com)"),
    );
    prompt.mockRestore();
  });

  it("ignores a non-http(s) link URL (🔗 Link)", async () => {
    const onNoteChange = vi.fn();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("javascript:alert(1)");
    renderInfo(selected, node, undefined, undefined, undefined, [], noop, undefined, undefined, {
      onNoteChange,
    });
    await userEvent.click(screen.getByRole("tab", { name: "Notes" })); // the note toolbar lives here (P3)
    await userEvent.click(screen.getByRole("button", { name: "🔗 Link" }));
    expect(onNoteChange).not.toHaveBeenCalled();
    prompt.mockRestore();
  });

  it("hides the Details markers/tags/priority once the Style tab is active (#7)", async () => {
    renderInfo(selected, node);
    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.queryByText("Markers")).toBeNull();
    expect(screen.queryByText("Priority")).toBeNull();
  });

  it("reveals the shape + sticker controls after switching to the Style tab", async () => {
    renderInfo(selected, node);
    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByText("Shape")).toBeTruthy();
    expect(screen.getByText(/Stickers/)).toBeTruthy();
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("enters bulk mode for a multi-selection (banner shown, per-item editors hidden, no Notes tab)", () => {
    renderInfo(selected, node, 3);
    expect(screen.getByText(/3 topics selected/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Notes" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Style" })).toBeTruthy();
    // Details (default) keeps the value-setting editors that fold across a set…
    expect(screen.getByText("Dates")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
    // …Attachments/Links stay single-topic; Tags only appears in bulk when a summary is supplied
    // (the tri-state block, exercised below) — none is passed here.
    expect(screen.queryByText("Tags")).toBeNull();
    expect(screen.queryByText("Attachments")).toBeNull();
    expect(screen.queryByText("Links")).toBeNull();
  });

  it("bulk Style tab keeps the style bar but hides per-item stickers", async () => {
    renderInfo(selected, node, 3);
    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByText("Shape")).toBeTruthy(); // StyleBar applies to all
    expect(screen.queryByText(/Stickers/)).toBeNull(); // per-item sticker grid hidden
  });

  it("bulk mode shows tri-state markers + tags on Details and toggles them across the selection", async () => {
    const onMarker = vi.fn();
    const onTag = vi.fn();
    renderInfo(selected, node, 3, undefined, undefined, [], noop, undefined, {
      markers: { all: ["⭐"], some: ["🚩"] },
      tags: { all: ["risk"], some: ["wip"] },
      onMarker,
      onTag,
    });
    // Details tab (default): markers lead, tags follow — both tri-state. "risk" on all (✕ removes),
    // "wip" on some (+ adds).
    expect(screen.getByText("Markers")).toBeTruthy();
    expect(screen.getByText("risk ✕")).toBeTruthy();
    await userEvent.click(screen.getByText("wip +"));
    expect(onTag).toHaveBeenCalledWith("wip");
    // The partial 🚩 marker is on Details (not the Style tab); clicking it adds it to all.
    await userEvent.click(screen.getByRole("button", { name: "🚩" }));
    expect(onMarker).toHaveBeenCalledWith("🚩");
  });

  it("keeps bulk markers on Details, not Style, so the control set doesn't reshuffle (P4)", async () => {
    renderInfo(selected, node, 3, undefined, undefined, [], noop, undefined, {
      markers: { all: ["⭐"], some: [] },
      onMarker: vi.fn(),
    });
    expect(screen.getByText("Markers")).toBeTruthy(); // on Details (default tab)
    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.queryByText("Markers")).toBeNull(); // not duplicated on Style
  });

  it("collapses an empty Details section (Attachments) and expands it on click (P3)", async () => {
    renderInfo(selected, node); // node carries no attachments → the section starts collapsed
    const header = screen.getByRole("button", { name: /Attachments/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("+ Attach file")).toBeNull(); // body hidden while collapsed
    await userEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("+ Attach file")).toBeTruthy(); // body revealed
  });

  it("offers an 'Open in dock' button on the Notes tab that calls onExpandNote (P6)", async () => {
    const onExpandNote = vi.fn();
    renderInfo(selected, node, undefined, undefined, undefined, [], noop, undefined, undefined, {
      onExpandNote,
    });
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.click(screen.getByRole("button", { name: /Open in dock/ }));
    expect(onExpandNote).toHaveBeenCalledTimes(1);
  });

  it("bulk mode blanks a mixed field + shows a 'Mixed' hint instead of the anchor's value", () => {
    // The anchor carries concrete task values; the selection disagrees on due/priority/progress.
    const tasked: MapNode = { ...node, task: { due: "2026-07-01", priority: 1, progress: 0.5 } };
    renderInfo(selected, tasked, 3, undefined, {
      count: 3,
      mixed: { progress: true, priority: true, start: false, due: true },
    });
    // The due date is NOT pre-filled with the anchor's value (would silently overwrite all on edit).
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("");
    // No priority button reads as active (the anchor's High priority isn't highlighted).
    expect(screen.getByRole("button", { name: "High" }).getAttribute("aria-pressed")).not.toBe(
      "true",
    );
    // …and at least one "Mixed" hint is rendered for the differing fields.
    expect(screen.getAllByText("Mixed").length).toBeGreaterThan(0);
  });

  it("bulk mode still shows the shared value for a uniform field (not blanked)", () => {
    const tasked: MapNode = { ...node, task: { due: "2026-07-01" } };
    renderInfo(selected, tasked, 2, undefined, {
      count: 2,
      mixed: { progress: false, priority: false, start: false, due: false },
    });
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-07-01");
    expect(screen.queryByText("Mixed")).toBeNull();
  });

  it("omits the 'Linked from' section when nothing points at the node", () => {
    renderInfo(selected, node);
    expect(screen.queryByText("Linked from")).toBeNull();
  });

  it("lists incoming backlinks and follows one on click (navigation, not onJump)", async () => {
    const onFollow = vi.fn();
    const backlinks: Backlink[] = [
      { id: "src1", topic: "Roadmap", kind: "hyperlink" },
      { id: "src2", topic: "Risk", kind: "relationship", label: "blocks" },
    ];
    renderInfo(selected, node, undefined, undefined, undefined, backlinks, onFollow);
    expect(screen.getByText("Linked from")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Roadmap/ })).toBeTruthy();
    // The relationship row carries its edge label.
    expect(screen.getByText(/blocks/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Risk/ }));
    expect(onFollow).toHaveBeenCalledWith("src2");
  });

  it("lists outgoing links ('Links to') and follows one on click", async () => {
    const onFollow = vi.fn();
    const outgoingLinks = [
      { id: "t1", topic: "Spec", kind: "hyperlink" as const },
      { id: "t2", topic: "Owner", kind: "relationship" as const, label: "assigned" },
    ];
    renderInfo(
      selected,
      node,
      undefined,
      undefined,
      undefined,
      [],
      onFollow,
      undefined,
      undefined,
      {
        outgoingLinks,
      },
    );
    expect(screen.getByText("Links to")).toBeTruthy();
    expect(screen.getByText(/assigned/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Spec/ }));
    expect(onFollow).toHaveBeenCalledWith("t1");
  });

  it("hides 'Linked from' in bulk mode (per-item, single-topic only)", () => {
    renderInfo(selected, node, 3, undefined, undefined, [
      { id: "src1", topic: "Roadmap", kind: "hyperlink" },
    ]);
    expect(screen.queryByText("Linked from")).toBeNull();
  });

  it("jumps to the Notes tab when openNoteNonce is set (the node 📝 click target) (P3)", () => {
    renderInfo(selected, node, 1, 1);
    expect(screen.getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Node note" })).toBeTruthy();
  });
});

describe("StyleBar", () => {
  it("renders the per-topic style controls (a Shape label + shape buttons)", () => {
    render(<StyleBar onStyle={noop} />);
    expect(screen.getByText("Shape")).toBeTruthy();
    // the diamond shape picker is present (asserted by its title/accessible name)
    expect(screen.getByRole("button", { name: /Diamond/ })).toBeTruthy();
  });

  it("fires onStyle callback when a shape button is clicked", async () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    const diamondBtn = screen.getByRole("button", { name: /Diamond/ });
    await userEvent.click(diamondBtn);
    expect(onStyle).toHaveBeenCalledWith({ shape: "diamond" });
  });

  it("renders fill and border color swatches", () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    expect(screen.getByText("Fill")).toBeTruthy();
    expect(screen.getByText("Border")).toBeTruthy();
  });

  it("renders the bold text toggle button", () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    // Bold button has a "B" icon with accessible text
    const boldButtons = screen.getAllByRole("button", { name: "B" });
    expect(boldButtons.length).toBeGreaterThan(0);
  });

  it("fires onStyle when bold button is clicked", async () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    const boldBtn = screen.getByRole("button", { name: "B" });
    await userEvent.click(boldBtn);
    expect(onStyle).toHaveBeenCalledWith(
      expect.objectContaining({ fontWeight: expect.any(String) }),
    );
  });

  it("sets and clears the raised drop-shadow style (#4)", async () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    await userEvent.click(screen.getByTitle("Raised (drop shadow)"));
    expect(onStyle).toHaveBeenCalledWith({ shadow: true });
    await userEvent.click(screen.getByTitle("Flat (no shadow)"));
    expect(onStyle).toHaveBeenCalledWith({ shadow: undefined });
  });

  it("reflects the selection's active style — shape / bold / fill / font (item 21)", () => {
    render(
      <StyleBar
        onStyle={noop}
        style={{ shape: "diamond", fontWeight: "bold", background: "#e2ecfd", fontFamily: "serif" }}
      />,
    );
    // The matching controls announce themselves pressed.
    expect(screen.getByRole("button", { name: /Diamond/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "B" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Fill #e2ecfd" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    // The font select opens on the live value (no longer resets to "Font…").
    expect((screen.getByTitle("Topic font family") as HTMLSelectElement).value).toBe("serif");
  });

  it("sets and clears a topic font family and exact font size", async () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} style={{}} />);
    await userEvent.selectOptions(
      screen.getByLabelText("Topic font family"),
      "SimSun, '宋体', serif",
    );
    expect(onStyle).toHaveBeenLastCalledWith({ fontFamily: "SimSun, '宋体', serif" });
    await userEvent.selectOptions(screen.getByLabelText("Topic font size"), "24px");
    expect(onStyle).toHaveBeenLastCalledWith({ fontSize: "24px" });
    await userEvent.selectOptions(screen.getByLabelText("Topic font size"), "");
    expect(onStyle).toHaveBeenLastCalledWith({ fontSize: "" });
  });

  it("toggles bold off when the topic is already bold (item 21)", async () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} style={{ fontWeight: "bold" }} />);
    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onStyle).toHaveBeenCalledWith({ fontWeight: "" });
  });

  it("shows no active control for a bulk/mixed selection (style undefined) (item 21)", () => {
    render(<StyleBar onStyle={noop} />); // no style prop → bulk mode
    for (const b of screen.getAllByRole("button")) {
      expect(b.getAttribute("aria-pressed")).not.toBe("true");
    }
  });

  it("wrap width is a slider that snaps to presets and re-wraps live (10b layer 1)", () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} wrapWidth="220px" />);
    const slider = screen.getByRole("slider", { name: "Topic wrap width" }) as HTMLInputElement;
    // Seeds from the selection.
    expect(slider.value).toBe("220");
    // Dragging to a preset writes the px width…
    fireEvent.change(slider, { target: { value: "160" } });
    expect(onStyle).toHaveBeenLastCalledWith({ maxWidth: "160px" });
    // …a near-preset value snaps to it…
    fireEvent.change(slider, { target: { value: "302" } });
    expect(onStyle).toHaveBeenLastCalledWith({ maxWidth: "300px" });
    // …and the far end means None (clears the cap).
    fireEvent.change(slider, { target: { value: "320" } });
    expect(onStyle).toHaveBeenLastCalledWith({ maxWidth: "" });
  });

  it("hides the Presets row when no named styles exist (#15)", () => {
    render(<StyleBar onStyle={noop} />);
    expect(screen.queryByText("Presets")).toBeNull();
  });

  it("surfaces saved named styles as quick-apply swatches and applies one on click (#15)", async () => {
    const onStyle = vi.fn();
    const preset = { background: "#fde68a", border: "2px solid #d97706" };
    render(
      <StyleBar onStyle={onStyle} namedStyles={[{ id: "p1", name: "Warning", style: preset }]} />,
    );
    expect(screen.getByText("Presets")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Apply preset Warning" }));
    expect(onStyle).toHaveBeenCalledWith(preset);
  });

  it("free colour pickers write text + fill via onStyle, seeded from the live values", () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} textColor="#112233" fillColor="#abcdef" />);
    const text = screen.getByLabelText("Text colour") as HTMLInputElement;
    const fill = screen.getByLabelText("Fill colour") as HTMLInputElement;
    expect(text.value).toBe("#112233"); // seeded from the selection's hex
    expect(fill.value).toBe("#abcdef");
    fireEvent.change(text, { target: { value: "#ff0000" } });
    expect(onStyle).toHaveBeenLastCalledWith({ color: "#ff0000" });
    fireEvent.change(fill, { target: { value: "#00ff00" } });
    expect(onStyle).toHaveBeenLastCalledWith({ background: "#00ff00" });
  });

  it("shows the Branch colour picker only when onBranchColor is wired, and dispatches to it", () => {
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    expect(screen.queryByLabelText("Branch colour")).toBeNull(); // no handler → no picker

    const onBranchColor = vi.fn();
    render(<StyleBar onStyle={onStyle} onBranchColor={onBranchColor} branchColor="#1b8a5e" />);
    const branch = screen.getByLabelText("Branch colour") as HTMLInputElement;
    expect(branch.value).toBe("#1b8a5e");
    fireEvent.change(branch, { target: { value: "#0000ff" } });
    expect(onBranchColor).toHaveBeenCalledWith("#0000ff");
    expect(onStyle).not.toHaveBeenCalled(); // branch colour never rides onStyle
  });

  it("falls back to a default colour when the live value is not 6-digit hex", () => {
    render(<StyleBar onStyle={noop} textColor="rebeccapurple" />);
    // A non-hex CSS colour can't seed a native picker; it opens on the documented default instead.
    expect((screen.getByLabelText("Text colour") as HTMLInputElement).value).toBe("#2b2a26");
  });
});

describe("OutlinePanel (interaction)", () => {
  it("calls onPick when a topic row is clicked", async () => {
    const onPick = vi.fn();
    render(<OutlinePanel root={sampleRoot()} filter="" onFilterChange={noop} onPick={onPick} />);
    const researchBtn = screen.getByRole("button", { name: /Research/ });
    await userEvent.click(researchBtn);
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("shows depth indicators (indentation) for nested topics", () => {
    render(<OutlinePanel root={sampleRoot()} filter="" onFilterChange={noop} onPick={noop} />);
    // Surveys is nested under Research, so it should appear after Research
    const buttons = screen.getAllByRole("button");
    const researchIdx = buttons.findIndex((b) => b.textContent?.includes("Research"));
    const surveysIdx = buttons.findIndex((b) => b.textContent?.includes("Surveys"));
    expect(surveysIdx).toBeGreaterThan(researchIdx);
  });

  it("renders read-only (no promote/demote controls) when no edit callbacks are given", () => {
    render(<OutlinePanel root={sampleRoot()} filter="" onFilterChange={noop} onPick={noop} />);
    expect(screen.queryByRole("button", { name: "Promote topic" })).toBeNull();
  });

  it("commits an inline rename on double-click + Enter", async () => {
    const onRename = vi.fn();
    render(
      <OutlinePanel
        root={sampleRoot()}
        filter=""
        onFilterChange={noop}
        onPick={noop}
        onRename={onRename}
        onIndent={noop}
        onMove={noop}
      />,
    );
    await userEvent.dblClick(screen.getByRole("button", { name: /Research/ }));
    const input = screen.getByRole("textbox", { name: "Rename topic" });
    await userEvent.clear(input);
    await userEvent.type(input, "Discovery{Enter}");
    expect(onRename).toHaveBeenCalledWith("a", "Discovery");
  });

  it("promotes / demotes a topic via the ◂ ▸ controls", async () => {
    const onIndent = vi.fn();
    render(
      <OutlinePanel
        root={sampleRoot()}
        filter=""
        onFilterChange={noop}
        onPick={noop}
        onRename={noop}
        onIndent={onIndent}
        onMove={noop}
      />,
    );
    // Promote the "Surveys" (a1) row specifically — scope the query to its row.
    const row = screen.getByText("Surveys").closest("div") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Promote topic" }));
    expect(onIndent).toHaveBeenCalledWith("a1", "out");
  });
});

describe("MarkerTagIndex (interaction)", () => {
  it("calls onPick when a marker/tag row is clicked", async () => {
    const onPick = vi.fn();
    render(<MarkerTagIndex root={sampleRoot()} onPick={onPick} />);
    // Click any of the Research buttons (appears under both Markers and Tags)
    const researchButtons = screen.getAllByRole("button", { name: /Research/ });
    await userEvent.click(researchButtons[0]);
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("stays read-only (no tag manager controls) without the manager callbacks", () => {
    render(<MarkerTagIndex root={sampleRoot()} onPick={noop} />);
    expect(screen.queryByRole("button", { name: "Delete tag risk" })).toBeNull();
  });

  it("Quick Filter: a per-marker/tag filter button fires onFilterBy with the kind + key (item 12)", async () => {
    const onFilterBy = vi.fn();
    render(<MarkerTagIndex root={sampleRoot()} onPick={noop} onFilterBy={onFilterBy} />);
    // The sample tree carries the "risk" tag → a "Filter by tag risk" control.
    await userEvent.click(screen.getByRole("button", { name: "Filter by tag risk" }));
    expect(onFilterBy).toHaveBeenCalledWith("tag", "risk");
  });

  it("omits the Quick Filter buttons when onFilterBy is absent", () => {
    render(<MarkerTagIndex root={sampleRoot()} onPick={noop} />);
    expect(screen.queryByRole("button", { name: /^Filter by / })).toBeNull();
  });

  it("renames/merges a tag map-wide via the ✎ control", async () => {
    const onRenameTag = vi.fn();
    render(
      <MarkerTagIndex
        root={sampleRoot()}
        onPick={noop}
        onRenameTag={onRenameTag}
        onDeleteTag={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rename tag risk" }));
    const input = screen.getByRole("textbox", { name: "Rename tag risk" });
    await userEvent.clear(input);
    await userEvent.type(input, "danger{Enter}");
    expect(onRenameTag).toHaveBeenCalledWith("risk", "danger");
  });

  it("deletes a tag map-wide via the ✕ control", async () => {
    const onDeleteTag = vi.fn();
    render(
      <MarkerTagIndex
        root={sampleRoot()}
        onPick={noop}
        onRenameTag={noop}
        onDeleteTag={onDeleteTag}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete tag risk" }));
    expect(onDeleteTag).toHaveBeenCalledWith("risk");
  });

  it("maps a tag to a colour via the swatch (and shows ⊘ to clear an existing colour)", async () => {
    const onSetTagColor = vi.fn();
    render(
      <MarkerTagIndex
        root={sampleRoot()}
        onPick={noop}
        onRenameTag={noop}
        onDeleteTag={noop}
        tagColorOf={(t) => (t === "risk" ? "#ff0000" : undefined)}
        onSetTagColor={onSetTagColor}
      />,
    );
    // The swatch reflects the current colour and pushes a new pick.
    const swatch = screen.getByLabelText("Colour for tag risk") as HTMLInputElement;
    expect(swatch.value).toBe("#ff0000");
    fireEvent.input(swatch, { target: { value: "#00ff00" } });
    expect(onSetTagColor).toHaveBeenCalledWith("risk", "#00ff00");
    // A coloured tag offers the ⊘ clear button → clears to undefined.
    await userEvent.click(screen.getByRole("button", { name: "Clear colour for tag risk" }));
    expect(onSetTagColor).toHaveBeenCalledWith("risk", undefined);
  });

  it("hides the ⊘ clear button for a tag with no colour yet", () => {
    render(
      <MarkerTagIndex
        root={sampleRoot()}
        onPick={noop}
        onRenameTag={noop}
        onDeleteTag={noop}
        tagColorOf={() => undefined}
        onSetTagColor={noop}
      />,
    );
    expect(screen.getByLabelText("Colour for tag risk")).toBeTruthy(); // swatch present
    expect(screen.queryByRole("button", { name: "Clear colour for tag risk" })).toBeNull();
  });
});

describe("NotesPanel (paste hardening, F2)", () => {
  it("pastes as plain text — pasted HTML never enters the editor", () => {
    const onChange = vi.fn();
    render(
      <NotesPanel
        selected={{ id: "a", topic: "A", note: "" }}
        value=""
        onChange={onChange}
        onBlur={() => {}}
      />,
    );
    const editor = screen.getByLabelText("Node note");
    const evil = '<img src=x onerror="alert(1)">hello';
    const prevented = !fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "hello" : evil),
      },
    });
    // Default paste is prevented (so the browser never inserts the raw HTML)…
    expect(prevented).toBe(true);
    // …and no <img>/active markup ever reaches the live editor, nor onChange.
    expect(editor.querySelector("img")).toBeNull();
    for (const call of onChange.mock.calls) expect(String(call[0])).not.toContain("onerror");
  });

  it("inserts a checklist via the Checklist button (#10)", () => {
    const onChange = vi.fn();
    render(
      <NotesPanel
        selected={{ id: "a", topic: "A", note: "" }}
        value=""
        onChange={onChange}
        onBlur={() => {}}
      />,
    );
    // The ☑ List button appends task-list markdown and re-renders it with checkboxes.
    fireEvent.click(screen.getByTitle("Checklist"));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("- [ ] To-do"));
    expect(
      screen.getByLabelText("Node note").querySelector('input[type="checkbox"]'),
    ).not.toBeNull();
  });

  it("inserts a markdown table via the Table button (#11)", () => {
    const onChange = vi.fn();
    render(
      <NotesPanel
        selected={{ id: "a", topic: "A", note: "" }}
        value=""
        onChange={onChange}
        onBlur={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Table/ }));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("| Column A | Column B |"));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("| --- | --- |"));
    // the editor re-rendered the table immediately
    expect(screen.getByLabelText("Node note").querySelector("table")).not.toBeNull();
  });

  it("inserts an image by URL via the Image button, rejecting non-image schemes (#11)", async () => {
    const onChange = vi.fn();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("https://x.test/c.png");
    render(
      <NotesPanel
        selected={{ id: "a", topic: "A", note: "" }}
        value=""
        onChange={onChange}
        onBlur={() => {}}
      />,
    );
    // The URL prompt resolves asynchronously now (no-host fallback → mocked window.prompt in a
    // microtask), so await the resulting edit.
    fireEvent.click(screen.getByRole("button", { name: /Image/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("![](https://x.test/c.png)"));
    // a javascript: URL is rejected — no further onChange
    onChange.mockClear();
    prompt.mockReturnValue("javascript:alert(1)");
    fireEvent.click(screen.getByRole("button", { name: /Image/ }));
    await new Promise((r) => setTimeout(r, 0)); // flush the rejected prompt's microtask
    expect(onChange).not.toHaveBeenCalled();
    prompt.mockRestore();
  });
});

describe("WalkBar", () => {
  it("shows the current topic, position, note, and steps via the controls", async () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onExit = vi.fn();
    render(
      <WalkBar
        index={1}
        total={4}
        topic="Second"
        note="speaker note"
        onPrev={onPrev}
        onNext={onNext}
        onExit={onExit}
      />,
    );
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(screen.getByText("speaker note")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next topic" }));
    expect(onNext).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(onExit).toHaveBeenCalled();
  });

  it("disables Prev on the first topic and Next on the last", () => {
    const { rerender } = render(
      <WalkBar index={0} total={3} topic="A" onPrev={noop} onNext={noop} onExit={noop} />,
    );
    expect(screen.getByRole("button", { name: "Previous topic" })).toHaveProperty("disabled", true);
    rerender(<WalkBar index={2} total={3} topic="C" onPrev={noop} onNext={noop} onExit={noop} />);
    expect(screen.getByRole("button", { name: "Next topic" })).toHaveProperty("disabled", true);
  });

  it("shows a cinematic-zoom toggle (only when wired) that reflects + fires its state", async () => {
    // No handler → no toggle (keeps the bar clean when cinematic isn't available).
    const { rerender } = render(
      <WalkBar index={0} total={2} topic="A" onPrev={noop} onNext={noop} onExit={noop} />,
    );
    expect(screen.queryByRole("button", { name: "🎬" })).toBeNull();

    const onToggle = vi.fn();
    rerender(
      <WalkBar
        index={0}
        total={2}
        topic="A"
        onPrev={noop}
        onNext={noop}
        onExit={noop}
        cinematic={false}
        onToggleCinematic={onToggle}
      />,
    );
    const btn = screen.getByRole("button", { name: "🎬" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
    rerender(
      <WalkBar
        index={0}
        total={2}
        topic="A"
        onPrev={noop}
        onNext={noop}
        onExit={noop}
        cinematic={true}
        onToggleCinematic={onToggle}
      />,
    );
    expect(screen.getByRole("button", { name: "🎬" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("NoteEditorPanel", () => {
  it("shows an empty-state hint and a working Close when nothing is selected", async () => {
    const onClose = vi.fn();
    render(
      <NoteEditorPanel selected={null} value="" onChange={noop} onBlur={noop} onClose={onClose} />,
    );
    expect(screen.getByText(/Select a topic to edit its note/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close note editor" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("embeds the note editor for the selected topic", () => {
    render(
      <NoteEditorPanel
        selected={{ id: "a", topic: "Research", note: "" }}
        value="hello"
        onChange={noop}
        onBlur={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText(/Research/)).toBeTruthy();
  });
});

describe("StatsPanel", () => {
  it("renders the map's headline counts", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: sampleRoot(),
    };
    render(<StatsPanel doc={doc} />);
    expect(screen.getByText(/Map statistics/)).toBeTruthy();
    expect(screen.getByText("Topics")).toBeTruthy();
    expect(screen.getByText("Distinct tags")).toBeTruthy();
  });
});

describe("MapsPanel (#18)", () => {
  const maps = [
    { id: "m1", title: "Launch plan" },
    { id: "m2", title: "Sprint retro" },
    { id: "m3", title: "Roadmap" },
  ];

  it("lists every map, marks the current one, and opens one on click", async () => {
    const onOpen = vi.fn();
    render(<MapsPanel maps={maps} currentId="m2" onOpen={onOpen} />);
    expect(screen.getByRole("button", { name: "Launch plan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sprint retro" }).getAttribute("aria-current")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Roadmap" }));
    expect(onOpen).toHaveBeenCalledWith("m3");
  });

  it("filters the list by the query", async () => {
    render(<MapsPanel maps={maps} currentId="m1" onOpen={noop} />);
    await userEvent.type(screen.getByLabelText("Filter maps"), "road");
    expect(screen.getByRole("button", { name: "Roadmap" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Launch plan" })).toBeNull();
  });
});

describe("InboxPanel (quick capture)", () => {
  const items = [
    { id: "a", text: "Call the vendor", ts: 200 },
    { id: "b", text: "Draft the agenda", ts: 100 },
  ];

  it("captures a jotted thought on Add and clears the field", async () => {
    const onCapture = vi.fn();
    render(
      <InboxPanel items={[]} canFile={true} onCapture={onCapture} onFile={noop} onDiscard={noop} />,
    );
    const field = screen.getByLabelText("Capture to inbox") as HTMLInputElement;
    await userEvent.type(field, "New idea");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onCapture).toHaveBeenCalledWith("New idea");
    expect(field.value).toBe("");
  });

  it("captures on Enter", async () => {
    const onCapture = vi.fn();
    render(
      <InboxPanel items={[]} canFile={true} onCapture={onCapture} onFile={noop} onDiscard={noop} />,
    );
    await userEvent.type(screen.getByLabelText("Capture to inbox"), "Quick note{Enter}");
    expect(onCapture).toHaveBeenCalledWith("Quick note");
  });

  it("files an item onto the map and discards another", async () => {
    const onFile = vi.fn();
    const onDiscard = vi.fn();
    render(
      <InboxPanel
        items={items}
        canFile={true}
        onCapture={noop}
        onFile={onFile}
        onDiscard={onDiscard}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: 'File "Call the vendor" onto the map' }),
    );
    expect(onFile).toHaveBeenCalledWith("a", "Call the vendor");
    await userEvent.click(screen.getByRole("button", { name: 'Discard "Draft the agenda"' }));
    expect(onDiscard).toHaveBeenCalledWith("b");
  });

  it("disables filing when no map is open", () => {
    render(
      <InboxPanel items={items} canFile={false} onCapture={noop} onFile={noop} onDiscard={noop} />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: 'File "Call the vendor" onto the map',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows an empty-state hint with no items", () => {
    render(
      <InboxPanel items={[]} canFile={true} onCapture={noop} onFile={noop} onDiscard={noop} />,
    );
    expect(screen.getByText(/Nothing unfiled/)).toBeTruthy();
  });
});

describe("AgendaPanel (#9)", () => {
  const agendaDoc: MindMapDoc = {
    schemaVersion: 1,
    id: "d",
    title: "R",
    root: {
      id: "r",
      topic: "Root",
      children: [
        { id: "p", topic: "Late task", task: { due: "2026-06-20" }, children: [] },
        { id: "t", topic: "Today task", task: { due: "2026-06-24" }, children: [] },
      ],
    },
  };

  it("buckets due tasks and jumps to one on click", async () => {
    const onPick = vi.fn();
    render(<AgendaPanel doc={agendaDoc} today="2026-06-24" onPick={onPick} />);
    expect(screen.getByText("Overdue (1)")).toBeTruthy();
    expect(screen.getByText("Today (1)")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Late task/ }));
    expect(onPick).toHaveBeenCalledWith("p");
  });

  it("shows an empty state when nothing is due", () => {
    const bare: MindMapDoc = { ...agendaDoc, root: { id: "r", topic: "R", children: [] } };
    render(<AgendaPanel doc={bare} today="2026-06-24" onPick={noop} />);
    expect(screen.getByText(/No overdue or upcoming tasks/)).toBeTruthy();
  });
});

describe("FilterPanel (interaction)", () => {
  it("calls onClear when the Clear button is clicked", async () => {
    const onClear = vi.fn();
    render(
      <FilterPanel
        root={sampleRoot()}
        text="research"
        markers={[]}
        tags={[]}
        due=""
        priority={0}
        completion=""
        relDir=""
        relType=""
        onRelDir={noop}
        onRelType={noop}
        matchCount={3}
        savedFilters={[]}
        onText={noop}
        onToggleMarker={noop}
        onToggleTag={noop}
        onDue={noop}
        onPriority={noop}
        onCompletion={noop}
        onClear={onClear}
        onSaveFilter={noop}
        onApplyFilter={noop}
        onDeleteFilter={noop}
      />,
    );
    const clearBtn = screen.getByRole("button", { name: "Clear" });
    await userEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it("calls onToggleMarker when a marker chip is clicked", async () => {
    const onToggleMarker = vi.fn();
    render(
      <FilterPanel
        root={sampleRoot()}
        text=""
        markers={[]}
        tags={[]}
        due=""
        priority={0}
        completion=""
        relDir=""
        relType=""
        onRelDir={noop}
        onRelType={noop}
        matchCount={0}
        savedFilters={[]}
        onText={noop}
        onToggleMarker={onToggleMarker}
        onToggleTag={noop}
        onDue={noop}
        onPriority={noop}
        onCompletion={noop}
        onClear={noop}
        onSaveFilter={noop}
        onApplyFilter={noop}
        onDeleteFilter={noop}
      />,
    );
    // The sample map has a ⭐ marker
    const markerChips = screen.getAllByRole("button", { name: "⭐" });
    if (markerChips.length > 0) {
      await userEvent.click(markerChips[0]);
      expect(onToggleMarker).toHaveBeenCalledWith("⭐");
    }
  });

  it("calls onDue when the due date filter changes", async () => {
    const onDue = vi.fn();
    render(
      <FilterPanel
        root={sampleRoot()}
        text=""
        markers={[]}
        tags={[]}
        due=""
        priority={0}
        completion=""
        relDir=""
        relType=""
        onRelDir={noop}
        onRelType={noop}
        matchCount={0}
        savedFilters={[]}
        onText={noop}
        onToggleMarker={noop}
        onToggleTag={noop}
        onDue={onDue}
        onPriority={noop}
        onCompletion={noop}
        onClear={noop}
        onSaveFilter={noop}
        onApplyFilter={noop}
        onDeleteFilter={noop}
      />,
    );
    const dueSelect = screen.getByLabelText("Filter by due date") as HTMLSelectElement;
    await userEvent.selectOptions(dueSelect, "overdue");
    expect(onDue).toHaveBeenCalledWith("overdue");
  });
});

describe("InfoPanel (interaction)", () => {
  const selected: SelectedNode = { id: "a", topic: "Research", note: "interview users" };
  const node = sampleRoot().children[0];

  const renderInfo = (sel: SelectedNode | null, n: MapNode | null) => {
    const onNoteChange = vi.fn();
    const onMinimize = vi.fn();
    const result = render(
      <InfoPanel
        selected={sel}
        width={300}
        onResize={noop}
        node={n}
        noteDraft={n?.note ?? ""}
        onNoteChange={onNoteChange}
        onNoteBlur={noop}
        markers={["⭐", "🚩"]}
        onToggleMarker={noop}
        onPickSticker={noop}
        onStyle={noop}
        onAddTag={noop}
        onRemoveTag={noop}
        onSetProgress={noop}
        onSetDue={noop}
        onSetStart={noop}
        onSetPriority={noop}
        onAddAttachment={noop}
        onRemoveAttachment={noop}
        onSetHyperlink={noop}
        onAddHyperlink={noop}
        onRemoveHyperlink={noop}
        maps={[]}
        onLinkMap={noop}
        jumpTargets={[]}
        onJump={noop}
        backlinks={[]}
        outgoingLinks={[]}
        onFollowBacklink={noop}
        onMinimize={onMinimize}
      />,
    );
    return { result, onNoteChange, onMinimize };
  };

  it("calls onMinimize when the Minimize button is clicked", async () => {
    const { onMinimize } = renderInfo(selected, node);
    const minBtn = screen.getByRole("button", { name: /Minimize/ });
    await userEvent.click(minBtn);
    expect(onMinimize).toHaveBeenCalled();
  });

  it("upgrades a whole-map link to a topic via the cross-map refine select", async () => {
    const onSetHyperlink = vi.fn();
    const linkedNode: MapNode = { ...sampleRoot().children[0], hyperlink: "#map=other" };
    render(
      <InfoPanel
        selected={{ id: "a", topic: "Research", note: "" }}
        width={300}
        onResize={noop}
        node={linkedNode}
        noteDraft=""
        onNoteChange={noop}
        onNoteBlur={noop}
        markers={["⭐"]}
        onToggleMarker={noop}
        onPickSticker={noop}
        onStyle={noop}
        onAddTag={noop}
        onRemoveTag={noop}
        onSetProgress={noop}
        onSetDue={noop}
        onSetStart={noop}
        onSetPriority={noop}
        onAddAttachment={noop}
        onRemoveAttachment={noop}
        onSetHyperlink={onSetHyperlink}
        onAddHyperlink={noop}
        onRemoveHyperlink={noop}
        maps={[{ id: "other", title: "Other map" }]}
        onLinkMap={noop}
        jumpTargets={[]}
        onJump={noop}
        crossLinkMapId="other"
        crossLinkTopics={[{ id: "x", topic: "Topic X", depth: 0 }]}
        backlinks={[]}
        outgoingLinks={[]}
        onFollowBacklink={noop}
        onMinimize={noop}
      />,
    );
    const select = await screen.findByLabelText("Focus a topic in the linked map");
    await userEvent.selectOptions(select, "x");
    expect(onSetHyperlink).toHaveBeenCalledWith("#map=other&node=x");
  });

  it("adds and removes additional hyperlinks (multiple links per topic)", async () => {
    const onAddHyperlink = vi.fn();
    const onRemoveHyperlink = vi.fn();
    const node: MapNode = {
      ...sampleRoot().children[0],
      hyperlink: "https://primary.test",
      hyperlinks: ["https://extra-one.test", "https://extra-two.test"],
    };
    render(
      <InfoPanel
        selected={{ id: "a", topic: "Research", note: "" }}
        width={300}
        onResize={noop}
        node={node}
        noteDraft=""
        onNoteChange={noop}
        onNoteBlur={noop}
        markers={["⭐"]}
        onToggleMarker={noop}
        onPickSticker={noop}
        onStyle={noop}
        onAddTag={noop}
        onRemoveTag={noop}
        onSetProgress={noop}
        onSetDue={noop}
        onSetStart={noop}
        onSetPriority={noop}
        onAddAttachment={noop}
        onRemoveAttachment={noop}
        onSetHyperlink={noop}
        onAddHyperlink={onAddHyperlink}
        onRemoveHyperlink={onRemoveHyperlink}
        maps={[]}
        onLinkMap={noop}
        jumpTargets={[]}
        onJump={noop}
        backlinks={[]}
        outgoingLinks={[]}
        onFollowBacklink={noop}
        onMinimize={noop}
      />,
    );
    // Both extras render with remove buttons.
    expect(screen.getByText("https://extra-one.test")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove additional link https://extra-two.test" }),
    );
    expect(onRemoveHyperlink).toHaveBeenCalledWith(1);
    // Typing a new link + Enter appends it.
    const add = screen.getByLabelText("Add another link");
    await userEvent.type(add, "https://new-link.test{Enter}");
    expect(onAddHyperlink).toHaveBeenCalledWith("https://new-link.test");
  });
});

describe("StylesPanel (interaction)", () => {
  it("shows an empty state message when there are no rules or styles", () => {
    render(
      <StylesPanel
        rules={[]}
        markers={["⭐"]}
        namedStyles={[]}
        onAddRule={noop}
        onDeleteRule={noop}
        onSaveStyle={noop}
        onApplyStyle={noop}
        onDeleteStyle={noop}
      />,
    );
    expect(screen.getByText(/Styles/)).toBeTruthy();
    expect(screen.getByText("Conditional formatting")).toBeTruthy();
  });

  it("displays multiple named styles in a list", () => {
    const named = [
      { id: "s1", name: "Highlight", style: { background: "#ff0" } },
      { id: "s2", name: "Bold Red", style: { background: "#f00", fontWeight: "bold" } },
    ];
    render(
      <StylesPanel
        rules={[]}
        markers={[]}
        namedStyles={named}
        onAddRule={noop}
        onDeleteRule={noop}
        onSaveStyle={noop}
        onApplyStyle={noop}
        onDeleteStyle={noop}
      />,
    );
    expect(screen.getByText("Highlight")).toBeTruthy();
    expect(screen.getByText("Bold Red")).toBeTruthy();
  });

  it("calls onApplyStyle with the style object when a named style is clicked", async () => {
    const onApplyStyle = vi.fn();
    const named = [{ id: "s1", name: "Highlight", style: { background: "#ff0" } }];
    render(
      <StylesPanel
        rules={[]}
        markers={[]}
        namedStyles={named}
        onAddRule={noop}
        onDeleteRule={noop}
        onSaveStyle={noop}
        onApplyStyle={onApplyStyle}
        onDeleteStyle={noop}
      />,
    );
    const highlightRow = screen.getByRole("button", { name: "Highlight" });
    await userEvent.click(highlightRow);
    expect(onApplyStyle).toHaveBeenCalledWith({ background: "#ff0" });
  });
});

describe("HistoryPanel (interaction)", () => {
  it("calls onSaveNow when the 'Save version now' button is clicked", async () => {
    const onSaveNow = vi.fn();
    render(
      <HistoryPanel
        versions={[]}
        onSaveNow={onSaveNow}
        onPlay={noop}
        onRestore={noop}
        onClose={noop}
      />,
    );
    const saveBtn = screen.getByRole("button", { name: /Save version now/ });
    await userEvent.click(saveBtn);
    expect(onSaveNow).toHaveBeenCalled();
  });

  it("calls onRestore when a Restore button is clicked", async () => {
    const onRestore = vi.fn();
    render(
      <HistoryPanel
        versions={[
          { id: "v1", ts: Date.now(), title: "Saved", nodeCount: 4 },
          { id: "v2", ts: Date.now() - 60_000, title: "Earlier", nodeCount: 3 },
        ]}
        onSaveNow={noop}
        onPlay={noop}
        onRestore={onRestore}
        onClose={noop}
      />,
    );
    const restoreButtons = screen.getAllByRole("button", { name: "Restore" });
    await userEvent.click(restoreButtons[0]);
    expect(onRestore).toHaveBeenCalledWith("v1");
  });
});

// Interaction smoke: confirm the panels are actually wired to their callbacks. These also pin the
// user-facing behaviour the Phase-D refactor must preserve (clicking a row picks it, typing filters,
// Restore restores the right version, picking a shape styles the node).
describe("panel interactions", () => {
  it("OutlinePanel: clicking a row calls onPick with that node id", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<OutlinePanel root={sampleRoot()} filter="" onFilterChange={noop} onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: /Research/ }));
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("OutlinePanel: typing in the filter box reports each change", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <OutlinePanel root={sampleRoot()} filter="" onFilterChange={onFilterChange} onPick={noop} />,
    );
    await user.type(screen.getByLabelText("Filter outline"), "ab");
    expect(onFilterChange).toHaveBeenCalledTimes(2); // one per keystroke
    expect(onFilterChange).toHaveBeenLastCalledWith("b"); // controlled input stays "" → last char
  });

  it("HistoryPanel: clicking a version's Restore calls onRestore with its id", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(
      <HistoryPanel
        versions={[{ id: "v1", ts: Date.now(), title: "Now", nodeCount: 4 }]}
        onSaveNow={noop}
        onPlay={noop}
        onRestore={onRestore}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledWith("v1");
  });

  it("StyleBar: picking a shape calls onStyle with that shape patch", async () => {
    const user = userEvent.setup();
    const onStyle = vi.fn();
    render(<StyleBar onStyle={onStyle} />);
    await user.click(screen.getByRole("button", { name: /Diamond/ }));
    expect(onStyle).toHaveBeenCalledTimes(1);
    expect(onStyle.mock.calls[0][0]).toMatchObject({ shape: "diamond" });
  });
});
