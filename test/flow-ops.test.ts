import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetOpsClock,
  __setOpsClock,
  addAttachment,
  addChild,
  addFloatingTopic,
  addHyperlink,
  addLink,
  addSibling,
  addSiblingBefore,
  addStickyNote,
  addSubtree,
  alignNodes,
  applyAcrossIds,
  applyRollups,
  assignBranchColors,
  bulkToggleIcon,
  bulkToggleTag,
  clearBackdrop,
  collectRollupMapIds,
  deleteBoundary,
  deleteLink,
  deleteNode,
  deleteNodes,
  deleteSummary,
  deleteTag,
  detachBranch,
  distributeNodes,
  findAnyNode,
  findNode,
  findParent,
  groupBranch,
  groupNodes,
  groupSummary,
  indent,
  isolateBranch,
  maximalBranchIds,
  mergeStyle,
  moveInTree,
  moveSelectionInTree,
  moveSibling,
  newMapFromBranch,
  nextSelectionId,
  nodePath,
  outdent,
  pasteBranch,
  removeAttachment,
  removeHyperlink,
  renameTag,
  reparent,
  replaceTopics,
  selectionFields,
  selectionMarkers,
  selectionTags,
  setAllExpanded,
  setBackdrop,
  setBackdropColor,
  setBackdropRings,
  setBackground,
  setBackgroundImage,
  setBoundaryColor,
  setBoundaryDash,
  setBoundaryLabel,
  setBoundaryShape,
  setBranchColor,
  setBranchExpandedToLevel,
  setBranchGrowth,
  setCalloutColor,
  setConnectorStyle,
  setDue,
  setExpandedToLevel,
  setFontFamily,
  setFontScale,
  setFreeform,
  setHyperlink,
  setImage,
  setLegend,
  setLineDash,
  setLineJumps,
  setLinkArrow,
  setLinkLabel,
  setLinkStyle,
  setNodeLayout,
  setNodePos,
  setNodePositions,
  setNote,
  setNumberStyle,
  setPriority,
  setProgress,
  setRollup,
  setRules,
  setStart,
  setSummaryColor,
  setSummaryLabel,
  setTags,
  setTopic,
  setTopicRich,
  shiftDates,
  sortChildren,
  subtreeExportDoc,
  toggleCollapse,
  toggleIcon,
  toggleLocked,
  viewDoc,
} from "../src/mindmap/flow/ops";
import { fontScaleFactor } from "../src/mindmap/flow/style";
import type { MapNode, MindMapDoc } from "../src/model/types";

const base = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "A",
        children: [
          { id: "a1", topic: "A1", children: [] },
          { id: "a2", topic: "A2", children: [] },
        ],
      },
      { id: "b", topic: "B", children: [] },
    ],
  },
  links: [{ id: "l", from: "a1", to: "b", label: "x" }],
  boundaries: [{ id: "bd", nodeIds: ["a1", "a2"], label: "grp" }],
});

const kids = (doc: MindMapDoc, id: string) => findNode(doc, id)?.children.map((c) => c.id) ?? [];
// Floating-aware children lookup (findNode only walks the central tree; floating subtrees need this).
const achildren = (doc: MindMapDoc, id: string) =>
  findAnyNode(doc, id)?.children.map((c) => c.id) ?? [];
const floatIds = (doc: MindMapDoc) => (doc.floatingTopics ?? []).map((t) => t.id);

// Freeze the ops clock so timestamp-stamping ops (create/content) are deterministic across the suite.
const CLOCK = 1_700_000_000_000;
beforeEach(() => __setOpsClock(() => CLOCK));
afterEach(() => __resetOpsClock());

describe("flow ops — structural", () => {
  it("addSibling inserts after the target under the same parent", () => {
    const { doc, selectId } = addSibling(base(), "a1");
    expect(kids(doc, "a")).toEqual(["a1", selectId, "a2"]);
    expect(findNode(doc, selectId as string)?.topic).toBe("");
  });

  it("addSiblingBefore inserts before the target under the same parent", () => {
    const { doc, selectId } = addSiblingBefore(base(), "a1");
    expect(doc.root.children[0].children.map((node) => node.id)).toEqual([selectId, "a1", "a2"]);
  });

  it("addSibling on the root adds a child instead", () => {
    const { doc, selectId } = addSibling(base(), "r");
    expect(kids(doc, "r")).toContain(selectId);
  });

  it("findParent returns the parent node (null for root / floating-top / missing)", () => {
    expect(findParent(base(), "a1")?.id).toBe("a");
    expect(findParent(base(), "a")?.id).toBe("r");
    expect(findParent(base(), "r")).toBeNull(); // the central root has no parent
    expect(findParent(base(), "missing")).toBeNull();
    const withFloat = {
      ...base(),
      floatingTopics: [
        { id: "f", topic: "F", children: [{ id: "f1", topic: "F1", children: [] }] },
      ],
    };
    expect(findParent(withFloat, "f1")?.id).toBe("f");
    expect(findParent(withFloat, "f")).toBeNull(); // a floating top-level node has no parent
  });

  it("addChild appends and expands the parent", () => {
    const start = base();
    if (findNode(start, "b")) (findNode(start, "b") as { collapsed?: boolean }).collapsed = true;
    const { doc, selectId } = addChild(start, "b");
    expect(kids(doc, "b")).toEqual([selectId]);
    expect(findNode(doc, "b")?.collapsed).toBe(false);
  });

  it("outdent moves a node up to be a sibling of its parent", () => {
    const { doc } = outdent(base(), "a1");
    expect(kids(doc, "a")).toEqual(["a2"]);
    expect(kids(doc, "r")).toEqual(["a", "a1", "b"]);
  });

  it("outdent is a no-op when the parent is the root", () => {
    expect(kids(outdent(base(), "a").doc, "r")).toEqual(["a", "b"]);
  });

  it("indent moves a node under its previous sibling", () => {
    const { doc } = indent(base(), "a2");
    expect(kids(doc, "a")).toEqual(["a1"]);
    expect(kids(doc, "a1")).toEqual(["a2"]);
  });

  it("moveSibling swaps with the adjacent sibling and no-ops at the ends", () => {
    expect(kids(moveSibling(base(), "a", "down").doc, "r")).toEqual(["b", "a"]);
    expect(kids(moveSibling(base(), "b", "up").doc, "r")).toEqual(["b", "a"]);
    expect(kids(moveSibling(base(), "a", "up").doc, "r")).toEqual(["a", "b"]); // first → no-op
    expect(kids(moveSibling(base(), "a1", "down").doc, "a")).toEqual(["a2", "a1"]);
  });

  it("deleteNode removes the subtree and prunes dangling links + boundaries", () => {
    const { doc } = deleteNode(base(), "a1");
    expect(findNode(doc, "a1")).toBeNull();
    expect(doc.links).toEqual([]); // l referenced a1
    expect(doc.boundaries?.[0]?.nodeIds).toEqual(["a2"]);
  });

  it("deleteNode refuses to delete the root", () => {
    expect(deleteNode(base(), "r").doc.root.id).toBe("r");
  });

  it("deleteNodes removes every selected subtree as one edit and counts the top-level topics", () => {
    const r = deleteNodes(base(), ["a", "b"]);
    expect(findNode(r.doc, "a")).toBeNull();
    expect(findNode(r.doc, "b")).toBeNull();
    expect(kids(r.doc, "r")).toEqual([]);
    expect(r.removed).toBe(2);
    expect(r.doc.links).toEqual([]); // a1→b pruned with its endpoints
    expect(r.doc.boundaries).toBeUndefined(); // a1,a2 gone → boundary dropped
  });

  it("deleteNodes absorbs a descendant of another selected node (counts once)", () => {
    const r = deleteNodes(base(), ["a", "a1"]); // a1 is inside a
    expect(findNode(r.doc, "a")).toBeNull();
    expect(r.removed).toBe(1);
    // order-independent: child-before-parent collapses the same way
    expect(deleteNodes(base(), ["a1", "a"]).removed).toBe(1);
  });

  it("deleteNodes skips the root and selects a surviving node", () => {
    const r = deleteNodes(base(), ["r", "a"]);
    expect(r.doc.root.id).toBe("r"); // root never deleted
    expect(findNode(r.doc, "a")).toBeNull();
    expect(r.removed).toBe(1);
    expect(findAnyNode(r.doc, r.selectId ?? "")).not.toBeNull(); // selection survives
  });

  it("deleteNodes is a no-op when only the root (or nothing) is selected", () => {
    const d = base();
    const r = deleteNodes(d, ["r"]);
    expect(r.doc).toBe(d); // unchanged: same reference, nothing removed
    expect(r.removed).toBe(0);
    expect(deleteNodes(base(), []).removed).toBe(0);
  });

  it("reparent moves a subtree and guards against cycles", () => {
    const { doc } = reparent(base(), "b", "a");
    expect(kids(doc, "r")).toEqual(["a"]);
    expect(kids(doc, "a")).toContain("b");
    // cycle: can't move a under its own descendant a1
    expect(kids(reparent(base(), "a", "a1").doc, "r")).toEqual(["a", "b"]);
  });

  it("moveInTree nests a node as a child of the target (where='child')", () => {
    const { doc, selectId } = moveInTree(base(), "b", "a", "child");
    expect(selectId).toBe("b");
    expect(kids(doc, "r")).toEqual(["a"]);
    expect(kids(doc, "a")).toEqual(["a1", "a2", "b"]);
  });

  it("moveInTree places a node before / after a sibling, fixing the index after removal", () => {
    // b before a1 (different parent): b lands first under a
    expect(kids(moveInTree(base(), "b", "a1", "before").doc, "a")).toEqual(["b", "a1", "a2"]);
    // a1 after a2 (same parent): removing a1 first, then insert after a2 → ["a2","a1"]
    expect(kids(moveInTree(base(), "a1", "a2", "after").doc, "a")).toEqual(["a2", "a1"]);
    // a2 before a1 (same parent reorder) → ["a2","a1"]
    expect(kids(moveInTree(base(), "a2", "a1", "before").doc, "a")).toEqual(["a2", "a1"]);
  });

  it("moveInTree guards self-drops, cycles, and a dragged root", () => {
    // self-drop → unchanged
    expect(kids(moveInTree(base(), "a", "a", "child").doc, "a")).toEqual(["a1", "a2"]);
    // cycle: drop a under its own descendant a1 → unchanged
    expect(kids(moveInTree(base(), "a", "a1", "child").doc, "r")).toEqual(["a", "b"]);
    // dragging the root → unchanged
    expect(kids(moveInTree(base(), "r", "a", "child").doc, "r")).toEqual(["a", "b"]);
  });

  describe("moveSelectionInTree (group drag)", () => {
    it("moves every selected sibling under the target as a child (one step)", () => {
      const { doc, selectId } = moveSelectionInTree(base(), ["a1", "a2"], "a1", "b", "child");
      expect(kids(doc, "b")).toEqual(["a1", "a2"]); // both reparented under b
      expect(kids(doc, "a")).toEqual([]); // …out of a
      expect(selectId).toBe("a1"); // the grabbed node stays selected
    });

    it("moves selected siblings before the target, preserving order", () => {
      const doc = moveSelectionInTree(base(), ["a1", "a2"], "a1", "b", "before").doc;
      expect(kids(doc, "r")).toEqual(["a", "a1", "a2", "b"]);
      expect(kids(doc, "a")).toEqual([]);
    });

    it("doesn't double-move a node nested under another selected node", () => {
      // Select a parent (a) AND its child (a1); a1 moves WITH a, not separately.
      const doc = moveSelectionInTree(base(), ["a", "a1"], "a", "b", "child").doc;
      expect(kids(doc, "b")).toEqual(["a"]); // a moved under b…
      expect(kids(doc, "a")).toEqual(["a1", "a2"]); // …with a1 still inside it
    });

    it("never moves the root and honours the per-node cycle guard", () => {
      // Select root + b: root is skipped, b moves under a.
      expect(kids(moveSelectionInTree(base(), ["r", "b"], "b", "a", "child").doc, "a")).toEqual([
        "a1",
        "a2",
        "b",
      ]);
      // Select a + b, drop on a1 (a descendant of a): a can't enter its own subtree (no-op), b can.
      const doc = moveSelectionInTree(base(), ["a", "b"], "a", "a1", "child").doc;
      expect(achildren(doc, "a1")).toEqual(["b"]); // b nested under a1
      expect(kids(doc, "a")).toEqual(["a1", "a2"]); // a unchanged (cycle guard)
    });

    it("returns the doc unchanged when nothing is movable", () => {
      const d = base();
      expect(moveSelectionInTree(d, ["r"], "r", "a", "child").doc).toBe(d); // only the root selected
    });
  });

  describe("applyAcrossIds", () => {
    it("folds a per-node op over every id in one result", () => {
      const d = applyAcrossIds(base(), ["a", "b"], (doc, id) => setPriority(doc, id, 1)).doc;
      expect(findNode(d, "a")?.task?.priority).toBe(1);
      expect(findNode(d, "b")?.task?.priority).toBe(1);
    });

    it("returns the doc unchanged when no op changes anything", () => {
      const d = base();
      expect(applyAcrossIds(d, [], (doc) => ({ doc })).doc).toBe(d); // empty id set → no-op
    });
  });

  it("groupBranch wraps a node + its whole subtree in a new boundary (PREP-A pin)", () => {
    const { doc, selectId } = groupBranch(base(), "a");
    expect(selectId).toBe("a");
    expect(doc.boundaries?.at(-1)?.nodeIds).toEqual(["a", "a1", "a2"]);
  });

  it("groupNodes wraps an arbitrary selection (deduped, missing ids dropped); none valid = no-op", () => {
    expect(groupNodes(base(), ["a", "b", "a"]).doc.boundaries?.at(-1)?.nodeIds).toEqual(["a", "b"]);
    expect(groupNodes(base(), ["a", "ghost"]).doc.boundaries?.at(-1)?.nodeIds).toEqual(["a"]);
    // no valid id → unchanged (only the seed "bd" boundary remains)
    expect(groupNodes(base(), ["ghost"]).doc.boundaries?.length).toBe(1);
  });

  it("isolateBranch collapses other top branches and reveals the path to the node", () => {
    // a1 lives under top branch "a"; "b" collapses, "a" stays expanded.
    const d1 = isolateBranch(base(), "a1");
    expect(d1.selectId).toBe("a1");
    expect(findNode(d1.doc, "b")?.collapsed).toBe(true);
    expect(findNode(d1.doc, "a")?.collapsed).toBeUndefined();
    // isolating a top branch itself collapses its siblings
    const d2 = isolateBranch(base(), "b");
    expect(findNode(d2.doc, "a")?.collapsed).toBe(true);
    expect(findNode(d2.doc, "b")?.collapsed).toBeUndefined();
  });

  it("isolateBranch is a no-op for the root / a missing node", () => {
    const d = base();
    expect(isolateBranch(d, "r").doc).toBe(d);
    expect(isolateBranch(d, "ghost").doc).toBe(d);
  });
});

describe("flow ops — content", () => {
  it("setTopic renames a node; renaming the root updates the title", () => {
    expect(findNode(setTopic(base(), "a", "AA").doc, "a")?.topic).toBe("AA");
    expect(setTopic(base(), "r", "New").doc.title).toBe("New");
  });

  it("renameTag renames a tag map-wide and MERGES (dedupes) into an existing one", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "t",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", tags: ["old", "keep"], children: [] },
          { id: "b", topic: "B", tags: ["new", "old"], children: [] },
        ],
      },
    };
    // plain rename
    const renamed = renameTag(d, "old", "fresh").doc;
    expect(findNode(renamed, "a")?.tags).toEqual(["keep", "fresh"]);
    // merge: old → new where new already present on b (no duplicate)
    const merged = renameTag(d, "old", "new").doc;
    expect(findNode(merged, "b")?.tags).toEqual(["new"]);
    expect(findNode(merged, "a")?.tags).toEqual(["keep", "new"]);
    // blank target / rename-to-self / unused tag → unchanged reference
    expect(renameTag(d, "old", "  ").doc).toBe(d);
    expect(renameTag(d, "old", "old").doc).toBe(d);
    expect(renameTag(d, "missing", "x").doc).toBe(d);
  });

  it("deleteTag removes a tag from every node (dropping an emptied tags array)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "t",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", tags: ["x", "y"], children: [] },
          { id: "b", topic: "B", tags: ["x"], children: [] },
        ],
      },
    };
    const out = deleteTag(d, "x").doc;
    expect(findNode(out, "a")?.tags).toEqual(["y"]);
    expect(findNode(out, "b")?.tags).toBeUndefined(); // emptied → dropped
    expect(deleteTag(d, "missing").doc).toBe(d);
  });

  it("toggleCollapse flips a parent and is a no-op for a leaf", () => {
    expect(findNode(toggleCollapse(base(), "a").doc, "a")?.collapsed).toBe(true);
    expect(findNode(toggleCollapse(base(), "b").doc, "b")?.collapsed).toBeUndefined();
  });

  it("setAllExpanded collapses/expands every non-root branch", () => {
    const collapsed = setAllExpanded(base(), false).doc;
    expect(findNode(collapsed, "a")?.collapsed).toBe(true);
    expect(findNode(collapsed, "r")?.collapsed).toBeUndefined(); // root stays open
    expect(findNode(setAllExpanded(collapsed, true).doc, "a")?.collapsed).toBe(false);
  });

  it("toggleLocked flips the locked flag on (true) and off (cleared) for any node", () => {
    const on = toggleLocked(base(), "a").doc;
    expect(findNode(on, "a")?.locked).toBe(true);
    expect(findNode(toggleLocked(on, "a").doc, "a")?.locked).toBeUndefined();
  });

  it("align / distribute skip a locked node, leaving its position fixed", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", pos: { x: 0, y: 0 }, locked: true, children: [] },
          { id: "b", topic: "B", pos: { x: 50, y: 100 }, children: [] },
        ],
      },
      meta: { freeform: true },
    };
    const sizes = { a: { w: 40, h: 20 }, b: { w: 20, h: 20 } };
    // Only "b" remains arrangeable → fewer than 2 boxes → no-op (locked "a" never moves).
    expect(alignNodes(doc, ["a", "b"], "left", sizes).doc).toEqual(doc);
  });

  it("alignNodes aligns positioned nodes to a shared edge/centre (using measured sizes)", () => {
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", pos: { x: 0, y: 0 }, children: [] },
          { id: "b", topic: "B", pos: { x: 50, y: 100 }, children: [] },
        ],
      },
      meta: { freeform: true },
    };
    const sizes = { a: { w: 40, h: 20 }, b: { w: 20, h: 20 } };
    expect(
      alignNodes(doc, ["a", "b"], "left", sizes).doc.root.children.map((c) => c.pos?.x),
    ).toEqual([0, 0]);
    // right: align right edges → x = maxRight - width (maxRight = max(0+40, 50+20)=70)
    expect(
      alignNodes(doc, ["a", "b"], "right", sizes).doc.root.children.map((c) => c.pos?.x),
    ).toEqual([30, 50]);
    // hcenter: centre on cx = (minX 0 + maxR 70) / 2 = 35 → x = 35 - w/2
    expect(
      alignNodes(doc, ["a", "b"], "hcenter", sizes).doc.root.children.map((c) => c.pos?.x),
    ).toEqual([15, 25]);
    // top: align top edges → y = minY (0); x untouched
    expect(
      alignNodes(doc, ["a", "b"], "top", sizes).doc.root.children.map((c) => c.pos?.y),
    ).toEqual([0, 0]);
    // bottom: align bottom edges → y = maxBottom - h (maxBottom = max(0+20, 100+20) = 120)
    expect(
      alignNodes(doc, ["a", "b"], "bottom", sizes).doc.root.children.map((c) => c.pos?.y),
    ).toEqual([100, 100]);
    // vmiddle: centre on cy = (minY 0 + maxB 120) / 2 = 60 → y = 60 - h/2
    expect(
      alignNodes(doc, ["a", "b"], "vmiddle", sizes).doc.root.children.map((c) => c.pos?.y),
    ).toEqual([50, 50]);
    // fewer than 2 positioned nodes → no-op
    expect(alignNodes(doc, ["a"], "left", sizes).doc).toEqual(doc);
  });

  it("distributeNodes evenly spaces 3+ nodes by centre along an axis", () => {
    const node = (id: string, x: number) => ({ id, topic: id, pos: { x, y: 0 }, children: [] });
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: { id: "r", topic: "R", children: [node("a", 0), node("b", 10), node("c", 100)] },
      meta: { freeform: true },
    };
    const sizes = { a: { w: 0, h: 0 }, b: { w: 0, h: 0 }, c: { w: 0, h: 0 } };
    // centres 0,?,100 → even step 50 → middle node centre 50 (width 0 → x 50)
    expect(distributeNodes(doc, ["a", "b", "c"], "h", sizes).doc.root.children[1].pos?.x).toBe(50);
    expect(distributeNodes(doc, ["a", "b"], "h", sizes).doc).toEqual(doc); // <3 → no-op
  });

  it("distributeNodes spaces nodes along the vertical axis too", () => {
    const node = (id: string, y: number) => ({ id, topic: id, pos: { x: 0, y }, children: [] });
    const doc: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: { id: "r", topic: "R", children: [node("a", 0), node("b", 10), node("c", 100)] },
      meta: { freeform: true },
    };
    const sizes = { a: { w: 0, h: 0 }, b: { w: 0, h: 0 }, c: { w: 0, h: 0 } };
    // centres 0,?,100 → even step 50 → middle node centre 50 (height 0 → y 50)
    expect(distributeNodes(doc, ["a", "b", "c"], "v", sizes).doc.root.children[1].pos?.y).toBe(50);
  });

  it("detachBranch pops a subtree out of the tree into floatingTopics (with a pos)", () => {
    const { doc, selectId } = detachBranch(base(), "a"); // a has a1, a2
    expect(kids(doc, "r")).toEqual(["b"]); // a removed from the central tree
    expect(floatIds(doc)).toEqual(["a"]); // now a top-level floating topic
    expect(selectId).toBe("a");
    const floated = doc.floatingTopics?.[0];
    expect(floated?.children.map((c) => c.id)).toEqual(["a1", "a2"]); // subtree intact
    expect(floated?.pos).toBeDefined(); // got a position so it lands somewhere in free-canvas
  });

  it("detachBranch is a no-op for the root or an already-floating topic", () => {
    const d = base();
    expect(detachBranch(d, "r").doc).toBe(d);
    const floated = detachBranch(d, "b").doc; // b → floating
    expect(detachBranch(floated, "b").doc).toBe(floated); // already floating → no-op
  });

  it("reparent re-attaches a floating topic back into the tree (detach round-trip)", () => {
    const floated = detachBranch(base(), "a").doc;
    const back = reparent(floated, "a", "r").doc;
    expect(kids(back, "r")).toContain("a");
    expect(back.floatingTopics).toBeUndefined(); // array emptied → dropped
  });

  it("setFontScale / setFontFamily set + clear map typography (comfortable + blank clear)", () => {
    const scaled = setFontScale(base(), "large").doc;
    expect(scaled.meta?.fontScale).toBe("large");
    // "comfortable" is the default → clears the override.
    expect(setFontScale(scaled, "comfortable").doc.meta?.fontScale).toBeUndefined();

    const famed = setFontFamily(base(), "Georgia, serif").doc;
    expect(famed.meta?.fontFamily).toBe("Georgia, serif");
    expect(setFontFamily(famed, "").doc.meta?.fontFamily).toBeUndefined();
  });

  it("fontScaleFactor maps the scale to a multiplier (comfortable / unset = 1)", () => {
    expect(fontScaleFactor("compact")).toBe(0.85);
    expect(fontScaleFactor("large")).toBe(1.2);
    expect(fontScaleFactor("comfortable")).toBe(1);
    expect(fontScaleFactor(undefined)).toBe(1);
  });

  it("setHyperlink stores a safe URL but strips a script-bearing scheme (F1)", () => {
    expect(findNode(setHyperlink(base(), "a", "https://example.com").doc, "a")?.hyperlink).toBe(
      "https://example.com",
    );
    // javascript:/data:/vbscript: (incl. control-char evasion) are dropped, not stored.
    expect(
      findNode(setHyperlink(base(), "a", "javascript:alert(1)").doc, "a")?.hyperlink,
    ).toBeUndefined();
    expect(
      findNode(setHyperlink(base(), "a", "java\tscript:alert(1)").doc, "a")?.hyperlink,
    ).toBeUndefined();
    expect(findNode(setHyperlink(base(), "a", "").doc, "a")?.hyperlink).toBeUndefined();
  });

  it("addHyperlink appends extras, dedups, and rejects blank/dangerous URLs", () => {
    let d = addHyperlink(base(), "a", "https://one.com").doc;
    d = addHyperlink(d, "a", "https://two.com").doc;
    expect(findNode(d, "a")?.hyperlinks).toEqual(["https://one.com", "https://two.com"]);
    // Duplicate of an existing extra is a no-op (same array reference-value).
    expect(findNode(addHyperlink(d, "a", "https://one.com").doc, "a")?.hyperlinks).toEqual([
      "https://one.com",
      "https://two.com",
    ]);
    // Blank + script-bearing schemes never persist.
    expect(findNode(addHyperlink(base(), "a", "   ").doc, "a")?.hyperlinks).toBeUndefined();
    expect(
      findNode(addHyperlink(base(), "a", "javascript:alert(1)").doc, "a")?.hyperlinks,
    ).toBeUndefined();
  });

  it("addHyperlink won't duplicate the primary hyperlink into the extras", () => {
    const withPrimary = setHyperlink(base(), "a", "https://primary.com").doc;
    expect(
      findNode(addHyperlink(withPrimary, "a", "https://primary.com").doc, "a")?.hyperlinks,
    ).toBeUndefined();
  });

  it("removeHyperlink drops one extra and clears the array when empty", () => {
    let d = addHyperlink(base(), "a", "https://one.com").doc;
    d = addHyperlink(d, "a", "https://two.com").doc;
    const afterFirst = removeHyperlink(d, "a", 0).doc;
    expect(findNode(afterFirst, "a")?.hyperlinks).toEqual(["https://two.com"]);
    expect(findNode(removeHyperlink(afterFirst, "a", 0).doc, "a")?.hyperlinks).toBeUndefined();
    // Out-of-range index is a no-op.
    expect(findNode(removeHyperlink(d, "a", 9).doc, "a")?.hyperlinks).toEqual([
      "https://one.com",
      "https://two.com",
    ]);
  });

  it("nextSelectionId moves selection by logical tree direction", () => {
    const d = base(); // r → [a → [a1, a2], b]
    expect(nextSelectionId(d, "a", "left")).toBe("r"); // parent
    expect(nextSelectionId(d, "r", "left")).toBeNull(); // root has no parent
    expect(nextSelectionId(d, "a", "right")).toBe("a1"); // first child
    expect(nextSelectionId(d, "b", "right")).toBeNull(); // leaf
    expect(nextSelectionId(d, "a1", "down")).toBe("a2"); // next sibling
    expect(nextSelectionId(d, "a2", "down")).toBeNull(); // last sibling
    expect(nextSelectionId(d, "a2", "up")).toBe("a1"); // prev sibling
    expect(nextSelectionId(d, "a1", "up")).toBeNull(); // first sibling
    expect(nextSelectionId(d, "a", "down")).toBe("b"); // a → b
    expect(nextSelectionId(d, "ghost", "left")).toBeNull(); // unknown id
  });

  it("nextSelectionId does not descend into a collapsed node", () => {
    const d = base();
    const a = findNode(d, "a");
    if (a) a.collapsed = true;
    expect(nextSelectionId(d, "a", "right")).toBeNull();
  });

  it("viewDoc re-roots at the drill target and drops map-level overlays (full doc otherwise)", () => {
    const v = viewDoc(base(), "a");
    expect(v.root.id).toBe("a");
    expect(v.root.collapsed).toBe(false); // the drilled node is shown expanded
    expect(v.root.children.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(v.links).toEqual([]); // map-level links/boundaries hidden while drilled
    expect(v.boundaries).toEqual([]);
    // No/invalid/root drill → the full doc unchanged (callers can use it unconditionally).
    expect(viewDoc(base(), null)).toEqual(base());
    expect(viewDoc(base(), "missing")).toEqual(base());
    expect(viewDoc(base(), "r")).toEqual(base());
    // Pure: the drilled node in the source is not mutated.
    const src = base();
    viewDoc(src, "a");
    expect(findNode(src, "a")?.collapsed).toBeUndefined();
  });

  it("assignBranchColors gives each top branch a cycled colour (no-op on empty palette)", () => {
    const colored = assignBranchColors(base(), ["#111", "#222"]).doc;
    expect(findNode(colored, "a")?.branchColor).toBe("#111");
    expect(findNode(colored, "b")?.branchColor).toBe("#222");
    // cycles when there are more branches than colours
    expect(
      assignBranchColors(base(), ["#111"]).doc.root.children.map((c) => c.branchColor),
    ).toEqual(["#111", "#111"]);
    expect(assignBranchColors(base(), []).doc).toEqual(base()); // empty palette = no change
  });

  it("setExpandedToLevel collapses topics at/below the level, expands above it", () => {
    // base(): r(0) → a(1, has children a1/a2) → ...; b(1, leaf). Only `a` is a collapsible branch.
    const l1 = setExpandedToLevel(base(), 1).doc; // level 1 → depth-1 branches collapse
    expect(findNode(l1, "a")?.collapsed).toBe(true);
    expect(findNode(l1, "r")?.collapsed).toBeUndefined(); // root never collapses
    const l2 = setExpandedToLevel(base(), 2).doc; // level 2 → depth-1 branch expands again
    expect(findNode(l2, "a")?.collapsed).toBe(false);
    // Clamp: level 0 behaves like level 1 (≥1).
    expect(findNode(setExpandedToLevel(base(), 0).doc, "a")?.collapsed).toBe(true);
  });

  it("setBranchExpandedToLevel applies digits relative to the selected topic only", () => {
    const doc = base();
    const a1 = findNode(doc, "a1");
    const b = findNode(doc, "b");
    if (!a1 || !b) throw new Error("fixture nodes missing");
    a1.children = [
      {
        id: "a11",
        topic: "A11",
        children: [{ id: "a111", topic: "A111", children: [] }],
      },
    ];
    b.children = [{ id: "b1", topic: "B1", children: [] }];
    b.collapsed = true;

    const level1 = setBranchExpandedToLevel(doc, "a", 1);
    expect(level1.selectId).toBe("a");
    expect(findNode(level1.doc, "a")?.collapsed).toBe(false);
    expect(findNode(level1.doc, "a1")?.collapsed).toBe(true);
    expect(findNode(level1.doc, "a11")?.collapsed).toBe(true);
    expect(findNode(level1.doc, "b")?.collapsed).toBe(true); // unrelated branch is unchanged

    const level2 = setBranchExpandedToLevel(doc, "a", 2).doc;
    expect(findNode(level2, "a")?.collapsed).toBe(false);
    expect(findNode(level2, "a1")?.collapsed).toBe(false);
    expect(findNode(level2, "a11")?.collapsed).toBe(true);

    const all = setBranchExpandedToLevel(level1.doc, "a", 0).doc;
    expect(findNode(all, "a")?.collapsed).toBe(false);
    expect(findNode(all, "a1")?.collapsed).toBe(false);
    expect(findNode(all, "a11")?.collapsed).toBe(false);
    expect(findNode(all, "b")?.collapsed).toBe(true);
  });

  it("setNote / toggleIcon / mergeStyle update and clear cleanly", () => {
    expect(findNode(setNote(base(), "a", "hi").doc, "a")?.note).toBe("hi");
    expect(
      findNode(setNote(setNote(base(), "a", "hi").doc, "a", "").doc, "a")?.note,
    ).toBeUndefined();
    // a whitespace-only note is "no note" — cleared so the 📝 indicator disappears
    expect(
      findNode(setNote(setNote(base(), "a", "hi").doc, "a", "   ").doc, "a")?.note,
    ).toBeUndefined();
    expect(findNode(toggleIcon(base(), "a", "⭐").doc, "a")?.icons).toEqual(["⭐"]);
    expect(
      findNode(toggleIcon(toggleIcon(base(), "a", "⭐").doc, "a", "⭐").doc, "a")?.icons,
    ).toBeUndefined();
    // single-select group: adding a second status marker replaces the first (at most one per group)
    const status = toggleIcon(toggleIcon(base(), "a", "🔴").doc, "a", "🟢").doc;
    expect(findNode(status, "a")?.icons).toEqual(["🟢"]);
    const styled = mergeStyle(base(), "a", { background: "#fff", color: "#000" }).doc;
    expect(findNode(styled, "a")?.style).toEqual({ background: "#fff", color: "#000" });
    expect(findNode(mergeStyle(styled, "a", { background: "" }).doc, "a")?.style).toEqual({
      color: "#000",
    });
  });

  it("addSubtree grafts a re-id'd forest under a node and expands it", () => {
    const start = base();
    const target = findNode(start, "b");
    if (target) (target as { collapsed?: boolean }).collapsed = true;
    const { doc, selectId } = addSubtree(start, "b", [
      { id: "x", topic: "X", children: [{ id: "y", topic: "Y", children: [] }] },
    ]);
    const b = findNode(doc, "b");
    expect(b?.children.map((c) => c.topic)).toEqual(["X"]);
    expect(b?.children[0].children.map((c) => c.topic)).toEqual(["Y"]);
    expect(b?.collapsed).toBe(false);
    expect(b?.children[0].id).not.toBe("x"); // re-id'd, so repeated pastes can't collide
    expect(selectId).toBe(b?.children[0].id);
    // empty forest → the same doc, untouched
    const d = base();
    expect(addSubtree(d, "b", []).doc).toBe(d);
  });

  it("setTags replaces a node's tags and clears them on an empty array", () => {
    expect(findNode(setTags(base(), "a", ["x", "y"]).doc, "a")?.tags).toEqual(["x", "y"]);
    expect(
      findNode(setTags(setTags(base(), "a", ["x"]).doc, "a", []).doc, "a")?.tags,
    ).toBeUndefined();
  });

  it("setBackground sets the per-map background and clears it on empty", () => {
    expect(setBackground(base(), "#fee").doc.meta?.background).toBe("#fee");
    expect(
      setBackground(setBackground(base(), "#fee").doc, "").doc.meta?.background,
    ).toBeUndefined();
  });

  it("setPriority sets task priority and clears it on undefined", () => {
    expect(findNode(setPriority(base(), "a", 1).doc, "a")?.task?.priority).toBe(1);
    const set = setPriority(base(), "a", 2).doc;
    expect(findNode(setPriority(set, "a", undefined).doc, "a")?.task).toBeUndefined();
  });

  it("shiftDates moves every dated task in scope by ±N days, preserving offsets (item 14)", () => {
    // Seed dates: a starts 06-10/due 06-20; a1 due 06-15; b has no dates.
    let d = setDue(setStart(base(), "a", "2026-06-10").doc, "a", "2026-06-20").doc;
    d = setDue(d, "a1", "2026-06-15").doc;

    // Branch scope "a": a + a1 shift; b (outside) and undated nodes untouched.
    const branch = shiftDates(d, 7, "a").doc;
    expect(findNode(branch, "a")?.task?.start).toBe("2026-06-17");
    expect(findNode(branch, "a")?.task?.due).toBe("2026-06-27");
    expect(findNode(branch, "a1")?.task?.due).toBe("2026-06-22");

    // Whole-map scope (root id): same two dated tasks move; a negative shift goes back.
    const back = shiftDates(d, -10, "r").doc;
    expect(findNode(back, "a")?.task?.due).toBe("2026-06-10");
    expect(findNode(back, "a1")?.task?.due).toBe("2026-06-05");

    // No-ops return the ORIGINAL doc reference (so undo history doesn't churn): days=0, and a scope
    // with nothing dated.
    expect(shiftDates(d, 0, "r").doc).toBe(d);
    const undated = base();
    expect(shiftDates(undated, 5, "r").doc).toBe(undated);
  });

  it("groupSummary brackets a node's subtree, labelled, and setSummaryLabel / deleteSummary edit it", () => {
    const grouped = groupSummary(base(), "a").doc;
    expect(grouped.summaries?.length).toBe(1);
    const s = grouped.summaries?.[0];
    expect(s?.nodeIds.sort()).toEqual(["a", "a1", "a2"]); // node + whole subtree
    expect(s?.label).toBe("Summary");
    // rename
    const renamed = setSummaryLabel(grouped, s?.id ?? "", "Phase 1").doc;
    expect(renamed.summaries?.[0]?.label).toBe("Phase 1");
    // clearing the label leaves the summary (label undefined → renders the default)
    expect(setSummaryLabel(grouped, s?.id ?? "", "").doc.summaries?.[0]?.label).toBeUndefined();
    // delete drops the array
    expect(deleteSummary(grouped, s?.id ?? "").doc.summaries).toBeUndefined();
  });

  it("deleteNode prunes a summary's member ids and drops an emptied summary", () => {
    const grouped = groupSummary(base(), "a").doc; // summary over a, a1, a2
    const afterDelA1 = deleteNode(grouped, "a1").doc;
    expect(afterDelA1.summaries?.[0]?.nodeIds.sort()).toEqual(["a", "a2"]);
    // deleting the whole branch empties + drops the summary
    expect(deleteNode(grouped, "a").doc.summaries).toBeUndefined();
  });

  it("setRules sets conditional-formatting rules and clears them on an empty array", () => {
    const r = { id: "r1", kind: "tag" as const, value: "risk", style: { background: "#fee" } };
    expect(setRules(base(), [r]).doc.rules).toEqual([r]);
    expect(setRules(setRules(base(), [r]).doc, []).doc.rules).toBeUndefined();
  });

  it("setProgress sets task completion, clamps, and clears task on undefined", () => {
    expect(findNode(setProgress(base(), "a", 0.5).doc, "a")?.task?.progress).toBe(0.5);
    expect(findNode(setProgress(base(), "a", 0).doc, "a")?.task?.progress).toBe(0); // 0% is kept, not dropped
    expect(findNode(setProgress(base(), "a", -1).doc, "a")?.task?.progress).toBe(0); // clamped up
    expect(findNode(setProgress(base(), "a", 9).doc, "a")?.task?.progress).toBe(1); // clamped down
    // Clearing drops the whole task object once it carries nothing else.
    const set = setProgress(base(), "a", 0.5).doc;
    expect(findNode(setProgress(set, "a", undefined).doc, "a")?.task).toBeUndefined();
  });

  it("setProgress preserves other task fields when clearing only progress", () => {
    const withTask = structuredClone(base());
    const a = findNode(withTask, "a");
    if (a) a.task = { progress: 0.5, priority: 2 };
    const cleared = findNode(setProgress(withTask, "a", undefined).doc, "a");
    expect(cleared?.task).toEqual({ priority: 2 });
  });

  it("addAttachment / removeAttachment append and drop files, clearing an emptied array", () => {
    const a = { name: "spec.pdf", dataUrl: "data:application/pdf;base64,AA==", size: 12 };
    const b = { name: "notes.txt", dataUrl: "data:text/plain;base64,QQ==", size: 3 };
    const withTwo = addAttachment(addAttachment(base(), "a", a).doc, "a", b).doc;
    expect(findNode(withTwo, "a")?.attachments?.map((x) => x.name)).toEqual([
      "spec.pdf",
      "notes.txt",
    ]);
    const afterRemove = removeAttachment(withTwo, "a", 0).doc;
    expect(findNode(afterRemove, "a")?.attachments?.map((x) => x.name)).toEqual(["notes.txt"]);
    // Removing the last one drops the array entirely.
    expect(findNode(removeAttachment(afterRemove, "a", 0).doc, "a")?.attachments).toBeUndefined();
  });

  it("addFloatingTopic appends a detached topic, with an optional link, and selects it", () => {
    const r = addFloatingTopic(base(), "Docs", "https://example.com");
    expect(r.doc.floatingTopics?.length).toBe(1);
    expect(r.doc.floatingTopics?.[0]?.topic).toBe("Docs");
    expect(r.doc.floatingTopics?.[0]?.hyperlink).toBe("https://example.com");
    expect(r.selectId).toBe(r.doc.floatingTopics?.[0]?.id);
    expect(addFloatingTopic(base(), "Idea").doc.floatingTopics?.[0]?.hyperlink).toBeUndefined();
  });

  it("setDue / setStart set dates and clear them on empty, dropping an emptied task", () => {
    expect(findNode(setDue(base(), "a", "2026-07-01").doc, "a")?.task?.due).toBe("2026-07-01");
    expect(findNode(setStart(base(), "a", "2026-06-01").doc, "a")?.task?.start).toBe("2026-06-01");
    // The two dates coexist on one task...
    const both = setStart(setDue(base(), "a", "2026-07-01").doc, "a", "2026-06-01").doc;
    expect(findNode(both, "a")?.task).toEqual({ due: "2026-07-01", start: "2026-06-01" });
    // ...and clearing the only field drops the whole task object.
    expect(findNode(setDue(setDue(base(), "a", "2026-07-01").doc, "a", "").doc, "a")?.task).toBe(
      undefined,
    );
  });
});

describe("flow ops — free-canvas (whiteboard) mode", () => {
  it("setNodePos sets an explicit position on a tree node", () => {
    const doc = setNodePos(base(), "a1", 120, 80).doc;
    expect(findNode(doc, "a1")?.pos).toEqual({ x: 120, y: 80 });
  });

  it("setNodePos also reaches floating topics", () => {
    const withFloat = addFloatingTopic(base(), "Free").doc;
    const fid = withFloat.floatingTopics?.[0]?.id as string;
    const doc = setNodePos(withFloat, fid, 5, 6).doc;
    expect(doc.floatingTopics?.[0]?.pos).toEqual({ x: 5, y: 6 });
  });

  it("setNodePos is a no-op (same doc) for an unknown id", () => {
    const doc = base();
    expect(setNodePos(doc, "nope", 1, 2).doc).toBe(doc);
  });

  it("setNodePositions moves every listed node in one step (the group-drag path)", () => {
    const doc = setNodePositions(base(), [
      { id: "a", x: 10, y: 20 },
      { id: "b", x: 30, y: 40 },
      { id: "a1", x: 5, y: 5 },
    ]).doc;
    expect(findNode(doc, "a")?.pos).toEqual({ x: 10, y: 20 });
    expect(findNode(doc, "b")?.pos).toEqual({ x: 30, y: 40 });
    expect(findNode(doc, "a1")?.pos).toEqual({ x: 5, y: 5 });
  });

  it("setNodePositions skips locked nodes and is a no-op for an empty list", () => {
    const start = base();
    (findNode(start, "a") as { locked?: boolean }).locked = true;
    const doc = setNodePositions(start, [
      { id: "a", x: 10, y: 20 }, // locked → ignored
      { id: "b", x: 30, y: 40 },
    ]).doc;
    expect(findNode(doc, "a")?.pos).toBeUndefined();
    expect(findNode(doc, "b")?.pos).toEqual({ x: 30, y: 40 });
    expect(setNodePositions(start, []).doc).toBe(start); // empty list → same ref
  });

  it("setNodePositions also reaches floating topics", () => {
    const withFloat = addFloatingTopic(base(), "Free").doc;
    const fid = withFloat.floatingTopics?.[0]?.id as string;
    const doc = setNodePositions(withFloat, [{ id: fid, x: 7, y: 8 }]).doc;
    expect(doc.floatingTopics?.[0]?.pos).toEqual({ x: 7, y: 8 });
  });

  it("setNodeLayout sets a per-branch layout override and clears it on undefined / empty", () => {
    const d1 = setNodeLayout(base(), "a", "org-down").doc;
    expect(findNode(d1, "a")?.layout).toBe("org-down");
    expect(findNode(setNodeLayout(d1, "a", undefined).doc, "a")?.layout).toBeUndefined();
    expect(findNode(setNodeLayout(d1, "a", "").doc, "a")?.layout).toBeUndefined();
    const noNode = base();
    expect(setNodeLayout(noNode, "nope", "grid").doc).toBe(noNode); // no-op for unknown id
  });

  it("setFreeform on seeds pos from the map + flags meta.freeform", () => {
    const positions = new Map([
      ["r", { x: 0, y: 0 }],
      ["a", { x: 10, y: 10 }],
      ["a1", { x: 20, y: 20 }],
    ]);
    const doc = setFreeform(base(), true, positions).doc;
    expect(doc.meta?.freeform).toBe(true);
    expect(findNode(doc, "a")?.pos).toEqual({ x: 10, y: 10 });
    expect(findNode(doc, "a1")?.pos).toEqual({ x: 20, y: 20 });
    expect(findNode(doc, "b")?.pos).toBeUndefined(); // not in the map → untouched
  });

  it("setFreeform off clears the flag but retains positions (for re-enabling)", () => {
    const on = setFreeform(base(), true, new Map([["a", { x: 9, y: 9 }]])).doc;
    const off = setFreeform(on, false).doc;
    expect(off.meta?.freeform).toBeUndefined();
    expect(findNode(off, "a")?.pos).toEqual({ x: 9, y: 9 });
  });
});

describe("flow ops — diagram backdrops", () => {
  it("setBackdrop sets the frame; clearBackdrop removes it", () => {
    const d = setBackdrop(base(), "onion", 3).doc;
    expect(d.backdrop).toEqual({ kind: "onion", rings: 3 });
    expect(clearBackdrop(d).doc.backdrop).toBeUndefined();
    const noBackdrop = base();
    expect(clearBackdrop(noBackdrop).doc).toBe(noBackdrop); // no-op returns the same doc
  });

  it("setBackdropRings clamps to 2..6 and is a no-op for venn", () => {
    const o = setBackdrop(base(), "onion", 3).doc;
    expect(setBackdropRings(o, 5).doc.backdrop?.rings).toBe(6);
    expect(setBackdropRings(o, -5).doc.backdrop?.rings).toBe(2);
    const v = setBackdrop(base(), "venn2").doc;
    expect(setBackdropRings(v, 1).doc.backdrop).toEqual({ kind: "venn2" });
  });

  it("setBackdropColor sets / clears a colour override and is a no-op without a backdrop", () => {
    const o = setBackdrop(base(), "onion", 3).doc;
    expect(setBackdropColor(o, "#ff8800").doc.backdrop?.color).toBe("#ff8800");
    // Clearing with "" drops the field (absent = default accent, lossless in .json).
    const colored = setBackdropColor(o, "#ff8800").doc;
    expect(setBackdropColor(colored, "").doc.backdrop?.color).toBeUndefined();
    const noBackdrop = base();
    expect(setBackdropColor(noBackdrop, "#ff8800").doc).toBe(noBackdrop); // no-op returns same doc
  });
});

describe("flow ops — per-overlay colours", () => {
  // A doc with a boundary, a summary, and a node-anchored callout to colour.
  const withOverlays = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "Root",
    root: {
      id: "r",
      topic: "Root",
      children: [
        { id: "a", topic: "A", children: [], callouts: [{ id: "co", text: "n", dx: 8, dy: 0 }] },
        { id: "b", topic: "B", children: [] },
      ],
    },
    boundaries: [{ id: "bd", nodeIds: ["a", "b"], label: "grp" }],
    summaries: [{ id: "su", nodeIds: ["a"], label: "Phase 1" }],
  });

  it("setBoundaryColor sets / clears a boundary's colour by id", () => {
    expect(setBoundaryColor(withOverlays(), "bd", "#3f9e6e").doc.boundaries?.[0]?.color).toBe(
      "#3f9e6e",
    );
    const colored = setBoundaryColor(withOverlays(), "bd", "#3f9e6e").doc;
    expect(setBoundaryColor(colored, "bd", "").doc.boundaries?.[0]?.color).toBeUndefined();
    const d = withOverlays();
    expect(setBoundaryColor(d, "ghost", "#000").doc).toBe(d); // no-op for unknown id
  });

  it("setBoundaryShape sets / clears a boundary's outline shape; roundRect clears, no-op for unknown id", () => {
    expect(setBoundaryShape(withOverlays(), "bd", "rect").doc.boundaries?.[0]?.shape).toBe("rect");
    const shaped = setBoundaryShape(withOverlays(), "bd", "rect").doc;
    expect(setBoundaryShape(shaped, "bd", "roundRect").doc.boundaries?.[0]?.shape).toBeUndefined();
    const d = withOverlays();
    expect(setBoundaryShape(d, "ghost", "rect").doc).toBe(d); // no-op for unknown id
  });

  it("setBoundaryDash sets / clears a boundary's line style; solid clears, no-op for unknown id", () => {
    expect(setBoundaryDash(withOverlays(), "bd", "dashed").doc.boundaries?.[0]?.dash).toBe(
      "dashed",
    );
    const dashed = setBoundaryDash(withOverlays(), "bd", "dashed").doc;
    expect(setBoundaryDash(dashed, "bd", "solid").doc.boundaries?.[0]?.dash).toBeUndefined();
    const d = withOverlays();
    expect(setBoundaryDash(d, "ghost", "dashed").doc).toBe(d); // no-op for unknown id
  });

  it("setSummaryColor sets / clears a summary's colour by id", () => {
    expect(setSummaryColor(withOverlays(), "su", "#e0697f").doc.summaries?.[0]?.color).toBe(
      "#e0697f",
    );
    const colored = setSummaryColor(withOverlays(), "su", "#e0697f").doc;
    expect(setSummaryColor(colored, "su", "").doc.summaries?.[0]?.color).toBeUndefined();
    const d = withOverlays();
    expect(setSummaryColor(d, "ghost", "#000").doc).toBe(d); // no-op for unknown id
  });

  it("setCalloutColor sets / clears a callout's colour, no-op for an unknown node/callout", () => {
    const set = setCalloutColor(withOverlays(), "a", "co", "#d98a2b").doc;
    expect(findNode(set, "a")?.callouts?.[0]?.color).toBe("#d98a2b");
    const cleared = setCalloutColor(set, "a", "co", "").doc;
    expect(findNode(cleared, "a")?.callouts?.[0]?.color).toBeUndefined();
    const d = withOverlays();
    expect(setCalloutColor(d, "a", "ghost", "#000").doc).toBe(d); // unknown callout
    expect(setCalloutColor(d, "ghost", "co", "#000").doc).toBe(d); // unknown node
  });

  it("colour overrides round-trip through JSON unchanged (lossless)", () => {
    let d = setBoundaryColor(withOverlays(), "bd", "#3f9e6e").doc;
    d = setSummaryColor(d, "su", "#e0697f").doc;
    d = setCalloutColor(d, "a", "co", "#d98a2b").doc;
    const roundTripped = JSON.parse(JSON.stringify(d)) as MindMapDoc;
    expect(roundTripped.boundaries?.[0]?.color).toBe("#3f9e6e");
    expect(roundTripped.summaries?.[0]?.color).toBe("#e0697f");
    expect(findNode(roundTripped, "a")?.callouts?.[0]?.color).toBe("#d98a2b");
  });
});

describe("flow ops — immutability", () => {
  it("never mutates the input doc", () => {
    const doc = base();
    const snap = JSON.stringify(doc);
    addChild(doc, "a");
    deleteNode(doc, "b");
    setTopic(doc, "a", "Z");
    setNodePos(doc, "a", 1, 1);
    setFreeform(doc, true, new Map([["a", { x: 2, y: 2 }]]));
    expect(JSON.stringify(doc)).toBe(snap);
  });
});

describe("flow ops — copy/paste branch", () => {
  it("findAnyNode finds tree nodes and floating-topic nodes", () => {
    const doc = base();
    doc.floatingTopics = [
      { id: "f", topic: "F", children: [{ id: "f1", topic: "F1", children: [] }] },
    ];
    expect(findAnyNode(doc, "a1")?.topic).toBe("A1"); // in the tree
    expect(findAnyNode(doc, "f1")?.topic).toBe("F1"); // inside a floating topic
    expect(findAnyNode(doc, "nope")).toBeNull();
  });

  it("pasteBranch grafts a re-id'd copy under a tree node and expands it", () => {
    const src = findNode(base(), "a") as MapNode; // A with A1, A2
    const { doc, selectId } = pasteBranch(base(), "b", src);
    const b = findNode(doc, "b");
    expect(b?.children).toHaveLength(1);
    expect(b?.children[0].topic).toBe("A");
    expect(b?.children[0].id).not.toBe("a"); // re-id'd, no clash
    expect(b?.children[0].children.map((c) => c.topic)).toEqual(["A1", "A2"]);
    expect(selectId).toBe(b?.children[0].id);
  });

  it("pasteBranch with no/unknown parent drops the copy in as a floating topic", () => {
    const src = findNode(base(), "b") as MapNode;
    expect(pasteBranch(base(), null, src).doc.floatingTopics?.[0]?.topic).toBe("B");
    expect(pasteBranch(base(), "ghost", src).doc.floatingTopics?.[0]?.topic).toBe("B");
  });

  it("pasteBranch re-ids every node so repeated pastes never collide", () => {
    const src = findNode(base(), "a") as MapNode;
    const once = pasteBranch(base(), "b", src);
    const twice = pasteBranch(once.doc, "b", src);
    const ids = new Set<string>();
    const count = (n: MapNode): number => {
      ids.add(n.id);
      return 1 + n.children.reduce((s, c) => s + count(c), 0);
    };
    const total = count(twice.doc.root);
    expect(ids.size).toBe(total); // every id is unique (no clash across two pastes)
  });

  it("pasteBranch re-ids nested callouts so a pasted branch never shares a callout id (#3)", () => {
    const src: MapNode = {
      id: "src",
      topic: "S",
      children: [],
      callouts: [{ id: "co1", text: "n", dx: 8, dy: 0 }],
    };
    const pasted = pasteBranch(base(), "b", src)
      .doc.root.children.find((c) => c.id === "b")
      ?.children.at(-1);
    expect(pasted?.callouts?.[0]?.id).toBeDefined();
    // Fresh callout id → the on-canvas Callouts overlay can't trip a React duplicate-key warning.
    expect(pasted?.callouts?.[0]?.id).not.toBe("co1");
  });

  it("pasteBranch mutates neither the input doc nor the source node", () => {
    const doc = base();
    const src = findNode(base(), "a") as MapNode;
    const docSnap = JSON.stringify(doc);
    const srcSnap = JSON.stringify(src);
    pasteBranch(doc, "b", src);
    expect(JSON.stringify(doc)).toBe(docSnap);
    expect(JSON.stringify(src)).toBe(srcSnap);
  });
});

describe("flow ops — sticky notes", () => {
  it("addStickyNote adds an amber floating topic with a position", () => {
    const { doc, selectId } = addStickyNote(base());
    expect(doc.floatingTopics).toHaveLength(1);
    const note = doc.floatingTopics?.[0];
    expect(note?.topic).toBe("Note");
    expect(note?.style?.background).toBe("#fef3c7");
    expect(note?.pos).toBeDefined();
    expect(selectId).toBe(note?.id);
  });

  it("addStickyNote takes custom text and staggers successive notes", () => {
    const d1 = addStickyNote(base(), "Idea").doc;
    expect(d1.floatingTopics?.[0]?.topic).toBe("Idea");
    const d2 = addStickyNote(d1).doc;
    expect(d2.floatingTopics).toHaveLength(2);
    expect(d2.floatingTopics?.[1]?.pos).not.toEqual(d2.floatingTopics?.[0]?.pos);
  });
});

describe("flow ops — roll-ups", () => {
  it("setRollup binds/unbinds a node to a source map, no-op for an unknown id", () => {
    const d1 = setRollup(base(), "a", "src-map").doc;
    expect(findNode(d1, "a")?.rollup).toBe("src-map");
    expect(findNode(setRollup(d1, "a", "").doc, "a")?.rollup).toBeUndefined();
    expect(findNode(setRollup(d1, "a", undefined).doc, "a")?.rollup).toBeUndefined();
    const noNode = base();
    expect(setRollup(noNode, "ghost", "m").doc).toBe(noNode);
  });

  it("collectRollupMapIds returns distinct source ids across tree + floating", () => {
    let d = setRollup(base(), "a", "m1").doc;
    d = setRollup(d, "b", "m2").doc;
    d.floatingTopics = [{ id: "f", topic: "F", children: [], rollup: "m1" }];
    expect(collectRollupMapIds(d).sort()).toEqual(["m1", "m2"]);
    expect(collectRollupMapIds(base())).toEqual([]);
  });

  it("applyRollups replaces a roll-up node's children with re-id'd source branches", () => {
    const d = setRollup(base(), "b", "m1").doc; // b is a leaf
    const sources = new Map<string, MapNode[]>([
      [
        "m1",
        [
          { id: "s1", topic: "Pulled A", children: [] },
          { id: "s2", topic: "Pulled B", children: [] },
        ],
      ],
    ]);
    const { doc, count } = applyRollups(d, sources);
    expect(count).toBe(1);
    const b = findNode(doc, "b");
    expect(b?.children.map((c) => c.topic)).toEqual(["Pulled A", "Pulled B"]);
    expect(b?.children[0].id).not.toBe("s1"); // re-id'd
  });

  it("applyRollups is a no-op (same ref) when no source matches", () => {
    const d = setRollup(base(), "b", "m1").doc;
    const { doc, count } = applyRollups(d, new Map());
    expect(count).toBe(0);
    expect(doc).toBe(d);
  });
});

describe("flow ops — reparent edge cases", () => {
  it("inserts at an explicit index among the destination's children", () => {
    // Move b under a at index 1, between a1 and a2.
    const { doc } = reparent(base(), "b", "a", 1);
    expect(kids(doc, "a")).toEqual(["a1", "b", "a2"]);
    expect(kids(doc, "r")).toEqual(["a"]);
  });

  it("appends to the end when no index is given", () => {
    const { doc } = reparent(base(), "b", "a");
    expect(kids(doc, "a")).toEqual(["a1", "a2", "b"]);
  });

  it("expands a collapsed destination so the moved node is visible", () => {
    const start = base();
    const a = findNode(start, "a");
    if (a) (a as { collapsed?: boolean }).collapsed = true;
    expect(findNode(reparent(start, "b", "a").doc, "a")?.collapsed).toBe(false);
  });

  it("is a no-op (same doc) when reparenting a node onto itself", () => {
    const d = base();
    expect(reparent(d, "a", "a").doc).toBe(d);
  });

  it("is a no-op for an unknown destination, or moving the root", () => {
    const d = base();
    expect(reparent(d, "a", "ghost").doc).toBe(d); // unknown new parent
    expect(reparent(d, "r", "a").doc).toBe(d); // the root has no parent to detach from
  });

  it("keeps cross-link + boundary references valid when an endpoint is reparented", () => {
    // base() carries link a1→b and boundary [a1, a2]; moving a1 keeps its id, so the refs survive.
    const { doc } = reparent(base(), "a1", "b");
    expect(doc.links?.[0]).toMatchObject({ from: "a1", to: "b" });
    expect(doc.boundaries?.[0].nodeIds).toContain("a1");
    expect(kids(doc, "b")).toContain("a1");
  });
});

describe("flow ops — reparent across the floating/tree boundary", () => {
  // A non-freeform doc with two top-level floating topics (the drag UI resolves these as drop targets,
  // so reparent must handle them too — it previously silently no-op'd, snapping the drag back).
  const withFloating = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "Root",
    root: {
      id: "r",
      topic: "Root",
      children: [{ id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] }],
    },
    floatingTopics: [
      { id: "f", topic: "F", children: [{ id: "f1", topic: "F1", children: [] }] },
      { id: "g", topic: "G", children: [] },
    ],
  });

  it("attaches a floating topic (with its subtree) into the tree", () => {
    const { doc } = reparent(withFloating(), "f", "a");
    expect(kids(doc, "a")).toEqual(["a1", "f"]);
    expect(kids(doc, "f")).toEqual(["f1"]); // f is now in the tree → subtree came along
    expect(floatIds(doc)).toEqual(["g"]); // f left, g stays
  });

  it("drops floatingTopics to undefined when the last one moves into the tree", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "R",
      root: { id: "r", topic: "R", children: [{ id: "a", topic: "A", children: [] }] },
      floatingTopics: [{ id: "f", topic: "F", children: [] }],
    };
    const { doc } = reparent(d, "f", "a");
    expect(kids(doc, "a")).toEqual(["f"]);
    expect(doc.floatingTopics).toBeUndefined();
  });

  it("moves a tree node onto a floating topic (joining its detached subtree)", () => {
    const { doc } = reparent(withFloating(), "a", "g");
    expect(kids(doc, "r")).toEqual([]); // a left the tree
    expect(achildren(doc, "g")).toEqual(["a"]); // g (still floating) now holds a
    expect(achildren(doc, "a")).toEqual(["a1"]); // a's own subtree intact
  });

  it("nests one floating topic under another", () => {
    const { doc } = reparent(withFloating(), "g", "f");
    expect(floatIds(doc)).toEqual(["f"]); // g left the array
    expect(achildren(doc, "f")).toEqual(["f1", "g"]);
  });

  it("moves a node out of a floating subtree into the tree", () => {
    const { doc } = reparent(withFloating(), "f1", "a");
    expect(kids(doc, "a")).toEqual(["a1", "f1"]);
    expect(achildren(doc, "f")).toEqual([]); // f1 left f's subtree (f is still floating)
  });

  it("guards a cycle when a floating topic would move under its own descendant", () => {
    const d = withFloating();
    expect(reparent(d, "f", "f1").doc).toBe(d); // f under its own child → no-op
  });
});

describe("flow ops — deleteNode cascade", () => {
  // A richer doc: links + boundaries + summaries that all reference the branch being deleted, so
  // every prune path runs in one delete.
  const withRelations = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "Root",
    root: {
      id: "r",
      topic: "Root",
      children: [
        {
          id: "a",
          topic: "A",
          children: [{ id: "a1", topic: "A1", children: [] }],
          callouts: [{ id: "co", text: "note", dx: 10, dy: 0 }],
        },
        { id: "b", topic: "B", children: [] },
      ],
    },
    links: [
      { id: "l1", from: "a", to: "b" }, // touches the deleted branch → pruned
      { id: "l2", from: "a1", to: "b" }, // touches a descendant → pruned
    ],
    boundaries: [
      { id: "bd1", nodeIds: ["a", "a1"], label: "all-doomed" }, // empties → dropped
      { id: "bd2", nodeIds: ["a1", "b"], label: "partial" }, // keeps b
    ],
    summaries: [{ id: "su1", nodeIds: ["a", "b"], label: "s" }], // keeps b
  });

  it("prunes links touching the removed subtree (root or descendant endpoints)", () => {
    const { doc } = deleteNode(withRelations(), "a");
    // Both links referenced a or a1, so all are removed. (deleteNode filters links in place — it
    // leaves an empty array rather than dropping the key, unlike boundaries/summaries below.)
    expect(doc.links).toEqual([]);
  });

  it("trims boundary member ids and drops a boundary that empties", () => {
    const { doc } = deleteNode(withRelations(), "a");
    // bd1 (all members in the deleted branch) is gone; bd2 keeps only b.
    expect(doc.boundaries).toHaveLength(1);
    expect(doc.boundaries?.[0]).toMatchObject({ id: "bd2", nodeIds: ["b"] });
  });

  it("trims summary member ids the same way (keeps the surviving node)", () => {
    const { doc } = deleteNode(withRelations(), "a");
    expect(doc.summaries).toHaveLength(1);
    expect(doc.summaries?.[0]).toMatchObject({ id: "su1", nodeIds: ["b"] });
  });

  it("removes the node's own callouts along with the node (they live on it)", () => {
    const { doc } = deleteNode(withRelations(), "a");
    expect(findNode(doc, "a")).toBeNull();
  });

  it("selects a sensible neighbour after delete (next sibling, else previous, else parent)", () => {
    // delete a → next sibling b is selected
    expect(deleteNode(withRelations(), "a").selectId).toBe("b");
    // delete the last child → previous sibling is selected
    expect(deleteNode(withRelations(), "b").selectId).toBe("a");
    // delete an only-child → the parent is selected
    expect(deleteNode(withRelations(), "a1").selectId).toBe("a");
  });
});

describe("flow ops — content fill (hyperlink / image / rich text / meta toggles)", () => {
  it("setHyperlink sets a URL and clears it on empty", () => {
    const set = setHyperlink(base(), "a", "https://example.com").doc;
    expect(findNode(set, "a")?.hyperlink).toBe("https://example.com");
    expect(findNode(setHyperlink(set, "a", "").doc, "a")?.hyperlink).toBeUndefined();
    const d = base();
    expect(setHyperlink(d, "ghost", "x").doc).toBe(d); // unknown id → same doc, unchanged
  });

  it("setImage attaches an image to a node", () => {
    const img = { url: "data:image/png;base64,AA==", width: 100, height: 80 };
    expect(findNode(setImage(base(), "a", img).doc, "a")?.image).toEqual(img);
  });

  it("setTopicRich stores rich HTML + plain fallback, and clears rich when empty", () => {
    const set = setTopicRich(base(), "a", "<b>A</b>", "A").doc;
    expect(findNode(set, "a")?.topicRich).toBe("<b>A</b>");
    expect(findNode(set, "a")?.topic).toBe("A"); // plain fallback kept in sync
    // empty rich → topicRich dropped, plain still set
    const plainOnly = setTopicRich(base(), "a", "", "Just text").doc;
    expect(findNode(plainOnly, "a")?.topicRich).toBeUndefined();
    expect(findNode(plainOnly, "a")?.topic).toBe("Just text");
  });

  it("setTopicRich on the root keeps the doc title in sync with the plain text", () => {
    expect(setTopicRich(base(), "r", "<i>New</i>", "New").doc.title).toBe("New");
  });

  it("setLineJumps toggles the per-map flag (false clears it)", () => {
    expect(setLineJumps(base(), true).doc.meta?.lineJumps).toBe(true);
    expect(setLineJumps(setLineJumps(base(), true).doc, false).doc.meta?.lineJumps).toBeUndefined();
  });

  it("setNumberStyle stores the scheme; decimal clears the override", () => {
    expect(setNumberStyle(base(), "outline").doc.meta?.numberStyle).toBe("outline");
    expect(
      setNumberStyle(setNumberStyle(base(), "outline").doc, "decimal").doc.meta?.numberStyle,
    ).toBeUndefined();
  });

  it("setLegend toggles the per-map flag (false clears it)", () => {
    expect(setLegend(base(), true).doc.meta?.legend).toBe(true);
    expect(setLegend(setLegend(base(), true).doc, false).doc.meta?.legend).toBeUndefined();
  });

  it("setConnectorStyle stores the style; organic clears the override", () => {
    expect(setConnectorStyle(base(), "elbow").doc.meta?.connectorStyle).toBe("elbow");
    expect(
      setConnectorStyle(setConnectorStyle(base(), "elbow").doc, "organic").doc.meta?.connectorStyle,
    ).toBeUndefined();
  });

  it("setBranchGrowth stores the weight; regular clears the override", () => {
    expect(setBranchGrowth(base(), "bold").doc.meta?.branchGrowth).toBe("bold");
    expect(setBranchGrowth(base(), "fine").doc.meta?.branchGrowth).toBe("fine");
    expect(
      setBranchGrowth(setBranchGrowth(base(), "bold").doc, "regular").doc.meta?.branchGrowth,
    ).toBeUndefined();
  });

  it("setBackgroundImage sets a data URL and clears it on empty", () => {
    const url = "data:image/png;base64,BB==";
    expect(setBackgroundImage(base(), url).doc.meta?.backgroundImage).toBe(url);
    expect(
      setBackgroundImage(setBackgroundImage(base(), url).doc, "").doc.meta?.backgroundImage,
    ).toBeUndefined();
  });
});

describe("flow ops — groupBranch + replaceTopics", () => {
  it("groupBranch appends a filled boundary around a node and its whole subtree", () => {
    const before = base().boundaries?.length ?? 0; // base() already carries one boundary
    const { doc, selectId } = groupBranch(base(), "a"); // a has a1, a2
    expect(doc.boundaries).toHaveLength(before + 1);
    expect(doc.boundaries?.at(-1)?.nodeIds.sort()).toEqual(["a", "a1", "a2"]);
    expect(selectId).toBe("a");
  });

  it("groupBranch is a no-op for an unknown id", () => {
    const d = base();
    expect(groupBranch(d, "ghost").doc).toBe(d);
  });

  it("setBoundaryLabel sets / trims / clears a boundary's label by id", () => {
    // base() carries boundary "bd".
    expect(setBoundaryLabel(base(), "bd", "  Scope  ").doc.boundaries?.[0]?.label).toBe("Scope");
    expect(setBoundaryLabel(base(), "bd", "").doc.boundaries?.[0]?.label).toBeUndefined();
    const d = base();
    expect(setBoundaryLabel(d, "ghost", "x").doc).toBe(d); // no-op for unknown id
  });

  it("deleteBoundary removes by id and collapses the array when it empties", () => {
    expect(deleteBoundary(base(), "bd").doc.boundaries).toBeUndefined();
    const d = base();
    expect(deleteBoundary(d, "ghost").doc).toBe(d); // no-op for unknown id
  });

  it("replaceTopics replaces case-insensitively across the tree and counts changes", () => {
    // base topics: Root, A, A1, A2, B — replace every 'a' (case-insensitive).
    const { doc, count } = replaceTopics(base(), "a", "X");
    // "A"→"X", "A1"→"X1", "A2"→"X2"; "Root" has no 'a'; "B" none → 3 changed
    expect(count).toBe(3);
    expect(findNode(doc, "a")?.topic).toBe("X");
    expect(findNode(doc, "a1")?.topic).toBe("X1");
  });

  it("replaceTopics updates the doc title when the root topic changes", () => {
    const { doc, count } = replaceTopics(base(), "Root", "Trunk");
    expect(count).toBe(1);
    expect(doc.title).toBe("Trunk");
    expect(doc.root.topic).toBe("Trunk");
  });

  it("replaceTopics is a no-op (same doc, count 0) for an empty query or no match", () => {
    const d = base();
    expect(replaceTopics(d, "", "x")).toEqual({ doc: d, count: 0 });
    const noMatch = replaceTopics(d, "zzzz", "x");
    expect(noMatch.count).toBe(0);
    expect(noMatch.doc).toBe(d);
  });

  it("replaceTopics treats the query literally (regex metacharacters are escaped)", () => {
    const dotty = structuredClone(base());
    const a = findNode(dotty, "a");
    if (a) a.topic = "a.b";
    const { doc, count } = replaceTopics(dotty, "a.b", "Z");
    expect(count).toBe(1); // only the literal "a.b", not "a<any>b"
    expect(findNode(doc, "a")?.topic).toBe("Z");
  });

  it("replaceTopics scope: notes-only edits note bodies and leaves topics untouched", () => {
    const withNote = structuredClone(base());
    const a = findNode(withNote, "a");
    if (a) a.note = "alpha note";
    // "A" topic contains 'a', but notes-only must not touch it.
    const { doc, count } = replaceTopics(withNote, "a", "X", { notes: true, topics: false });
    expect(count).toBe(1); // only the note changed
    expect(findNode(doc, "a")?.topic).toBe("A"); // topic untouched
    expect(findNode(doc, "a")?.note).toBe("XlphX note");
  });

  it("replaceTopics scope: both edits a topic and a note as two counted changes", () => {
    const withNote = structuredClone(base());
    const a = findNode(withNote, "a");
    if (a) a.note = "Alpha";
    const { doc, count } = replaceTopics(withNote, "A", "Z", { topics: true, notes: true });
    // topic "A"→"Z" plus note "Alpha"→"ZlphZ" (both a's, case-insensitive); plus "A1","A2" → 4 fields
    expect(count).toBe(4);
    expect(findNode(doc, "a")?.topic).toBe("Z");
    expect(findNode(doc, "a")?.note).toBe("ZlphZ");
  });

  it("replaceTopics also replaces inside floating topics (parity with Find)", () => {
    const withFloat: MindMapDoc = {
      ...base(),
      floatingTopics: [{ id: "f", topic: "Apple", note: "an apple", children: [] }],
    };
    const { doc, count } = replaceTopics(withFloat, "apple", "Pear", { topics: true, notes: true });
    expect(findAnyNode(doc, "f")?.topic).toBe("Pear"); // floating topic's topic replaced
    expect(findAnyNode(doc, "f")?.note).toBe("an Pear"); // and its note
    expect(count).toBe(2);
  });

  it("replaceTopics matchCase only replaces exact-case occurrences (#A1)", () => {
    const d = structuredClone(base());
    const a = findNode(d, "a");
    if (a) a.topic = "Aa aA";
    // case-insensitive (default): every a/A in the node becomes X
    expect(findNode(replaceTopics(d, "a", "X").doc, "a")?.topic).toBe("XX XX");
    // matchCase: only the lowercase "a" occurrences are replaced
    expect(findNode(replaceTopics(d, "a", "X", { matchCase: true }).doc, "a")?.topic).toBe("AX XA");
  });

  it("replaceTopics regex treats the query as a pattern; invalid pattern → count -1 (#A1)", () => {
    const d = structuredClone(base());
    const a = findNode(d, "a");
    if (a) a.topic = "a1b2c3";
    // \d+ replaced with "-" → "a-b-c-" (regex on)
    expect(findNode(replaceTopics(d, "\\d+", "-", { regex: true }).doc, "a")?.topic).toBe("a-b-c-");
    // without regex, "\d+" is literal → no match
    expect(replaceTopics(d, "\\d+", "-").count).toBe(0);
    // a malformed pattern is reported as -1 (the UI shows "invalid regex"), doc untouched
    const bad = replaceTopics(d, "(", "x", { regex: true });
    expect(bad.count).toBe(-1);
    expect(bad.doc).toBe(d);
  });
});

describe("flow ops — cross-links (relationships)", () => {
  it("addLink creates a cross-link between two distinct nodes", () => {
    const { doc } = addLink(base(), "a", "b");
    expect(doc.links).toHaveLength(2); // original "l" + new link
    expect(doc.links?.[1]).toMatchObject({ from: "a", to: "b" });
  });

  it("addLink rejects self-links (from === to)", () => {
    const d = base();
    expect(addLink(d, "a", "a").doc).toBe(d);
  });

  it("addLink rejects links with non-existent nodes", () => {
    const d = base();
    expect(addLink(d, "ghost", "a").doc).toBe(d);
    expect(addLink(d, "a", "ghost").doc).toBe(d);
  });

  it("addLink accepts floating-topic endpoints (the canvas can connect them)", () => {
    const d = addFloatingTopic(base(), "Detached").doc;
    const fid = d.floatingTopics?.[0]?.id as string;
    // tree node → floating topic
    const r1 = addLink(d, "a", fid);
    expect(r1.doc.links?.some((l) => l.from === "a" && l.to === fid)).toBe(true);
    // floating topic → tree node
    const r2 = addLink(d, fid, "b");
    expect(r2.doc.links?.some((l) => l.from === fid && l.to === "b")).toBe(true);
  });

  it("addLink rejects duplicate links (exact from→to already exists)", () => {
    const d = base(); // has link "a1" → "b"
    expect(addLink(d, "a1", "b").doc).toBe(d);
  });

  it("addLink includes an optional label", () => {
    const { doc } = addLink(base(), "a", "b", "depends on");
    expect(doc.links?.[1]?.label).toBe("depends on");
  });

  it("addLink omits the label field when not provided", () => {
    const { doc } = addLink(base(), "a", "b");
    expect(doc.links?.[1]).not.toHaveProperty("label");
  });

  it("setLinkLabel updates an existing link's label", () => {
    const { doc } = setLinkLabel(base(), "l", "new label");
    expect(findNode(doc, "a")?.topic).toBe("A"); // verify doc structure unchanged
    expect(doc.links?.[0]?.label).toBe("new label");
  });

  it("setLinkLabel clears a label when passed an empty string", () => {
    const { doc } = setLinkLabel(base(), "l", "");
    // Clearing removes the label field entirely
    expect(doc.links?.[0]).toEqual({ id: "l", from: "a1", to: "b" });
  });

  it("setLinkLabel is a no-op for a non-existent link id", () => {
    const d = base();
    expect(setLinkLabel(d, "ghost", "label").doc).toBe(d);
  });

  it("deleteLink removes a cross-link by id", () => {
    const { doc } = deleteLink(base(), "l");
    expect(doc.links).toBeUndefined();
  });

  it("deleteLink clears the links array when it becomes empty", () => {
    const { doc } = deleteLink(base(), "l");
    expect(doc.links).toBeUndefined();
  });

  it("deleteLink is a no-op for a non-existent link id", () => {
    const d = base();
    expect(deleteLink(d, "ghost").doc).toBe(d);
  });

  it("setLinkLabel preserves a link's style fields when clearing the label", () => {
    const styled = setLinkStyle(base(), "l", { color: "#ff0000", dash: "dotted" }).doc;
    const cleared = setLinkLabel(styled, "l", "").doc;
    // label gone, but the style survives.
    expect(cleared.links?.[0]).toEqual({
      id: "l",
      from: "a1",
      to: "b",
      color: "#ff0000",
      dash: "dotted",
    });
  });

  it("setLinkArrow stores a non-default arrow and drops it back to the implicit 'to'", () => {
    const both = setLinkArrow(base(), "l", "both").doc;
    expect(both.links?.[0]?.arrow).toBe("both");
    // "to" is the historical default → stored as the field's absence.
    expect(setLinkArrow(both, "l", "to").doc.links?.[0]).not.toHaveProperty("arrow");
  });

  it("setLinkStyle merges colour/width/dash and clears each on a falsy / default value", () => {
    const styled = setLinkStyle(base(), "l", { color: "#abc", width: 3, dash: "dotted" }).doc;
    expect(styled.links?.[0]).toMatchObject({ color: "#abc", width: 3, dash: "dotted" });
    // Clear colour with "", width with 0, and dash back to the default "dashed" → all dropped.
    const reset = setLinkStyle(styled, "l", { color: "", width: 0, dash: "dashed" }).doc;
    expect(reset.links?.[0]).toEqual({ id: "l", from: "a1", to: "b", label: "x" });
  });

  it("setLinkArrow / setLinkStyle are no-ops for an unknown link id", () => {
    const d = base();
    expect(setLinkArrow(d, "ghost", "both").doc).toBe(d);
    expect(setLinkStyle(d, "ghost", { color: "#abc" }).doc).toBe(d);
  });
});

describe("flow ops — grouping (boundaries & summaries)", () => {
  it("groupBranch with deeply nested children collects the entire subtree", () => {
    const deep = (): MindMapDoc => ({
      schemaVersion: 1,
      id: "d",
      title: "Deep",
      root: {
        id: "r",
        topic: "Root",
        children: [
          {
            id: "l1",
            topic: "Level 1",
            children: [
              {
                id: "l2",
                topic: "Level 2",
                children: [
                  {
                    id: "l3",
                    topic: "Level 3",
                    children: [{ id: "l4", topic: "Level 4", children: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const { doc } = groupBranch(deep(), "l1");
    // Boundary should include l1 and all descendants (l2, l3, l4)
    expect(doc.boundaries?.[0]?.nodeIds).toEqual(["l1", "l2", "l3", "l4"]);
  });
});

describe("nodePath", () => {
  it("returns the ancestor chain (root → parent) + depth for a nested node", () => {
    const p = nodePath(base(), "a1");
    expect(p?.ancestors.map((n) => n.id)).toEqual(["r", "a"]);
    expect(p?.depth).toBe(2);
  });
  it("gives the root depth 0 with no ancestors", () => {
    expect(nodePath(base(), "r")).toEqual({ ancestors: [], depth: 0 });
  });
  it("returns null for an id not in the central tree", () => {
    expect(nodePath(base(), "nope")).toBeNull();
  });
});

describe("selectionFields", () => {
  it("flags only the task fields the selected nodes disagree on", () => {
    let d = setPriority(base(), "a", 1).doc; // a: priority 1
    d = setDue(d, "a", "2026-07-01").doc; // a: + a due date
    d = setPriority(d, "b", 1).doc; // b: priority 1 (matches a), no due
    const f = selectionFields(d, ["a", "b"]);
    expect(f.count).toBe(2);
    // priority agrees (1 vs 1) → not mixed; due differs (set vs none) → mixed.
    expect(f.mixed).toEqual({ progress: false, priority: false, start: false, due: true });
  });

  it("is all-uniform when the nodes share every value (both untasked)", () => {
    expect(selectionFields(base(), ["a1", "a2"])).toEqual({
      count: 2,
      mixed: { progress: false, priority: false, start: false, due: false },
    });
  });

  it("reaches floating topics and skips unknown ids (count = resolved only)", () => {
    let d = addFloatingTopic(base(), "Free").doc;
    const fid = d.floatingTopics?.[0]?.id as string;
    d = setPriority(d, fid, 3).doc; // floating topic: priority 3
    d = setPriority(d, "a", 1).doc; // tree node a: priority 1
    const f = selectionFields(d, ["a", fid, "ghost"]);
    expect(f.count).toBe(2); // "ghost" doesn't resolve → not counted
    expect(f.mixed.priority).toBe(true); // 1 vs 3
  });
});

describe("flow ops — node timestamps", () => {
  it("stamps a freshly-created node with createdAt === modifiedAt === clock", () => {
    const { doc, selectId } = addChild(base(), "a");
    const n = findNode(doc, selectId as string);
    expect(n?.createdAt).toBe(CLOCK);
    expect(n?.modifiedAt).toBe(CLOCK);
  });

  it("addSibling / addFloatingTopic / addStickyNote all birth with the clock", () => {
    const sib = addSibling(base(), "a1");
    expect(findNode(sib.doc, sib.selectId as string)?.createdAt).toBe(CLOCK);
    const fl = addFloatingTopic(base(), "F");
    expect(fl.doc.floatingTopics?.[0]?.modifiedAt).toBe(CLOCK);
    const sticky = addStickyNote(base());
    expect(sticky.doc.floatingTopics?.[0]?.createdAt).toBe(CLOCK);
  });

  it("setNodePos / setNodeLayout / setRollup bump modifiedAt (the shared mutateAnyNode touch)", () => {
    // Guards the extracted mutateAnyNode helper: a dropped touch() would slip past the other tests.
    expect(findNode(setNodePos(base(), "a", 5, 6).doc, "a")?.modifiedAt).toBe(CLOCK);
    expect(findNode(setNodeLayout(base(), "a", "org-down").doc, "a")?.modifiedAt).toBe(CLOCK);
    expect(findNode(setRollup(base(), "a", "mapX").doc, "a")?.modifiedAt).toBe(CLOCK);
  });

  it("a content edit bumps modifiedAt and preserves createdAt", () => {
    const created = addChild(base(), "a");
    const id = created.selectId as string;
    __setOpsClock(() => CLOCK + 5000);
    const n = findNode(setNote(created.doc, id, "hi").doc, id);
    expect(n?.createdAt).toBe(CLOCK); // unchanged
    expect(n?.modifiedAt).toBe(CLOCK + 5000); // bumped
  });

  it("backfills createdAt when a pre-timestamp node is first edited", () => {
    // base() nodes carry no timestamps until touched.
    expect(findNode(base(), "a")?.createdAt).toBeUndefined();
    const n = findNode(setNote(base(), "a", "hi").doc, "a");
    expect(n?.createdAt).toBe(CLOCK);
    expect(n?.modifiedAt).toBe(CLOCK);
  });

  it("structural ops (indent/reparent/toggleCollapse) do NOT bump modifiedAt", () => {
    const seeded = setNote(base(), "a1", "x").doc; // a1.modifiedAt = CLOCK
    __setOpsClock(() => CLOCK + 9000);
    const moved = indent(seeded, "a2").doc; // structural move of a2 under a1
    expect(findNode(moved, "a1")?.modifiedAt).toBe(CLOCK); // a1 not bumped
    expect(findNode(moved, "a2")?.modifiedAt).toBeUndefined(); // a2 never had one
  });

  it("re-id'd grafts (subtree/paste) are born now, not carrying the source's timestamp", () => {
    const src: MapNode = { id: "x", topic: "X", createdAt: 1, modifiedAt: 1, children: [] };
    const { doc, selectId } = addSubtree(base(), "b", [src]);
    const graft = findNode(doc, selectId as string);
    expect(graft?.createdAt).toBe(CLOCK);
    expect(graft?.modifiedAt).toBe(CLOCK);
  });
});

describe("flow ops — bulk markers / tags (tri-state)", () => {
  // a1 carries ⭐; a2 carries ⭐ + 🚩  → ⭐ on all, 🚩 on some.
  const tagged = () => {
    let d = toggleIcon(base(), "a1", "⭐").doc;
    d = toggleIcon(d, "a2", "⭐").doc;
    d = toggleIcon(d, "a2", "🚩").doc;
    return d;
  };

  it("selectionMarkers partitions into all vs some, skipping unresolved ids", () => {
    expect(selectionMarkers(tagged(), ["a1", "a2", "ghost"])).toEqual({
      all: ["⭐"],
      some: ["🚩"],
    });
    expect(selectionMarkers(base(), ["a1", "a2"])).toEqual({ all: [], some: [] });
  });

  it("selectionTags partitions the same way", () => {
    let d = setTags(base(), "a1", ["x", "y"]).doc;
    d = setTags(d, "a2", ["x"]).doc;
    expect(selectionTags(d, ["a1", "a2"])).toEqual({ all: ["x"], some: ["y"] });
  });

  it("bulkToggleIcon adds to all when partial, removes from all when every node has it", () => {
    // partial (⭐ on a1 only across {a1,a2}) → adds to all
    const added = bulkToggleIcon(tagged(), ["a1", "a2"], "🚩").doc;
    expect(findNode(added, "a1")?.icons).toContain("🚩");
    expect(findNode(added, "a2")?.icons).toContain("🚩");
    // all-present (⭐ on both) → removes from all (icons cleared to undefined when emptied)
    const removed = bulkToggleIcon(tagged(), ["a1", "a2"], "⭐").doc;
    expect(findNode(removed, "a1")?.icons).toBeUndefined();
    expect(findNode(removed, "a2")?.icons).not.toContain("⭐");
  });

  it("bulkToggleTag mirrors the tri-state semantics and clears emptied arrays", () => {
    let d = setTags(base(), "a1", ["risk"]).doc; // risk on a1 only
    d = bulkToggleTag(d, ["a1", "a2"], "risk").doc; // partial → add to all
    expect(findNode(d, "a1")?.tags).toEqual(["risk"]);
    expect(findNode(d, "a2")?.tags).toEqual(["risk"]);
    d = bulkToggleTag(d, ["a1", "a2"], "risk").doc; // all → remove from all
    expect(findNode(d, "a1")?.tags).toBeUndefined();
    expect(findNode(d, "a2")?.tags).toBeUndefined();
  });

  it("a single-node bulk toggle matches the single-node op; no-op + immutability hold", () => {
    const d = base();
    // single-selection equivalence: adding ⭐ to [a]
    expect(findNode(bulkToggleIcon(d, ["a"], "⭐").doc, "a")?.icons).toEqual(["⭐"]);
    // no resolvable ids → same doc
    expect(bulkToggleIcon(d, ["ghost"], "⭐").doc).toBe(d);
    // input never mutated
    const snap = JSON.stringify(d);
    bulkToggleIcon(d, ["a", "b"], "⭐");
    bulkToggleTag(d, ["a", "b"], "x");
    expect(JSON.stringify(d)).toBe(snap);
  });

  it("marker/tag toggles reach a selected floating topic (decision + mutation both reach-everywhere)", () => {
    const withFloat = addFloatingTopic(base(), "Free").doc;
    const fid = withFloat.floatingTopics?.[0]?.id as string;
    // a mixed central + floating selection: both get the marker (the floating one used to be skipped)
    const added = bulkToggleIcon(withFloat, ["a", fid], "⭐").doc;
    expect(findNode(added, "a")?.icons).toContain("⭐");
    expect(findAnyNode(added, fid)?.icons).toContain("⭐");
    // a bulk tag toggle reaches the floating topic too
    const tg = bulkToggleTag(withFloat, [fid], "risk").doc;
    expect(findAnyNode(tg, fid)?.tags).toEqual(["risk"]);
    // and the single-node primitives now reach floating topics as well
    expect(findAnyNode(toggleIcon(withFloat, fid, "🚩").doc, fid)?.icons).toContain("🚩");
  });
});

// Floating topics are first-class for structural edits: the context menu offers Add child / sibling /
// indent / outdent / move / delete / group / paste on them, so the ops must resolve them too (they used
// to resolve only the central tree via locate(root) and silently no-op).
describe("flow ops — floating topics are first-class structurally", () => {
  // f1 (with child f1a), f2 — two top-level floating topics, plus the usual central tree.
  const withFloats = (): MindMapDoc => ({
    ...base(),
    floatingTopics: [
      { id: "f1", topic: "F1", children: [{ id: "f1a", topic: "F1a", children: [] }] },
      { id: "f2", topic: "F2", children: [] },
    ],
  });

  it("addChild appends under a top-level floating topic (and expands it)", () => {
    const { doc, selectId } = addChild(withFloats(), "f2");
    expect(achildren(doc, "f2")).toEqual([selectId]);
    expect(findAnyNode(doc, "f2")?.collapsed).toBe(false);
  });

  it("addChild appends under a node nested inside a floating subtree", () => {
    const { doc, selectId } = addChild(withFloats(), "f1a");
    expect(achildren(doc, "f1a")).toEqual([selectId]);
  });

  it("addSibling on a top-level floating topic adds a new floating topic after it", () => {
    const { doc, selectId } = addSibling(withFloats(), "f1");
    expect(floatIds(doc)).toEqual(["f1", selectId, "f2"]);
    expect(findAnyNode(doc, selectId as string)?.topic).toBe("");
  });

  it("addSibling on a node inside a floating subtree inserts under the floating parent", () => {
    const { doc, selectId } = addSibling(withFloats(), "f1a");
    expect(achildren(doc, "f1")).toEqual(["f1a", selectId]);
  });

  it("indent nests a top-level floating topic under the previous floating topic", () => {
    const { doc } = indent(withFloats(), "f2");
    expect(floatIds(doc)).toEqual(["f1"]);
    expect(achildren(doc, "f1")).toEqual(["f1a", "f2"]);
  });

  it("outdent promotes a floating topic's child to its own top-level floating topic", () => {
    const { doc } = outdent(withFloats(), "f1a");
    expect(achildren(doc, "f1")).toEqual([]);
    expect(floatIds(doc)).toEqual(["f1", "f1a", "f2"]);
  });

  it("moveSibling reorders top-level floating topics", () => {
    expect(floatIds(moveSibling(withFloats(), "f1", "down").doc)).toEqual(["f2", "f1"]);
    expect(floatIds(moveSibling(withFloats(), "f1", "up").doc)).toEqual(["f1", "f2"]); // first → no-op
  });

  it("deleteNode removes a top-level floating topic and selects a neighbour", () => {
    const { doc, selectId } = deleteNode(withFloats(), "f1");
    expect(floatIds(doc)).toEqual(["f2"]);
    expect(selectId).toBe("f2");
  });

  it("deleteNode drops the floatingTopics array entirely once the last one goes", () => {
    let d: MindMapDoc = {
      ...base(),
      floatingTopics: [{ id: "solo", topic: "Solo", children: [] }],
    };
    d = deleteNode(d, "solo").doc;
    expect(d.floatingTopics).toBeUndefined();
  });

  it("deleteNode removes a node nested inside a floating subtree", () => {
    const { doc } = deleteNode(withFloats(), "f1a");
    expect(findAnyNode(doc, "f1a")).toBeNull();
    expect(achildren(doc, "f1")).toEqual([]);
  });

  it("addSubtree grafts a forest under a floating topic", () => {
    const forest: MapNode[] = [{ id: "x", topic: "X", children: [] }];
    const { doc, selectId } = addSubtree(withFloats(), "f2", forest);
    expect(achildren(doc, "f2")).toEqual([selectId]); // re-id'd, so not literally "x"
    expect(findAnyNode(doc, selectId as string)?.topic).toBe("X");
  });

  it("pasteBranch nests under a floating-topic parent (instead of a new floating sibling)", () => {
    const branch: MapNode = { id: "clip", topic: "Clip", children: [] };
    const { doc, selectId } = pasteBranch(withFloats(), "f2", branch);
    expect(achildren(doc, "f2")).toEqual([selectId]);
    expect(floatIds(doc)).toEqual(["f1", "f2"]); // no stray new floating topic
  });

  it("groupBranch / groupSummary work on a floating topic's branch", () => {
    const g = groupBranch(withFloats(), "f1").doc;
    expect(g.boundaries?.some((b) => b.nodeIds.includes("f1") && b.nodeIds.includes("f1a"))).toBe(
      true,
    );
    const s = groupSummary(withFloats(), "f1").doc;
    expect(s.summaries?.some((x) => x.nodeIds.includes("f1") && x.nodeIds.includes("f1a"))).toBe(
      true,
    );
  });
});

// The inspector shows for a selected floating topic, so its per-node property edits must reach it too
// (they previously resolved via locate(root) and silently no-opped on floating topics).
describe("flow ops — floating-topic property edits", () => {
  const withFloat = (): MindMapDoc => ({
    ...base(),
    floatingTopics: [{ id: "f", topic: "F", children: [{ id: "fa", topic: "Fa", children: [] }] }],
  });

  it("setNote / setBranchColor / setLineDash / setHyperlink reach a floating topic", () => {
    expect(findAnyNode(setNote(withFloat(), "f", "hi").doc, "f")?.note).toBe("hi");
    expect(findAnyNode(setBranchColor(withFloat(), "f", "#abc").doc, "f")?.branchColor).toBe(
      "#abc",
    );
    expect(findAnyNode(setLineDash(withFloat(), "f", "dashed").doc, "f")?.lineDash).toBe("dashed");
    expect(findAnyNode(setHyperlink(withFloat(), "f", "https://x.com").doc, "f")?.hyperlink).toBe(
      "https://x.com",
    );
    // the script-scheme guard still applies on a floating topic
    expect(
      findAnyNode(setHyperlink(withFloat(), "f", "javascript:alert(1)").doc, "f")?.hyperlink,
    ).toBeUndefined();
  });

  it("task fields (progress/due/priority) and style/image edits reach a floating topic", () => {
    expect(findAnyNode(setProgress(withFloat(), "f", 0.5).doc, "f")?.task?.progress).toBe(0.5);
    expect(findAnyNode(setDue(withFloat(), "f", "2026-07-01").doc, "f")?.task?.due).toBe(
      "2026-07-01",
    );
    expect(findAnyNode(setPriority(withFloat(), "f", 1).doc, "f")?.task?.priority).toBe(1);
    expect(
      findAnyNode(mergeStyle(withFloat(), "f", { background: "#fff" }).doc, "f")?.style,
    ).toEqual({ background: "#fff" });
    const img = { url: "data:image/png;base64,AA==", width: 10, height: 10 };
    expect(findAnyNode(setImage(withFloat(), "f", img).doc, "f")?.image).toEqual(img);
  });

  it("attachments add/remove on a floating topic", () => {
    const att = { name: "n.txt", dataUrl: "data:text/plain;base64,AA==", size: 2 };
    const added = addAttachment(withFloat(), "f", att).doc;
    expect(findAnyNode(added, "f")?.attachments?.map((a) => a.name)).toEqual(["n.txt"]);
    expect(findAnyNode(removeAttachment(added, "f", 0).doc, "f")?.attachments).toBeUndefined();
  });

  it("setTopic on a floating topic renames it WITHOUT touching the doc title", () => {
    const out = setTopic(withFloat(), "f", "Renamed").doc;
    expect(findAnyNode(out, "f")?.topic).toBe("Renamed");
    expect(out.title).toBe("Root"); // only the real root drives the title
    // renaming the actual root still updates the title (regression guard for the locate→findAnyNode swap)
    expect(setTopic(withFloat(), "r", "New title").doc.title).toBe("New title");
  });

  it("toggleCollapse works on a floating topic with children (and is a no-op on a leaf)", () => {
    expect(findAnyNode(toggleCollapse(withFloat(), "f").doc, "f")?.collapsed).toBe(true);
    expect(toggleCollapse(withFloat(), "fa").doc).toEqual(withFloat()); // leaf → no change
  });

  it("setTopicRich reaches a floating topic without altering the doc title", () => {
    const out = setTopicRich(withFloat(), "f", "<b>F</b>", "F").doc;
    expect(findAnyNode(out, "f")?.topicRich).toBe("<b>F</b>");
    expect(out.title).toBe("Root");
  });
});

describe("sortChildren", () => {
  const docWith = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "R",
    root: {
      id: "r",
      topic: "R",
      children: [
        {
          id: "c",
          topic: "Cherry",
          task: { priority: 3, due: "2026-03-01", progress: 0.9 },
          children: [],
        },
        {
          id: "a",
          topic: "apple",
          task: { priority: 1, due: "2026-01-01", progress: 0.1 },
          children: [],
        },
        { id: "b", topic: "Banana", task: { priority: 2, progress: 0.5 }, children: [] }, // no due
      ],
    },
  });

  it("sorts A→Z case-insensitively", () => {
    expect(kids(sortChildren(docWith(), "r", "alpha").doc, "r")).toEqual(["a", "b", "c"]);
  });
  it("sorts by priority (1 = highest, first)", () => {
    expect(kids(sortChildren(docWith(), "r", "priority").doc, "r")).toEqual(["a", "b", "c"]);
  });
  it("sorts by due date with the undated child last", () => {
    expect(kids(sortChildren(docWith(), "r", "due").doc, "r")).toEqual(["a", "c", "b"]);
  });
  it("sorts by progress, least-done first", () => {
    expect(kids(sortChildren(docWith(), "r", "progress").doc, "r")).toEqual(["a", "b", "c"]);
  });
  it("is a stable no-op (same doc ref) for <2 children or a missing node", () => {
    const d = base();
    expect(sortChildren(d, "b", "alpha").doc).toBe(d); // "b" has no children
    expect(sortChildren(d, "nope", "alpha").doc).toBe(d); // unknown id
  });
});

describe("maximalBranchIds", () => {
  it("drops ids nested inside another selected id", () => {
    // a1 is a child of a → selecting both yields just a.
    expect(maximalBranchIds(base(), ["a", "a1", "b"])).toEqual(["a", "b"]);
  });
  it("drops the central root and preserves order", () => {
    expect(maximalBranchIds(base(), ["r", "b", "a"])).toEqual(["b", "a"]);
  });
  it("keeps independent branches", () => {
    expect(maximalBranchIds(base(), ["a1", "a2"])).toEqual(["a1", "a2"]);
  });
});

describe("newMapFromBranch", () => {
  it("builds a standalone doc rooted at a re-id'd copy of the branch (source untouched)", () => {
    const src = base();
    const fresh = newMapFromBranch(src, "a");
    expect(fresh).not.toBeNull();
    if (!fresh) return;
    expect(fresh.title).toBe("A"); // titled from the branch topic
    expect(fresh.root.topic).toBe("A");
    expect(fresh.root.children.map((c) => c.topic)).toEqual(["A1", "A2"]);
    // Fresh ids: the new root must not reuse the source node's id.
    expect(fresh.root.id).not.toBe("a");
    expect(fresh.id).not.toBe(src.id);
    // Non-destructive: the source still has branch "a".
    expect(findNode(src, "a")?.children.length).toBe(2);
  });

  it("returns null for the central root or a missing node", () => {
    expect(newMapFromBranch(base(), "r")).toBeNull();
    expect(newMapFromBranch(base(), "nope")).toBeNull();
  });
});

describe("subtreeExportDoc (B4)", () => {
  const d = (): MindMapDoc => ({
    schemaVersion: 1,
    id: "d",
    title: "Doc",
    root: {
      id: "r",
      topic: "R",
      children: [
        { id: "a", topic: "A", children: [{ id: "a1", topic: "A1", children: [] }] },
        { id: "b", topic: "B", children: [] },
      ],
    },
    links: [
      { id: "l1", from: "a", to: "a1" }, // internal to branch a → kept
      { id: "l2", from: "a", to: "b" }, // crosses out of branch a → dropped
    ],
    boundaries: [
      { id: "bd1", nodeIds: ["a", "a1"] }, // internal → kept intact
      { id: "bd2", nodeIds: ["a", "b"] }, // partial → filtered to just the in-subtree ids
    ],
    meta: { accentColor: "#123456" },
  });

  it("roots at the subtree keeping ids + meta, dropping links that leave the subtree", () => {
    const out = subtreeExportDoc(d(), "a");
    expect(out).not.toBeNull();
    if (!out) return;
    expect(out.root.id).toBe("a"); // keeps ids so scoped SVG reuses the live canvas rects
    expect(out.title).toBe("A");
    expect(out.links?.map((l) => l.id)).toEqual(["l1"]); // l2 dropped (endpoint b is outside)
    expect(out.boundaries?.map((bd) => bd.nodeIds)).toEqual([["a", "a1"], ["a"]]);
    expect(out.meta?.accentColor).toBe("#123456"); // meta carried so styling matches the canvas
  });

  it("returns null for the central root or a missing node", () => {
    expect(subtreeExportDoc(d(), "r")).toBeNull();
    expect(subtreeExportDoc(d(), "nope")).toBeNull();
  });
});
