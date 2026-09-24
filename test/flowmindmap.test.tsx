import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type RefObject, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MindMap } from "../src/mindmap";
import { FlowMindMap } from "../src/mindmap/FlowMindMap";
import type { MindMapHandle } from "../src/mindmap/contract";
import { findAnyNode } from "../src/mindmap/flow/ops";
import type { MindMapDoc } from "../src/model/types";

// FlowMindMap — the React Flow canvas. Most of its body is the imperative MindMapHandle (the app's
// contract surface) plus apply/sync/undo-redo/keyboard, which run when CALLED via the ref; the rest
// (context menu, node/pane handlers, popover, inline editing) needs React Flow to actually render
// nodes + route pointer events — which it only does with a real viewport. The shim below gives it
// one in jsdom (the documented RF test mock), scoped to this file (vitest isolates each file's env).

class FiringResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    const contentRect = {
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    this.cb([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = FiringResizeObserver as unknown as typeof ResizeObserver;

class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const m = transform?.match(/scale\(([0-9.]+)\)/);
    this.m22 = m ? Number(m[1]) : 1;
  }
}
(globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyStub;

const FULL_RECT = {
  x: 0,
  y: 0,
  width: 1000,
  height: 800,
  top: 0,
  left: 0,
  right: 1000,
  bottom: 800,
  toJSON: () => ({}),
};
Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => FULL_RECT,
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get: () => 1000,
});
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get: () => 800,
});
if (typeof SVGElement !== "undefined") {
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 100, height: 100 }),
  });
}

// Each render gets a unique doc id: FlowMindMap keys its inner tree on doc.id.
let seq = 0;
const baseDoc = (id = `m${++seq}`): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title: "Map",
  root: {
    id: "root",
    topic: "Root",
    children: [
      { id: "a", topic: "Alpha", children: [{ id: "a1", topic: "Alpha 1", children: [] }] },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
});

// Always return void from the act callback: some handle methods (fit → fitView) return a Promise,
// and letting that escape into act() turns it async-without-await and corrupts the act scope.
const run = (fn: () => unknown) => {
  act(() => {
    fn();
  });
};

function mount(
  doc: MindMapDoc = baseDoc(),
  over: Partial<React.ComponentProps<typeof FlowMindMap>> = {},
) {
  const onChange = vi.fn();
  const onSelect = vi.fn();
  const onMapLink = vi.fn();
  const onDelete = vi.fn();
  const ref = createRef<MindMapHandle>() as RefObject<MindMapHandle | null>;
  const utils = render(
    <FlowMindMap
      doc={doc}
      onChange={onChange}
      onSelect={onSelect}
      onMapLink={onMapLink}
      onDelete={onDelete}
      ref={ref}
      {...over}
    />,
  );
  if (!ref.current) throw new Error("FlowMindMap did not expose its imperative handle");
  return { ...utils, ref, onChange, onSelect, onMapLink, onDelete, h: ref.current };
}

const nodeEl = (container: HTMLElement, id: string): Element => {
  const el = container.querySelector(`.react-flow__node[data-id="${id}"]`);
  if (!el) throw new Error(`node ${id} not rendered`);
  return el;
};
const openMenu = () => document.querySelector("[data-mm-menu]") as HTMLElement | null;

describe("FlowMindMap canvas", () => {
  beforeEach(() => {
    vi.spyOn(window, "prompt").mockReturnValue("Label");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "open").mockReturnValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it("mounts and exposes the imperative handle", () => {
    const { h } = mount();
    expect(typeof h.exportSvg).toBe("function");
    expect(typeof h.focusNode).toBe("function");
  });

  it("renders a topic at its per-topic wrap width, else the 320 cap (canvas==export)", () => {
    // Regression: a flat `maxWidth: 320` used to override the per-topic width spread in from `box`, so the
    // canvas rendered full-width while layout.ts + the SVG export wrapped to the set width. Guard the fix.
    const doc = baseDoc();
    doc.root.children[0].style = { maxWidth: "160px" }; // Alpha: Narrow
    const { container } = mount(doc);
    const maxWidths = (id: string) =>
      [...nodeEl(container, id).querySelectorAll("*")]
        .map((e) => (e as HTMLElement).style.maxWidth)
        .filter(Boolean);
    expect(maxWidths("a")).toContain("160px"); // Alpha honours its wrap width
    expect(maxWidths("b")).toContain("320px"); // Beta (no width set) → the hard cap
    expect(maxWidths("b")).not.toContain("160px");
  });

  it("runs the selection-free handle actions, mutating the doc via onChange", () => {
    const { h, onChange } = mount();
    run(() => h.setAllExpanded(false));
    run(() => h.setAllExpanded(true));
    run(() => h.setBackground("#fef9c3"));
    run(() => h.setBackgroundImage("data:image/png;base64,AAAA"));
    run(() => h.setLineJumps(true));
    run(() => h.renameMap("Renamed map"));
    run(() => h.setRules([{ id: "r1", kind: "completed", style: { background: "#dcfce7" } }]));
    run(() => h.addStickyNote());
    run(() => h.quickAdd("Quick capture"));
    run(() => h.setFreeform(true));
    run(() => h.setFreeform(false));
    run(() => h.setBackdrop("onion"));
    run(() => h.setBackdropRings(1));
    run(() => h.setBackdropColor("#3b82c4"));
    run(() => h.clearBackdrop());
    run(() => h.fit());
    expect(onChange).toHaveBeenCalled();

    const blob = h.exportSvg();
    expect(blob).toBeInstanceOf(Blob);
    let count = 0;
    run(() => {
      count = h.replaceTopics("Alpha", "Omega");
    });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("focuses a node and applies the selection-dependent handle actions to it", () => {
    const { h, onSelect, onChange } = mount();
    run(() => h.focusNode("a"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));

    let noted = false;
    run(() => {
      noted = h.setSelectedNote("hello");
    });
    expect(noted).toBe(true); // a node is selected → the withSelected actions take effect

    run(() => h.setSelectedImage({ url: "data:image/png;base64,AAAA" }));
    run(() => h.toggleSelectedIcon("⭐"));
    run(() => h.setSelectedStyle({ shape: "diamond" }));
    run(() => h.setSelectedHyperlink("https://example.com"));
    run(() => h.addSelectedHyperlink("https://extra.example.com"));
    run(() => h.setSelectedTags(["tag"]));
    run(() => h.setSelectedProgress(0.5));
    run(() => h.setSelectedDue("2026-06-20"));
    run(() => h.setSelectedStart("2026-06-19"));
    run(() => h.setSelectedPriority(1));
    run(() =>
      h.addSelectedAttachment({ name: "f.txt", dataUrl: "data:text/plain;base64,AA", size: 3 }),
    );
    run(() => h.removeSelectedAttachment(0));
    run(() => h.removeSelectedHyperlink(0));
    run(() => h.addSubtreeToSelected([{ id: "x", topic: "Grafted", children: [] }]));
    run(() => h.setSelectedRollup("m99"));
    run(() => h.groupBranch("a"));
    run(() => h.groupSummary("a"));
    expect(onChange).toHaveBeenCalled();
  });

  it("drives keyboard tree-building and undo / redo", () => {
    const { h, onChange } = mount();
    run(() => h.focusNode("a"));
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: "Enter" })); // add sibling
    run(() => fireEvent.keyDown(document, { key: "Tab" })); // add child
    run(() => fireEvent.keyDown(document, { key: "Tab", shiftKey: true })); // outdent
    run(() => fireEvent.keyDown(document, { key: "F2" })); // begin edit
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "Delete" })); // delete
    expect(onChange).toHaveBeenCalled();
    // Undo/redo work regardless of selection.
    run(() => fireEvent.keyDown(document, { key: "z", ctrlKey: true }));
    run(() => fireEvent.keyDown(document, { key: "z", ctrlKey: true, shiftKey: true }));
    run(() => fireEvent.keyDown(document, { key: "y", ctrlKey: true }));
  });

  it("applies digit detail levels relative to the selected branch", () => {
    const doc = baseDoc();
    doc.root.children[0] = {
      id: "a",
      topic: "Alpha",
      collapsed: true,
      children: [
        {
          id: "a1",
          topic: "Alpha 1",
          children: [
            {
              id: "a11",
              topic: "Alpha 1.1",
              children: [{ id: "a111", topic: "Alpha 1.1.1", children: [] }],
            },
          ],
        },
      ],
    };
    doc.root.children[1] = {
      id: "b",
      topic: "Beta",
      collapsed: true,
      children: [{ id: "b1", topic: "Beta 1", children: [] }],
    };
    const { h, onChange } = mount(doc);
    run(() => h.focusNode("a"));

    run(() => fireEvent.keyDown(document, { key: "1" }));
    const level1 = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(findAnyNode(level1, "a")?.collapsed).toBe(false);
    expect(findAnyNode(level1, "a1")?.collapsed).toBe(true);
    expect(findAnyNode(level1, "b")?.collapsed).toBe(true);

    run(() => fireEvent.keyDown(document, { key: "2" }));
    const level2 = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(findAnyNode(level2, "a")?.collapsed).toBe(false);
    expect(findAnyNode(level2, "a1")?.collapsed).toBe(false);
    expect(findAnyNode(level2, "a11")?.collapsed).toBe(true);
    expect(findAnyNode(level2, "b")?.collapsed).toBe(true);
  });

  it("keyboard branch clipboard: copy, duplicate-as-sibling, and paste under the selection", () => {
    localStorage.removeItem("mindmap-branch-clipboard");
    const { h, onChange } = mount(); // root > [a (> a1), b]
    run(() => h.focusNode("a"));
    // Ctrl+C copies the "a" branch to the clipboard.
    run(() => fireEvent.keyDown(document, { key: "c", ctrlKey: true }));
    expect(localStorage.getItem("mindmap-branch-clipboard")).toContain("Alpha");
    // Ctrl+D duplicates "a" as a sibling → root grows from 2 children to 3.
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: "d", ctrlKey: true }));
    expect((onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children).toHaveLength(3);
    // Ctrl+Shift+V pastes the copied branch UNDER the selection → "a" gains a child (a1 + paste).
    run(() => h.focusNode("a"));
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: "v", ctrlKey: true, shiftKey: true }));
    const a = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find(
      (n) => n.id === "a",
    );
    expect(a?.children.length).toBeGreaterThanOrEqual(2);
  });

  it("quickAdd splits a pasted multi-line outline into a subtree (burst capture)", () => {
    const { h, onChange } = mount(); // root > [a (> a1), b]
    run(() => h.focusNode("a"));
    onChange.mockClear();
    run(() => h.quickAdd("Parent\n  Child 1\n  Child 2"));
    const a = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find(
      (n) => n.id === "a",
    );
    const parent = a?.children.find((n) => n.topic === "Parent");
    expect(parent?.children.map((c) => c.topic)).toEqual(["Child 1", "Child 2"]);
  });

  it("quickAdd keeps a single line verbatim (no markdown-marker stripping)", () => {
    const { h, onChange } = mount();
    run(() => h.focusNode("a"));
    onChange.mockClear();
    // A lone topic that begins with a list/heading marker must NOT be reinterpreted as an outline.
    run(() => h.quickAdd("1. Introduction"));
    const a = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find(
      (n) => n.id === "a",
    );
    expect(a?.children.at(-1)?.topic).toBe("1. Introduction");
  });

  it("addFloatingTopic files inbox text as a detached floating topic", () => {
    const { h, onChange } = mount();
    onChange.mockClear();
    run(() => h.addFloatingTopic("  Filed from inbox  "));
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.floatingTopics?.map((f) => f.topic)).toContain("Filed from inbox"); // trimmed
  });

  it("addFloatingTopic ignores a blank capture", () => {
    const { h, onChange } = mount();
    onChange.mockClear();
    run(() => h.addFloatingTopic("   "));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hovers a collapsed +N toggle to peek the first hidden child titles (Phase 10)", () => {
    const collapsedDoc: MindMapDoc = {
      schemaVersion: 1,
      id: "peek",
      title: "T",
      root: {
        id: "root",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            collapsed: true,
            children: [
              { id: "a1", topic: "First child", children: [] },
              { id: "a2", topic: "Second child", children: [] },
            ],
          },
        ],
      },
    };
    const { container } = mount(collapsedDoc);
    const toggle = within(nodeEl(container, "a") as HTMLElement).getByTitle("Expand");
    run(() => fireEvent.mouseEnter(toggle));
    expect(screen.getByText("First child")).toBeTruthy();
    expect(screen.getByText("Second child")).toBeTruthy();
    run(() => fireEvent.mouseLeave(toggle));
    expect(screen.queryByText("First child")).toBeNull(); // peek dismissed on leave
  });

  it("right-clicks the empty pane → a canvas menu (add topic / fit / reset zoom)", () => {
    localStorage.removeItem("mindmap-branch-clipboard");
    const { container, onChange } = mount();
    const pane = container.querySelector(".react-flow__pane") as HTMLElement;
    run(() => fireEvent.contextMenu(pane));
    const menu = openMenu() as HTMLElement;
    expect(menu).toBeTruthy();
    expect(within(menu).getByText("Add topic here")).toBeTruthy();
    expect(within(menu).getByText("Fit to view")).toBeTruthy();
    expect(within(menu).getByText("Reset zoom (100%)")).toBeTruthy();
    expect(within(menu).queryByText("Paste branch here")).toBeNull(); // empty clipboard → hidden
    run(() => fireEvent.click(within(menu).getByText("Add topic here")));
    expect(onChange).toHaveBeenCalled(); // a floating topic was added
  });

  it("the pane menu pastes a copied branch as a floating topic", () => {
    const { container, h, onChange } = mount();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "c", ctrlKey: true })); // copy "a" → clipboard
    const pane = container.querySelector(".react-flow__pane") as HTMLElement;
    run(() => fireEvent.contextMenu(pane));
    const menu = openMenu() as HTMLElement;
    onChange.mockClear();
    run(() => fireEvent.click(within(menu).getByText("Paste branch here")));
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.floatingTopics?.length ?? 0).toBeGreaterThanOrEqual(1); // pasted as a floating topic
  });

  it("the status-bar zoom % + selection count are clickable (reset zoom / fit selection)", () => {
    const { h } = mount();
    run(() => fireEvent.click(screen.getByTitle("Reset zoom to 100%"))); // no throw (zoomTo)
    run(() => h.focusNode("a")); // a selection → the fit button appears
    run(() => fireEvent.click(screen.getByTitle("Zoom to fit the selection"))); // no throw (fitView)
  });

  it("Ctrl+Enter edits the selected topic, matching iThoughts Windows", () => {
    const { container, h } = mount();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "Enter", ctrlKey: true }));
    expect(container.querySelector('[contenteditable="true"]')?.textContent).toBe("Alpha");
  });

  it("Alt+Right indents a branch and Alt+Left outdents it again", () => {
    const { h, onChange } = mount();
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "ArrowRight", altKey: true }));
    let doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children.map((node) => node.id)).toEqual(["a"]);
    expect(doc.root.children[0].children.map((node) => node.id)).toEqual(["a1", "b"]);

    run(() => fireEvent.keyDown(document, { key: "ArrowLeft", altKey: true }));
    doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children.map((node) => node.id)).toEqual(["a", "b"]);
  });

  it("does not enter edit when a printable letter is typed on a selected topic", () => {
    const { container, h } = mount();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "X" }));
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it("does not let modified letter shortcuts open the editor", () => {
    const { container, h } = mount();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "b", ctrlKey: true })); // a shortcut, not an edit
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it("slash menu: typing / opens the command menu; Enter runs a command and preserves the topic", () => {
    const { container, h, onChange } = mount();
    run(() => h.focusNode("b")); // Beta, no children
    // Type-to-edit with "/" seeds the editor and opens the slash menu (all commands, index 0 = child).
    run(() => fireEvent.keyDown(document, { key: "/" }));
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add child topic/ })).toBeTruthy();
    onChange.mockClear();
    // Enter selects the highlighted command (Add child topic).
    run(() => fireEvent.keyDown(editable, { key: "Enter" }));
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    const b = doc.root.children.find((n) => n.id === "b");
    expect(b?.children).toHaveLength(1); // a child was added under Beta
    expect(b?.topic).toBe("Beta"); // the "/query" buffer was discarded — the real topic stands
  });

  it("slash menu: filtering to a command and Enter applies its effect (Due today)", () => {
    const { container, h, onChange } = mount();
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "/" }));
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    // Narrow to the Due-today command by setting the editor text + firing input.
    editable.textContent = "/due";
    run(() => fireEvent.input(editable));
    expect(screen.getByRole("button", { name: /Due today/ })).toBeTruthy();
    onChange.mockClear();
    run(() => fireEvent.keyDown(editable, { key: "Enter" }));
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    const b = doc.root.children.find((n) => n.id === "b");
    expect(b?.task?.due).toBeTruthy(); // a due date was stamped
  });

  // Set the editor text and drop the caret at its end (mirrors the user having just typed it).
  const typeInEditor = (editable: HTMLElement, text: string) => {
    editable.textContent = text;
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false); // caret to the end
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    run(() => fireEvent.input(editable));
  };

  it("link autocomplete: typing [[ opens a topic picker; selecting inserts the name + attaches the link", () => {
    const { container, h, onChange } = mount(); // root > [a "Alpha" (→ a1 "Alpha 1"), b "Beta"]
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "F2" })); // enter edit on Beta
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    // Author a wiki link.
    typeInEditor(editable, "[[Al");
    // Both "Alpha" and "Alpha 1" match "Al"; the menu is open with ≥2 candidates.
    expect(container.querySelectorAll(".mm-slash-item").length).toBeGreaterThanOrEqual(2);
    onChange.mockClear();
    run(() => fireEvent.keyDown(editable, { key: "Enter" })); // pick the first (Alpha, id "a")
    expect(editable.textContent).toBe("Alpha"); // the "[[Al" token was replaced by the topic name
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children.find((n) => n.id === "b")?.hyperlink).toBe("#node=a"); // linked to Alpha
  });

  it("link autocomplete: a second link on the same node lands in the extras (hyperlinks[])", () => {
    const { container, h, onChange } = mount();
    // b already has a primary link, so the autocomplete should add to the extras.
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "F2" }));
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    typeInEditor(editable, "[[Alpha");
    run(() => fireEvent.keyDown(editable, { key: "Enter" })); // → primary #node=a
    // Author another link to "Alpha 1".
    typeInEditor(editable, "[[Alpha 1");
    onChange.mockClear();
    run(() => fireEvent.keyDown(editable, { key: "Enter" }));
    const b = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find(
      (n) => n.id === "b",
    );
    expect(b?.hyperlink).toBe("#node=a"); // primary unchanged
    expect(b?.hyperlinks).toEqual(["#node=a1"]); // the second link is an extra
  });

  it("link autocomplete: Escape dismisses the picker and stays closed until the text changes", () => {
    const { container, h } = mount();
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "F2" }));
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    typeInEditor(editable, "[[Al");
    expect(container.querySelectorAll(".mm-slash-item").length).toBeGreaterThanOrEqual(2);
    // Escape closes it — and the keyup re-sync must NOT reopen it (the bug this guards).
    run(() => fireEvent.keyDown(editable, { key: "Escape" }));
    run(() => fireEvent.keyUp(editable, { key: "Escape" }));
    expect(container.querySelectorAll(".mm-slash-item").length).toBe(0);
    // Typing more re-opens it (the dismissal only holds for the exact dismissed text).
    typeInEditor(editable, "[[Alp");
    expect(container.querySelectorAll(".mm-slash-item").length).toBeGreaterThanOrEqual(1);
  });

  it("slash menu: Escape dismisses it and it stays closed on keyup", () => {
    const { container, h } = mount();
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "/" })); // seeds "/", opens the menu
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(container.querySelectorAll(".mm-slash-item").length).toBeGreaterThanOrEqual(1);
    run(() => fireEvent.keyDown(editable, { key: "Escape" }));
    run(() => fireEvent.keyUp(editable, { key: "Escape" }));
    expect(container.querySelectorAll(".mm-slash-item").length).toBe(0);
  });

  it("link autocomplete preserves rich formatting in the topic (splices only the token)", () => {
    const { container, h, onChange } = mount();
    run(() => h.focusNode("b"));
    run(() => fireEvent.keyDown(document, { key: "F2" }));
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    // A formatted buffer: bold "Beta" then a wiki token typed after it.
    editable.innerHTML = "<b>Beta</b> [[Al";
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    run(() => fireEvent.input(editable));
    onChange.mockClear();
    run(() => fireEvent.keyDown(editable, { key: "Enter" })); // pick "Alpha"
    // The bold run survives; only the "[[Al" token became "Alpha".
    expect(editable.querySelector("b")?.textContent).toBe("Beta");
    expect(editable.textContent).toBe("Beta Alpha");
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children.find((n) => n.id === "b")?.hyperlink).toBe("#node=a");
  });

  it("Delete removes a node with children immediately (no modal) + reports it for the undo toast (#9)", () => {
    const { h, onChange, onDelete } = mount();
    run(() => h.focusNode("a")); // "a" (Alpha) has child a1
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: "Delete" }));
    expect(window.confirm).not.toHaveBeenCalled(); // no blocking modal anymore
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children.find((n) => n.id === "a")).toBeUndefined();
    // topic + descendant count flow up so App can show "… deleted — Undo".
    expect(onDelete).toHaveBeenCalledWith("Alpha", 1);
  });

  it("Delete on a childless node deletes immediately and reports it (#9)", () => {
    const { h, onChange, onDelete } = mount();
    run(() => h.focusNode("b")); // "b" (Beta) has no children
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: "Delete" }));
    expect(window.confirm).not.toHaveBeenCalled();
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children.find((n) => n.id === "b")).toBeUndefined();
    expect(onDelete).toHaveBeenCalledWith("Beta", 0);
  });

  it("deleting the central root is refused with a hint, not a silent no-op", () => {
    const onHint = vi.fn();
    const { h, onChange, onDelete } = mount(baseDoc(), { onHint });
    run(() => h.focusNode("root"));
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: "Delete" }));
    expect(onChange).not.toHaveBeenCalled(); // root not deleted
    expect(onDelete).not.toHaveBeenCalled();
    expect(onHint).toHaveBeenCalledWith(expect.stringMatching(/central topic/i));
  });

  it("undo restores the selection STATE (not just the callback) so the next keystroke targets it", () => {
    const { h, onChange, onSelect } = mount();
    run(() => h.focusNode("b")); // Beta (a leaf) selected
    run(() => fireEvent.keyDown(document, { key: "Delete" })); // delete b; anchor moves to a sibling
    expect(
      (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find((n) => n.id === "b"),
    ).toBeUndefined();
    onSelect.mockClear();
    run(() => fireEvent.keyDown(document, { key: "z", ctrlKey: true })); // undo → b back + reselected
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "b" }));
    // The React selection state — not just onSelect — must point at b: a Tab now adds a child to b.
    run(() => fireEvent.keyDown(document, { key: "Tab" }));
    const b = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find(
      (n) => n.id === "b",
    );
    expect(b?.children).toHaveLength(1); // landed under the restored node, not a stale anchor
  });

  it("Escape on a brand-new empty topic discards it instead of leaving a blank node", () => {
    const { container, h, onChange } = mount();
    run(() => h.focusNode("a")); // "a" has one child (a1)
    run(() => fireEvent.keyDown(document, { key: "Tab" })); // add an empty child + enter edit
    const editable = container.querySelector('[contenteditable="true"]');
    expect(editable).toBeTruthy();
    const aKids = () =>
      (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find((n) => n.id === "a")
        ?.children.length;
    expect(aKids()).toBe(2); // a1 + the new empty node
    run(() => fireEvent.keyDown(editable as Element, { key: "Escape" })); // leave it empty
    expect(aKids()).toBe(1); // the blank node is discarded
  });

  it("Escape on a new topic you typed into keeps it (only an empty one is discarded)", () => {
    const { container, h, onChange } = mount();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "Tab" })); // empty child + edit
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    editable.innerHTML = "Typed"; // the live editor buffer (not yet committed to the doc)
    run(() => fireEvent.keyDown(editable, { key: "Escape" })); // Escape keeps what you typed
    const a = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find(
      (n) => n.id === "a",
    );
    expect(a?.children).toHaveLength(2); // a1 + the kept node
    expect(a?.children.some((c) => c.topic === "Typed")).toBe(true);
  });

  it("Enter commits in place, keeps selection, and does not create a sibling", () => {
    const { container, h, onChange, onSelect } = mount();
    run(() => h.focusNode("a")); // a has [a1]
    run(() => fireEvent.keyDown(document, { key: "Tab" })); // empty child C1 + edit
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    editable.innerHTML = "First"; // type into C1
    run(() => fireEvent.keyDown(editable, { key: "Enter" }));
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
    let a = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find((n) => n.id === "a");
    expect(a?.children.map((child) => child.topic)).toEqual(["Alpha 1", "First"]);
    const committedId = a?.children.find((child) => child.topic === "First")?.id;
    expect(onSelect.mock.calls.at(-1)?.[0]?.id).toBe(committedId);

    // The committed topic remains selected: Alt+Up immediately reorders that same branch.
    run(() => fireEvent.keyDown(document, { key: "ArrowUp", altKey: true }));
    a = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).root.children.find((n) => n.id === "a");
    expect(a?.children.map((child) => child.topic)).toEqual(["First", "Alpha 1"]);
  });

  it("Enter confirms and keeps a newly-created empty topic", () => {
    const { container, h, onChange, onSelect } = mount();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "Enter" })); // new empty sibling + edit
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable).toBeTruthy();
    const beforeCommit = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    const emptyId = beforeCommit.root.children.find((node) => node.topic === "")?.id;
    expect(emptyId).toBeTruthy();

    run(() => fireEvent.keyDown(editable, { key: "Enter" })); // explicitly accept the blank topic
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
    const afterCommit = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(afterCommit.root.children.some((node) => node.id === emptyId && node.topic === "")).toBe(
      true,
    );
    expect(onSelect.mock.calls.at(-1)?.[0]?.id).toBe(emptyId);
  });

  it("drops a URL onto the canvas as a floating topic", () => {
    const { container, onChange } = mount();
    const surface = container.querySelector("#mm-canvas");
    if (!surface) throw new Error("no canvas surface");
    const dataTransfer = {
      types: ["text/uri-list"],
      getData: (t: string) => (t === "text/uri-list" ? "https://dropped.example.com" : ""),
      dropEffect: "",
    };
    run(() => {
      fireEvent.dragOver(surface, { dataTransfer });
      fireEvent.drop(surface, { dataTransfer });
    });
    expect(onChange).toHaveBeenCalled();
  });

  it("leaves Space unassigned when a topic is selected", () => {
    const { h, onChange } = mount();
    run(() => h.focusNode("a"));
    onChange.mockClear();
    run(() => fireEvent.keyDown(document, { key: " ", code: "Space" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders inline Markdown in a plain topic without exposing the markers", () => {
    const doc = baseDoc();
    doc.root.children[0].topic = "**粗体** <mark>高亮</mark> __下划线__";
    const { container } = mount(doc);
    const node = nodeEl(container, "a");
    expect(node.querySelector("strong")?.textContent).toBe("粗体");
    expect(node.querySelector("mark")?.textContent).toBe("高亮");
    expect(node.querySelector("u")?.textContent).toBe("下划线");
    expect(node.textContent).not.toContain("**");
    expect(node.textContent).not.toContain("<mark>");
    expect(node.textContent).not.toContain("__");
  });

  it("renders overlays for a doc with boundaries / summaries / callouts / backdrop in brace layout", () => {
    const richDoc: MindMapDoc = {
      schemaVersion: 1,
      id: "rich1",
      title: "Rich",
      root: {
        id: "root",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            callouts: [{ id: "c1", text: "hi", dx: 10, dy: 0 }],
            children: [{ id: "a1", topic: "A1", children: [] }],
          },
          { id: "b", topic: "B", children: [] },
        ],
      },
      boundaries: [{ id: "bd1", nodeIds: ["a"], label: "Box" }],
      summaries: [{ id: "s1", nodeIds: ["a"], label: "Sum" }],
      links: [{ id: "l1", from: "a", to: "b", label: "rel" }],
      floatingTopics: [{ id: "f1", topic: "Float", children: [] }],
      backdrop: { kind: "onion", rings: 2 },
      meta: { lineJumps: true },
    };
    const { h } = mount(richDoc, { direction: "brace" });
    // Selecting a node renders the on-node quick-action popover block.
    run(() => h.focusNode("a"));
    run(() => h.fit());
    expect(h).toBeTruthy();
  });

  it("mounts through the lazy MindMap entry seam (index.tsx)", async () => {
    const ref = createRef<MindMapHandle>() as RefObject<MindMapHandle | null>;
    render(<MindMap doc={baseDoc()} ref={ref} />);
    // <MindMap> code-splits FlowMindMap behind Suspense; wait for the chunk to resolve + commit.
    await waitFor(() => expect(ref.current).toBeTruthy());
  });

  it("opens the right-click context menu and runs its actions", () => {
    const { container, onChange } = mount();
    const reopen = () => run(() => fireEvent.contextMenu(nodeEl(container, "a")));
    reopen();
    const menu = openMenu();
    expect(menu).toBeTruthy();
    // The items builder produced the full set.
    for (const label of [
      "Add child",
      "Add sibling",
      "Rename",
      "Link to…",
      "Add callout",
      "Group in boundary",
      "Summarize branch",
      "Copy branch",
      "Collapse / expand",
      "Delete",
    ]) {
      expect(within(menu as HTMLElement).getByText(label)).toBeTruthy();
    }

    const clickItem = (label: string) => {
      const m = openMenu();
      if (m) run(() => fireEvent.click(within(m).getByText(label)));
    };
    clickItem("Add callout");
    reopen();
    clickItem("Group in boundary");
    reopen();
    clickItem("Summarize branch");
    reopen();
    clickItem("Copy branch"); // → branch clipboard now has something
    reopen();
    expect(within(openMenu() as HTMLElement).getByText("Paste branch here")).toBeTruthy();
    clickItem("Paste branch here");
    reopen();
    clickItem("Add child");
    reopen();
    clickItem("Add sibling");
    reopen();
    clickItem("Collapse / expand");
    reopen();
    // Branch-layout override <select> (now one of two selects — the other is "Map side").
    run(() =>
      fireEvent.change(
        within(openMenu() as HTMLElement).getByRole("combobox", { name: /branch layout/i }),
        { target: { value: "org-down" } },
      ),
    );
    // Esc closes the menu (the close-on-Escape effect).
    reopen();
    run(() => fireEvent.keyDown(document, { key: "Escape" }));
    expect(openMenu()).toBeNull();
    // Delete last (it removes node "a").
    reopen();
    clickItem("Delete");
    expect(onChange).toHaveBeenCalled();
  });

  it("pins a main branch to a side and re-balances via the handle (Balance map)", () => {
    const { h, onChange } = mount();
    run(() => h.setNodeSide("a", "left"));
    const pinned = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(pinned.root.children.find((c) => c.id === "a")?.side).toBe("left");
    run(() => h.balanceMap());
    const balanced = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(balanced.root.children.every((c) => c.side === undefined)).toBe(true);
  });

  it("context menu exposes Add note + inline marker/priority quick-setters (#3)", () => {
    const { container, onChange } = mount();
    run(() => fireEvent.contextMenu(nodeEl(container, "a")));
    const menu = openMenu() as HTMLElement;
    expect(within(menu).getByText("Add note")).toBeTruthy();
    // Toggle a marker from the menu (stays open for multi-toggle).
    run(() => fireEvent.click(within(menu).getByRole("button", { name: /marker ⭐/ })));
    expect(onChange).toHaveBeenCalled();
    expect(openMenu()).toBeTruthy(); // not closed by a marker toggle
    // Set a priority from the menu.
    const before = onChange.mock.calls.length;
    run(() => fireEvent.click(within(menu).getByRole("button", { name: "High" })));
    expect(onChange.mock.calls.length).toBeGreaterThan(before);
  });

  it("context menu is keyboard-accessible: focus-first, roving, and arrows don't edit the tree", () => {
    const { container, onChange } = mount();
    run(() => fireEvent.contextMenu(nodeEl(container, "a")));
    const menu = openMenu() as HTMLElement;
    expect(menu).toBeTruthy();
    // The ContextMenu focuses its first item on open, so it's immediately keyboard-drivable.
    const first = within(menu).getByRole("menuitem", { name: "Add child" });
    expect(document.activeElement).toBe(first);
    // ArrowDown roves to the next item — and crucially the canvas keymap (Enter/Tab/Delete add/remove
    // nodes) is gated while a menu button is focused, so arrow-keying the menu must NOT mutate the doc.
    const before = onChange.mock.calls.length;
    run(() => fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" }));
    expect(document.activeElement).toBe(
      within(menu).getByRole("menuitem", { name: "Add sibling" }),
    );
    run(() => fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" }));
    run(() => fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowUp" }));
    expect(onChange.mock.calls.length).toBe(before); // no node added or removed
    // Escape closes the menu (handled by the ContextMenu primitive, not a FlowMindMap effect).
    run(() => fireEvent.keyDown(document, { key: "Escape" }));
    expect(openMenu()).toBeNull();
  });

  it("selects on node click, shows the quick-action popover, and deselects on pane click", () => {
    const { container, onSelect, onChange } = mount();
    const sel = (id: string) => run(() => fireEvent.click(nodeEl(container, id)));
    const pop = (name: string) => run(() => fireEvent.click(screen.getByRole("button", { name })));
    sel("a");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    // Popover quick actions (NodeToolbar): Collapse stays inline; Rename/Delete now live behind the
    // "More…" opener, which raises the full right-click menu at the node (C6).
    pop("Collapse / expand"); // toggleCollapse — popover stays, fires onChange
    expect(onChange).toHaveBeenCalled();
    sel("a");
    pop("More actions"); // opens the node's full context menu
    const menu = openMenu() as HTMLElement;
    expect(within(menu).getByText("Rename")).toBeTruthy();
    expect(within(menu).getByText("Delete")).toBeTruthy();
    // Escape closes the menu; a pane click then clears the selection.
    run(() => fireEvent.keyDown(document, { key: "Escape" }));
    const pane = container.querySelector(".react-flow__pane");
    if (pane) run(() => fireEvent.click(pane));
  });

  it("right-clicks a boundary overlay → recolour / shape / outline / delete menu (Phase 4)", () => {
    const doc: MindMapDoc = {
      ...baseDoc(),
      boundaries: [{ id: "bnd-1", nodeIds: ["a"], label: "Scope" }],
    };
    const { onChange } = mount(doc);
    // Re-open the overlay menu from the boundary's label button (each action closes it).
    const reopen = () => {
      run(() => fireEvent.contextMenu(screen.getByRole("button", { name: "Scope" })));
      return openMenu() as HTMLElement;
    };
    const lastBoundary = () => (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).boundaries?.[0];

    let menu = reopen();
    expect(within(menu).getByText("Recolour")).toBeTruthy();
    expect(within(menu).getByText("Shape")).toBeTruthy(); // boundary-only
    expect(within(menu).getByText("Outline")).toBeTruthy(); // boundary-only

    // Recolour applies a stroke swatch…
    run(() => fireEvent.click(within(menu).getByRole("button", { name: "Colour #3f9e6e" })));
    expect(lastBoundary()?.color).toBe("#3f9e6e");
    // …Shape sets the outline shape…
    menu = reopen();
    run(() => fireEvent.click(within(menu).getByText("Square")));
    expect(lastBoundary()?.shape).toBe("rect");
    // …Outline sets the dash style…
    menu = reopen();
    run(() => fireEvent.click(within(menu).getByText("dashed")));
    expect(lastBoundary()?.dash).toBe("dashed");
    // …and Delete removes the boundary.
    menu = reopen();
    run(() => fireEvent.click(within(menu).getByText("Delete")));
    const last = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(last.boundaries ?? []).toHaveLength(0);
  });

  it("binds a roll-up source from the node context menu when libraryMaps is supplied (I11)", () => {
    const { container, onChange } = mount(baseDoc(), {
      libraryMaps: [
        { id: "src-1", title: "Source One" },
        { id: "src-2", title: "Source Two" },
      ],
    });
    run(() => fireEvent.contextMenu(nodeEl(container, "a")));
    const menu = openMenu() as HTMLElement;
    const select = within(menu).getByRole("combobox", { name: "Bind roll-up source" });
    run(() => fireEvent.change(select, { target: { value: "src-2" } }));
    const last = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    const a = last.root.children.find((c) => c.id === "a");
    expect(a?.rollup).toBe("src-2");
  });

  it("keeps branch creation in the topic context menu without on-node add buttons", () => {
    const { container } = mount();
    const node = nodeEl(container, "b");
    run(() => fireEvent.mouseOver(node.firstElementChild as HTMLElement));
    expect(container.querySelector(".mm-node-add")).toBeNull();
    expect(screen.queryByRole("button", { name: /Add child/ })).toBeNull();
    run(() => fireEvent.contextMenu(node));
    const menu = openMenu() as HTMLElement;
    expect(within(menu).getByRole("menuitem", { name: "Add child" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Add sibling" })).toBeTruthy();
  });

  it("the on-selection action bar wires note + priority quick-actions (UI-3)", () => {
    const onOpenNote = vi.fn();
    const { container, onChange } = mount(baseDoc(), { onOpenNote });
    // Nothing selected → no action bar.
    expect(screen.queryByRole("button", { name: /Add note/ })).toBeNull();
    // Selecting a note-less, priority-less node reveals the note + priority quick-actions in the
    // contextual action bar (the popover above the selection — note/priority moved here from the hover pill).
    run(() => fireEvent.click(nodeEl(container, "b")));
    const prioBtn = screen.getByRole("button", { name: "Add priority" });
    // Add-priority sets a priority on the topic (cyclePriority undefined → High).
    run(() => fireEvent.click(prioBtn));
    expect(onChange).toHaveBeenCalled();
    // Add-note asks the app to open the inspector's Notes tab.
    const noteBtn = screen.getByRole("button", { name: /Add note/ });
    run(() => fireEvent.click(noteBtn));
    expect(onOpenNote).toHaveBeenCalled();
  });

  it("sets a node's image / attachment by id — the drag-a-file-onto-a-topic handle path (#4)", () => {
    const { h, onChange } = mount();
    expect(h.setNodeImage("b", { url: "data:image/png;base64,AAAA", width: 10, height: 10 })).toBe(
      true,
    );
    expect(
      h.addNodeAttachment("b", { name: "spec.txt", dataUrl: "data:text/plain,hi", size: 2 }),
    ).toBe(true);
    // A missing node id is a no-op that reports false (the dropped-on node may have been deleted).
    expect(h.setNodeImage("ghost", { url: "data:image/png;base64,AAAA" })).toBe(false);
    expect(h.addNodeAttachment("ghost", { name: "x", dataUrl: "data:,", size: 0 })).toBe(false);
    expect(onChange).toHaveBeenCalled();
  });

  it("double-clicks the empty canvas to create a floating topic and edit it (#6)", () => {
    const { container, onChange } = mount();
    const pane = container.querySelector(".react-flow__pane") as HTMLElement;
    expect(pane).toBeTruthy();
    run(() => fireEvent.doubleClick(pane));
    expect(onChange).toHaveBeenCalled();
    // Lands straight in inline edit of the new topic.
    expect(container.querySelector('[contenteditable="true"]')).toBeTruthy();
  });

  it("names the canvas region for assistive tech and exposes the skip-link target id", () => {
    const { container } = mount();
    const canvas = container.querySelector("#mm-canvas") as HTMLElement;
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe("SECTION"); // a named landmark region, not an anonymous div
    expect(canvas.getAttribute("aria-roledescription")).toBe("mind map canvas");
    expect(canvas.getAttribute("aria-label")).toMatch(/^Mind map:/);
    // A polite live region narrates the selection for screen readers.
    expect(canvas.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it("first-run: on an empty map the keymap falls back to root, so Tab acts with nothing selected", () => {
    const empty: MindMapDoc = { ...baseDoc(), root: { id: "root", topic: "Root", children: [] } };
    const { onSelect, onChange } = mount(empty);
    // Nothing is auto-selected — the fresh-map Map-panel view is unchanged…
    expect(onSelect).not.toHaveBeenCalled();
    // …but the canvas keymap falls back to the root, so Tab immediately adds a child to it
    // (previously a no-op against the null selection — the coachmark's instruction was a lie).
    run(() => fireEvent.keyDown(document, { key: "Tab" }));
    const doc = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(doc.root.children).toHaveLength(1);
  });

  it("the empty-map fallback is empty-map-only: Tab does nothing on a populated map with no selection", () => {
    const { onChange } = mount(); // baseDoc is populated, nothing selected
    run(() => fireEvent.keyDown(document, { key: "Tab" }));
    expect(onChange).not.toHaveBeenCalled(); // no invented target → no-op
  });

  it("shows the empty-map coachmark until the first edit, never on a populated map (#1)", () => {
    // Populated map → no coachmark.
    const populated = mount(baseDoc());
    expect(screen.queryByText("Start your map")).toBeNull();
    populated.unmount();
    // Bare root (≤1 topic) → coachmark visible.
    const empty: MindMapDoc = { ...baseDoc(), root: { id: "root", topic: "Root", children: [] } };
    const { container } = mount(empty);
    expect(screen.getByText("Start your map")).toBeTruthy();
    // Entering edit (F2 on the selected root) dismisses it for good.
    run(() => fireEvent.click(nodeEl(container, "root")));
    run(() => fireEvent.keyDown(document, { key: "F2" }));
    expect(screen.queryByText("Start your map")).toBeNull();
  });

  it("phrases the empty-map coachmark for touch on a phone-width viewport (#1)", () => {
    // useIsMobile reads matchMedia("(max-width: 640px)"); make it match so the canvas renders in its
    // phone mode. The coachmark then swaps its keyboard gestures for the tap equivalents.
    const realMatchMedia = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({
        matches: /max-width:\s*640px/.test(q),
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    try {
      const empty: MindMapDoc = { ...baseDoc(), root: { id: "root", topic: "Root", children: [] } };
      mount(empty);
      expect(screen.getByText(/double-tap a topic to rename/i)).toBeTruthy();
      expect(screen.queryByText(/for a sibling/i)).toBeNull();
    } finally {
      window.matchMedia = realMatchMedia;
    }
  });

  it("draws a relationship via the Link to… gesture — silently, then inline-labels it", async () => {
    const { container, onChange } = mount();
    run(() => fireEvent.contextMenu(nodeEl(container, "a")));
    run(() => fireEvent.click(within(openMenu() as HTMLElement).getByText("Link to…")));
    expect(screen.getByText(/Click a target node/)).toBeTruthy();
    // Completing the link creates it IMMEDIATELY (no modal) …
    run(() => fireEvent.click(nodeEl(container, "b")));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const link = (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).links?.[0];
    expect(link).toMatchObject({ from: "a", to: "b" });
    expect(link?.label).toBeUndefined(); // unlabelled until the user types
    // … and opens the label for inline editing right on the line.
    const input = (await screen.findByLabelText("Relationship label")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "depends" } });
    run(() => fireEvent.keyDown(input, { key: "Enter" }));
    await waitFor(() =>
      expect((onChange.mock.calls.at(-1)?.[0] as MindMapDoc).links?.[0]?.label).toBe("depends"),
    );
  });

  it("commits inline edits and runs the node affordances (link / note / collapse)", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "edit1",
      title: "Edit",
      root: {
        id: "root",
        topic: "Root",
        children: [
          {
            id: "a",
            topic: "Alpha",
            hyperlink: "https://example.com",
            note: "a note",
            task: { progress: 0.25 },
            children: [{ id: "a1", topic: "Alpha 1", children: [] }],
          },
        ],
      },
    };
    const onOpenNote = vi.fn();
    const { container, onChange, h } = mount(doc, { onOpenNote });
    const editable = (): Element => {
      const e = container.querySelector('[contenteditable="true"]');
      if (!e) throw new Error("no contenteditable in edit mode");
      return e;
    };

    // Inline edit: double-click the topic text → contenteditable (covers editingApi.beginEdit) →
    // Enter commits + adds a sibling. The onDoubleClick lives on TopicNode's inner div, so fire on
    // the text element and let it bubble.
    run(() =>
      fireEvent.doubleClick(within(nodeEl(container, "a") as HTMLElement).getByText("Alpha")),
    );
    run(() => fireEvent.keyDown(editable(), { key: "Enter" })); // commitAndAdd sibling

    // Re-enter edit via F2 for the Tab / Escape / blur commit paths.
    const editA = () => {
      run(() => h.focusNode("a"));
      run(() => fireEvent.keyDown(document, { key: "F2" }));
    };
    editA();
    run(() => fireEvent.keyDown(editable(), { key: "Tab" })); // commitAndAdd child
    editA();
    run(() => fireEvent.keyDown(editable(), { key: "Escape" })); // cancelEdit
    editA();
    run(() => fireEvent.blur(editable())); // commitEdit

    // Node affordances: follow the hyperlink (openLink → window.open, stubbed) and toggle collapse
    // (the root also has a collapse button → take the first).
    run(() => fireEvent.click(screen.getByTitle(/Follow link/)));
    expect(window.open).toHaveBeenCalled();
    // 📝 indicator (present only because the node has a note) → asks the app to open the Notes tab.
    // Do this before the collapse below, which collapses the root and hides the node.
    run(() => fireEvent.click(screen.getByTitle("Show note")));
    expect(onOpenNote).toHaveBeenCalled();
    run(() => fireEvent.click(screen.getAllByTitle(/Collapse|Expand/)[0]));
    expect(onChange).toHaveBeenCalled();
  });

  it("shows a roll-up badge on a node bound to a source map (I11)", () => {
    const rollupDoc: MindMapDoc = {
      schemaVersion: 1,
      id: "rd",
      title: "T",
      root: {
        id: "root",
        topic: "R",
        children: [{ id: "a", topic: "Mirrors", rollup: "src-map-id", children: [] }],
      },
    };
    mount(rollupDoc);
    expect(screen.getByLabelText("Roll-up source")).toBeTruthy();
  });

  it("uses P / Shift+P for task progress without rendering task chrome on the topic", () => {
    const taskDoc: MindMapDoc = {
      schemaVersion: 1,
      id: "td",
      title: "T",
      root: {
        id: "root",
        topic: "R",
        children: [{ id: "a", topic: "Task", task: { progress: 0.25 }, children: [] }],
      },
    };
    const { container, onChange, h } = mount(taskDoc);
    expect(container.querySelector(".mm-task-check")).toBeNull();
    expect(container.querySelector(".mm-progress-badge")).toBeNull();
    expect(screen.queryByTitle(/Task 25%/)).toBeNull();
    onChange.mockClear();
    run(() => h.focusNode("a"));
    run(() => fireEvent.keyDown(document, { key: "p" }));
    let after = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(findAnyNode(after, "a")?.task?.progress).toBe(0.5);
    run(() => fireEvent.keyDown(document, { key: "P", shiftKey: true }));
    after = onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    expect(findAnyNode(after, "a")?.task?.progress).toBe(0.25);
  });

  it("toggles the minimap, follows in-map / map links, and edits a relationship edge", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "links1",
      title: "Links",
      root: {
        id: "root",
        topic: "Root",
        children: [
          { id: "a", topic: "A", hyperlink: "#node=b", children: [] },
          { id: "b", topic: "B", hyperlink: "#map=m2", children: [] },
        ],
      },
      links: [{ id: "l1", from: "a", to: "b", label: "rel" }],
    };
    const onSelectEdge = vi.fn();
    const { container, onMapLink, onChange, h } = mount(doc, { onSelectEdge });
    // Minimap toggle (the bottom-right Panel button) — covers toggleMinimap + its localStorage write.
    run(() => fireEvent.click(screen.getByText(/Minimap/)));
    run(() => fireEvent.click(screen.getByText(/Minimap/)));
    // openLink kinds: in-map jump (#node= → focusNodeById) and map link (#map= → onMapLink).
    run(() =>
      fireEvent.click(within(nodeEl(container, "a") as HTMLElement).getByTitle(/Follow link/)),
    );
    run(() =>
      fireEvent.click(within(nodeEl(container, "b") as HTMLElement).getByTitle(/Follow link/)),
    );
    expect(onMapLink).toHaveBeenCalledWith("m2", undefined); // bare #map= link → no target node

    // Relationship edge: clicking it selects the edge and surfaces the resolved SelectedEdge. RF
    // wires the edge click on the wide invisible interaction path (the visible <g> has none).
    const edgeHit = () =>
      (container.querySelector(".react-flow__edge-interaction") ??
        container.querySelector(".react-flow__edge-path")) as Element;
    run(() => fireEvent.click(edgeHit()));
    expect(onSelectEdge).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "l1", label: "rel", arrow: "to", dash: "dashed" }),
    );

    // The imperative edge mutators apply to the selected edge.
    run(() => h.setLinkArrow("both"));
    run(() => h.setLinkStyle({ color: "#ff0000", dash: "dotted" }));
    run(() => h.setLinkLabel("depends on"));
    const link = () => (onChange.mock.calls.at(-1)?.[0] as MindMapDoc).links?.[0];
    expect(link()).toMatchObject({
      arrow: "both",
      color: "#ff0000",
      dash: "dotted",
      label: "depends on",
    });
    // Each edit re-fires onSelectEdge with the freshly-resolved edge (no re-select needed) so the
    // inspector's controls reflect the change live, not selection-time state.
    expect(onSelectEdge).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "l1",
        arrow: "both",
        color: "#ff0000",
        dash: "dotted",
        label: "depends on",
      }),
    );

    // Selecting a node clears the edge selection (mutually exclusive).
    run(() => fireEvent.click(nodeEl(container, "a")));
    expect(onSelectEdge).toHaveBeenLastCalledWith(null);
    // With no edge selected, the edge mutators are no-ops returning false.
    let ret: boolean | undefined;
    run(() => {
      ret = h.deleteLink();
    });
    expect(ret).toBe(false);

    // Re-select + delete the edge via the handle.
    run(() => fireEvent.click(edgeHit()));
    run(() => h.deleteLink());
    expect((onChange.mock.calls.at(-1)?.[0] as MindMapDoc).links).toBeUndefined();
  });

  it("status-bar view switcher reports the picked view; hidden without activeView/onSetView", () => {
    // Absent altogether when the caller opts out (no activeView/onSetView) — the default `mount()`.
    const { container } = mount();
    expect(container.querySelector('[aria-label="Switch view"]')).toBeNull();

    const onSetView = vi.fn();
    render(<FlowMindMap doc={baseDoc()} activeView="outline" onSetView={onSetView} />);
    const group = screen.getByRole("group", { name: "Switch view" });
    const mapBtn = within(group).getByRole("button", { name: "Map" });
    const outlineBtn = within(group).getByRole("button", { name: "Outline" });
    const boardBtn = within(group).getByRole("button", { name: "Board" });
    // The active view is pressed; the other two aren't.
    expect(outlineBtn.getAttribute("aria-pressed")).toBe("true");
    expect(mapBtn.getAttribute("aria-pressed")).toBe("false");
    expect(boardBtn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(boardBtn);
    expect(onSetView).toHaveBeenCalledWith("board");
    fireEvent.click(mapBtn);
    expect(onSetView).toHaveBeenCalledWith("map");
  });

  it("re-syncs on live direction / numbering / filter prop changes", () => {
    const doc = baseDoc();
    const { rerender, ref } = mount(doc);
    const view = (over: Partial<React.ComponentProps<typeof FlowMindMap>>) => (
      <FlowMindMap doc={doc} ref={ref} {...over} />
    );
    run(() => rerender(view({ direction: "brace" }))); // direction effect → sync(brace)
    run(() => rerender(view({ direction: "brace", numbered: true }))); // numbering effect → sync
    run(() => rerender(view({ direction: "brace", numbered: true, litIds: new Set(["a"]) }))); // filter
    run(() => rerender(view({ direction: "side", numbered: false, litIds: null })));
    expect(ref.current).toBeTruthy();
  });

  it("selects + edits overlays (boundary/summary/callout) with 4-way mutual exclusivity", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "ov1",
      title: "Overlays",
      root: {
        id: "root",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            callouts: [{ id: "c1", text: "note", dx: 10, dy: 0 }],
            children: [],
          },
          { id: "b", topic: "B", children: [] },
        ],
      },
      boundaries: [{ id: "bd1", nodeIds: ["a"], label: "Box" }],
      summaries: [{ id: "s1", nodeIds: ["a"], label: "Sum" }],
      links: [{ id: "l1", from: "a", to: "b", label: "rel" }],
    };
    const onSelectOverlay = vi.fn();
    const onSelectEdge = vi.fn();
    const { container, onChange, h } = mount(doc, { onSelectOverlay, onSelectEdge });
    const lastDoc = () => onChange.mock.calls.at(-1)?.[0] as MindMapDoc;

    // Click the boundary's label chip → selects the boundary.
    run(() => fireEvent.click(screen.getByText("Box")));
    expect(onSelectOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "boundary", id: "bd1" }),
    );
    // Edit + delete via the handle act on the selected overlay.
    run(() => h.setOverlayLabel("Scope"));
    expect(lastDoc().boundaries?.[0]?.label).toBe("Scope");

    // Colour the selected boundary; the swatch re-emits with the new colour, "" resets it.
    run(() => h.setOverlayColor("#3f9e6e"));
    expect(lastDoc().boundaries?.[0]?.color).toBe("#3f9e6e");
    expect(onSelectOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "boundary", id: "bd1", color: "#3f9e6e" }),
    );
    run(() => h.setOverlayColor(""));
    expect(lastDoc().boundaries?.[0]?.color).toBeUndefined();

    // Selecting the summary clears the boundary (overlay→overlay).
    run(() => fireEvent.click(screen.getByText("Sum")));
    expect(onSelectOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "summary", id: "s1" }),
    );

    // Selecting a node clears the overlay (mutual exclusivity).
    run(() => fireEvent.click(nodeEl(container, "a")));
    expect(onSelectOverlay).toHaveBeenLastCalledWith(null);
    // With no overlay selected, the overlay mutators are no-ops returning false.
    let ret: boolean | undefined;
    run(() => {
      ret = h.deleteOverlay();
    });
    expect(ret).toBe(false);
    run(() => {
      ret = h.setOverlayColor("#000");
    });
    expect(ret).toBe(false);

    // Selecting an edge then an overlay each clears the other (4-way exclusivity).
    const edgeHit = () =>
      (container.querySelector(".react-flow__edge-interaction") ??
        container.querySelector(".react-flow__edge-path")) as Element;
    run(() => fireEvent.click(edgeHit()));
    expect(onSelectEdge).toHaveBeenLastCalledWith(expect.objectContaining({ id: "l1" }));
    run(() => fireEvent.click(screen.getByText("Sum")));
    expect(onSelectEdge).toHaveBeenLastCalledWith(null); // overlay select cleared the edge

    // deleteOverlay on the selected summary removes it + fires null.
    run(() => h.deleteOverlay());
    expect(lastDoc().summaries).toBeUndefined();
    expect(onSelectOverlay).toHaveBeenLastCalledWith(null);
  });

  it("renames a summary IN PLACE (double-click the chip; empty commit deletes; Escape cancels)", async () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "sumr",
      title: "SumRename",
      root: {
        id: "root",
        topic: "R",
        children: [{ id: "a", topic: "A", children: [] }],
      },
      summaries: [{ id: "s1", nodeIds: ["a"], label: "Sum" }],
    };
    const { onChange } = mount(doc);
    const lastDoc = () => onChange.mock.calls.at(-1)?.[0] as MindMapDoc;

    // Double-click the label chip → an inline input replaces it (no modal).
    run(() => fireEvent.doubleClick(screen.getByText("Sum")));
    const input = (await screen.findByLabelText("Summary label")) as HTMLInputElement;
    expect(input.value).toBe("Sum");
    fireEvent.change(input, { target: { value: "Phase 1" } });
    run(() => fireEvent.keyDown(input, { key: "Enter" }));
    await waitFor(() => expect(lastDoc().summaries?.[0]?.label).toBe("Phase 1"));

    // Escape cancels without committing.
    run(() => fireEvent.doubleClick(screen.getByText("Phase 1")));
    const input2 = (await screen.findByLabelText("Summary label")) as HTMLInputElement;
    fireEvent.change(input2, { target: { value: "discarded" } });
    run(() => fireEvent.keyDown(input2, { key: "Escape" }));
    expect(lastDoc().summaries?.[0]?.label).toBe("Phase 1");

    // Committing an empty label removes the summary (the old prompt's semantics, kept).
    run(() => fireEvent.doubleClick(screen.getByText("Phase 1")));
    const input3 = (await screen.findByLabelText("Summary label")) as HTMLInputElement;
    fireEvent.change(input3, { target: { value: "" } });
    run(() => fireEvent.keyDown(input3, { key: "Enter" }));
    await waitFor(() => expect(lastDoc().summaries).toBeUndefined());
  });

  it("edge right-click opens a relationship menu (label / arrows / line / type / delete)", async () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "edgemenu",
      title: "EdgeMenu",
      root: {
        id: "root",
        topic: "R",
        children: [
          { id: "a", topic: "A", children: [] },
          { id: "b", topic: "B", children: [] },
        ],
      },
      links: [{ id: "l1", from: "a", to: "b", label: "rel" }],
    };
    const onSelectEdge = vi.fn();
    const { container, onChange } = mount(doc, { onSelectEdge });
    const lastDoc = () => onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    const edgeHit = () =>
      (container.querySelector(".react-flow__edge-interaction") ??
        container.querySelector(".react-flow__edge-path")) as Element;

    // Right-click selects the edge (inspector follows) and opens the menu — no delete confirm.
    run(() => fireEvent.contextMenu(edgeHit()));
    expect(onSelectEdge).toHaveBeenLastCalledWith(expect.objectContaining({ id: "l1" }));
    const menu = await screen.findByRole("menu", { name: "Relationship actions" });
    expect(within(menu).getByText("Edit label")).toBeTruthy();

    // The style chips write through: flip the arrowheads to ↔ and the line to solid.
    run(() => fireEvent.click(within(menu).getByRole("button", { name: "Arrowheads: both" })));
    expect(lastDoc().links?.[0]?.arrow).toBe("both");
    run(() => fireEvent.click(within(menu).getByRole("button", { name: "Line style: solid" })));
    expect(lastDoc().links?.[0]?.dash).toBe("solid");
    run(() =>
      fireEvent.click(within(menu).getByRole("button", { name: "Relationship type: blocks" })),
    );
    expect(lastDoc().links?.[0]?.type).toBe("blocks");

    // "Edit label" hands off to the inline editor on the line.
    run(() => fireEvent.click(within(menu).getByText("Edit label")));
    expect(await screen.findByLabelText("Relationship label")).toBeTruthy();

    // Reopen and delete — one click, undoable, no confirm dialog.
    run(() => fireEvent.contextMenu(edgeHit()));
    const menu2 = await screen.findByRole("menu", { name: "Relationship actions" });
    run(() => fireEvent.click(within(menu2).getByText("Delete relationship")));
    expect(lastDoc().links).toBeUndefined();
  });

  it("deletes the selected overlay with the Delete key", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "ovk",
      title: "OK",
      root: {
        id: "root",
        topic: "R",
        children: [
          { id: "a", topic: "A", children: [] },
          { id: "b", topic: "B", children: [] },
        ],
      },
      boundaries: [{ id: "bd1", nodeIds: ["a"], label: "Box" }],
    };
    const { onChange } = mount(doc);
    const lastDoc = () => onChange.mock.calls.at(-1)?.[0] as MindMapDoc;
    run(() => fireEvent.click(screen.getByText("Box"))); // select the boundary
    run(() => fireEvent.keyDown(document, { key: "Delete" })); // Delete-key listener removes it
    expect(lastDoc()?.boundaries ?? []).toEqual([]);
  });

  it("restores a tab session: seeds the undo history (reports it) and round-trips via getSession", () => {
    const prior = baseDoc("prior"); // a prior snapshot to seed the undo stack with
    const onHistory = vi.fn();
    const { h } = mount(baseDoc(), {
      initialSession: {
        viewport: { x: 10, y: 20, zoom: 1.5 },
        history: { past: [{ doc: prior, anchor: null }], future: [] },
      },
      onHistory,
    });
    // The restored undo depth is reported on mount, so the chrome's Undo button enables.
    expect(onHistory).toHaveBeenCalledWith(true, false);
    // getSession round-trips the seeded history + returns a viewport object.
    const session = h.getSession();
    expect(session.history.past).toHaveLength(1);
    expect(session.history.past[0].doc.id).toBe("prior");
    expect(typeof session.viewport.zoom).toBe("number");
  });

  it("a fresh canvas (no initialSession) reports an empty history + captures one via getSession", () => {
    const onHistory = vi.fn();
    const { h } = mount(baseDoc(), { onHistory });
    expect(onHistory).toHaveBeenCalledWith(false, false); // nothing to undo/redo on a fresh mount
    expect(h.getSession().history.past).toHaveLength(0);
  });
});
