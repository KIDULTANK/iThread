import { compareText } from "../../i18n/registry";
import { toggleMarkerInList } from "../../icons";
import { isDangerousUrl } from "../../io/urlSafety";
import type {
  BackdropKind,
  Boundary,
  BranchGrowth,
  Callout,
  CanvasShape,
  CanvasShapeKind,
  ConditionalRule,
  CrossLink,
  FontScale,
  MapAttachment,
  MapImage,
  MapNode,
  MindMapDoc,
  NodeStyle,
  NumberStyle,
  SlideRef,
  TaskInfo,
} from "../../model/types";
import { addDaysISO } from "../../taskDate";
import type { SelectionFields } from "../contract";
import { walkTree } from "./nodeWalk";

// Pure tree-edit transforms on the canonical MindMapDoc. Each returns a NEW doc (the input
// is never mutated) plus, where relevant, the id to select next. This is the model-first
// heart of the React Flow editor: keyboard/drag/handle edits all run through these, then the
// canvas re-projects + re-lays-out from the result — so the model is always the source of
// truth (which also makes snapshot undo trivially correct). Fully unit-tested.

export interface OpResult {
  doc: MindMapDoc;
  /** The node to select/edit after the op (when the op implies one). */
  selectId?: string;
}

function makeId(): string {
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `n-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// The ONE clock the ops use to stamp node timestamps (createdAt/modifiedAt). Hidden behind a seam —
// like makeId hides crypto — so tests can freeze it (`__setOpsClock`) and stay deterministic.
let opsClock = () => Date.now();
/** Test-only: inject a fixed clock so timestamp-stamping ops are deterministic. */
export function __setOpsClock(fn: () => number): void {
  opsClock = fn;
}
/** Test-only: restore the real clock. */
export function __resetOpsClock(): void {
  opsClock = () => Date.now();
}

/** Stamp a freshly-born node: createdAt = modifiedAt = t. */
function birth(n: MapNode, t: number): void {
  n.createdAt = t;
  n.modifiedAt = t;
}
/** Mark a node content-edited at t (backfilling createdAt for pre-timestamp nodes). */
function touch(n: MapNode, t: number): void {
  if (n.createdAt === undefined) n.createdAt = t;
  n.modifiedAt = t;
}

interface Located {
  node: MapNode;
  parent: MapNode | null;
  index: number;
}

/** Find a node (and its parent + sibling index) in a tree. */
function locate(root: MapNode, id: string): Located | null {
  if (root.id === id) return { node: root, parent: null, index: -1 };
  const walk = (parent: MapNode): Located | null => {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.id === id) return { node: child, parent, index: i };
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(root);
}

function isDescendant(node: MapNode, id: string): boolean {
  return node.children.some((c) => c.id === id || isDescendant(c, id));
}

/** Find a node by id (read-only convenience). */
export function findNode(doc: MindMapDoc, id: string): MapNode | null {
  return locate(doc.root, id)?.node ?? null;
}

/** A read-only "view" of the map re-rooted at `drillId` (drill-in / focus-on-topic): the drilled node
 *  becomes the root (expanded), and the map-level overlays are dropped while drilled (they reference
 *  the wider map). Returns the doc UNCHANGED when there's no/invalid drill or it targets the real root,
 *  so callers can use it unconditionally. Pure — edits still run against the full doc, so drilling is a
 *  pure view transform (no model split, no merge-back). */
export function viewDoc(doc: MindMapDoc, drillId: string | null | undefined): MindMapDoc {
  if (!drillId || drillId === doc.root.id) return doc;
  const node = findNode(doc, drillId);
  if (!node) return doc;
  return {
    ...doc,
    root: { ...node, collapsed: false },
    links: [],
    boundaries: [],
    summaries: [],
    floatingTopics: [],
    backdrop: undefined,
  };
}

/** The ancestor chain (root → parent, excluding the node itself) and depth of a node in the central
 *  tree; depth 0 = the root. Returns null if the id isn't in the central tree (e.g. a floating
 *  topic). Pure — feeds the inspector's breadcrumb + facts line. */
export function nodePath(
  doc: MindMapDoc,
  id: string,
): { ancestors: MapNode[]; depth: number } | null {
  const path: MapNode[] = [];
  const walk = (node: MapNode): boolean => {
    if (node.id === id) return true;
    for (const child of node.children) {
      path.push(node);
      if (walk(child)) return true;
      path.pop();
    }
    return false;
  };
  if (!walk(doc.root)) return null;
  return { ancestors: path, depth: path.length };
}

/** Find a node by id anywhere in the doc — the central tree OR inside a floating topic's subtree. */
export function findAnyNode(doc: MindMapDoc, id: string): MapNode | null {
  const inTree = locate(doc.root, id)?.node;
  if (inTree) return inTree;
  for (const f of doc.floatingTopics ?? []) {
    const found = locate(f, id)?.node;
    if (found) return found;
  }
  return null;
}

/** The parent node of `id` (the node whose children include it), or null when `id` is the central
 *  root, a floating top-level node, or not found — used to duplicate a branch as a sibling. */
export function findParent(doc: MindMapDoc, id: string): MapNode | null {
  const inTree = locate(doc.root, id);
  if (inTree) return inTree.parent;
  for (const f of doc.floatingTopics ?? []) {
    const found = locate(f, id);
    if (found) return found.parent;
  }
  return null;
}

/** Logical tree direction for arrow-key selection movement. */
export type SelectDir = "up" | "down" | "left" | "right";

/** The id selection should move to from `id` in a logical tree direction (arrow-key nav): left =
 *  parent, right = first child (unless collapsed), up = previous sibling, down = next sibling. Null
 *  when there's no target (root has no parent, a leaf / collapsed node no child, the ends of a sibling
 *  row). Central-tree only. Pure. */
export function nextSelectionId(doc: MindMapDoc, id: string, dir: SelectDir): string | null {
  const loc = locate(doc.root, id);
  if (!loc) return null;
  const { node, parent, index } = loc;
  switch (dir) {
    case "left":
      return parent ? parent.id : null;
    case "right":
      return !node.collapsed && node.children.length > 0 ? node.children[0].id : null;
    case "up":
      return parent && index > 0 ? parent.children[index - 1].id : null;
    case "down":
      return parent && index < parent.children.length - 1 ? parent.children[index + 1].id : null;
    default:
      return null;
  }
}

/** Summarise the task fields across a multi-node selection: a field is "mixed" when the selected
 *  nodes hold more than one distinct value for it. Lets the inspector blank-out + label a field as
 *  "Mixed" in bulk mode instead of showing (and silently overwriting from) the anchor's value. Pure;
 *  `count` reflects only ids that resolve to a node. */
export function selectionFields(doc: MindMapDoc, ids: Iterable<string>): SelectionFields {
  const progress = new Set<number | undefined>();
  const priority = new Set<number | undefined>();
  const start = new Set<string | undefined>();
  const due = new Set<string | undefined>();
  let count = 0;
  for (const id of ids) {
    const node = findAnyNode(doc, id);
    if (!node) continue;
    count++;
    progress.add(node.task?.progress);
    priority.add(node.task?.priority);
    start.add(node.task?.start);
    due.add(node.task?.due);
  }
  return {
    count,
    mixed: {
      progress: progress.size > 1,
      priority: priority.size > 1,
      start: start.size > 1,
      due: due.size > 1,
    },
  };
}

/** Partition a string-set field (icons/tags) across a selection into the values present on EVERY
 *  resolved node (`all`) vs only SOME (`some`, excluding `all`). Drives the inspector's tri-state
 *  bulk markers/tags. Pure + deterministic (sorted); ids that don't resolve are skipped. */
function selectionSets(
  doc: MindMapDoc,
  ids: Iterable<string>,
  pick: (n: MapNode) => string[] | undefined,
): { all: string[]; some: string[] } {
  let resolved = 0;
  const count = new Map<string, number>();
  for (const id of ids) {
    const node = findAnyNode(doc, id);
    if (!node) continue;
    resolved++;
    for (const v of new Set(pick(node) ?? [])) count.set(v, (count.get(v) ?? 0) + 1);
  }
  const all: string[] = [];
  const some: string[] = [];
  for (const [k, c] of count) (resolved > 0 && c === resolved ? all : some).push(k);
  all.sort(compareText);
  some.sort(compareText);
  return { all, some };
}

/** Markers (icons) on ALL vs SOME of the selection — the inspector's tri-state bulk markers. */
export function selectionMarkers(
  doc: MindMapDoc,
  ids: Iterable<string>,
): {
  all: string[];
  some: string[];
} {
  return selectionSets(doc, ids, (n) => n.icons);
}

/** Tags on ALL vs SOME of the selection — the inspector's tri-state bulk tags. */
export function selectionTags(
  doc: MindMapDoc,
  ids: Iterable<string>,
): {
  all: string[];
  some: string[];
} {
  return selectionSets(doc, ids, (n) => n.tags);
}

/** Tri-state bulk marker toggle: if EVERY resolved selected node already carries `icon`, remove it
 *  from all; otherwise add it to every node that lacks it. Folds the single-node toggleIcon (so the
 *  cleared-to-undefined + timestamp invariants hold) into ONE new doc — a single undo step. */
export function bulkToggleIcon(doc: MindMapDoc, ids: Iterable<string>, icon: string): OpResult {
  const idList = [...ids].filter((id) => findAnyNode(doc, id));
  if (idList.length === 0) return { doc };
  const allHave = idList.every((id) => (findAnyNode(doc, id)?.icons ?? []).includes(icon));
  let next = doc;
  for (const id of idList) {
    const has = (findAnyNode(next, id)?.icons ?? []).includes(icon);
    // remove-from-all → toggle the nodes that have it; add-to-all → toggle the nodes that lack it.
    if (allHave ? has : !has) next = toggleIcon(next, id, icon).doc;
  }
  return next === doc ? { doc } : { doc: next };
}

/** Tri-state bulk tag toggle (same semantics as bulkToggleIcon), folding setTags per node. */
export function bulkToggleTag(doc: MindMapDoc, ids: Iterable<string>, tag: string): OpResult {
  const idList = [...ids].filter((id) => findAnyNode(doc, id));
  if (idList.length === 0) return { doc };
  const allHave = idList.every((id) => (findAnyNode(doc, id)?.tags ?? []).includes(tag));
  let next = doc;
  for (const id of idList) {
    const cur = findAnyNode(next, id)?.tags ?? [];
    const has = cur.includes(tag);
    if (allHave && has)
      next = setTags(
        next,
        id,
        cur.filter((t) => t !== tag),
      ).doc;
    else if (!allHave && !has) next = setTags(next, id, [...cur, tag]).doc;
  }
  return next === doc ? { doc } : { doc: next };
}

// --- structural edits ------------------------------------------------------

/** A node plus the array it lives in — the central tree's `parent.children`, or `doc.floatingTopics`
 *  for a top-level floating topic. `parent` is the MapNode parent (null for a top-level floating topic
 *  or the root); `container` is null only for the root (which lives in no array). Lets the structural
 *  ops treat floating topics — and the nodes nested inside them — as first-class. */
interface SibLoc {
  node: MapNode;
  parent: MapNode | null;
  container: MapNode[] | null;
  index: number;
}
function locateSib(doc: MindMapDoc, id: string): SibLoc | null {
  const t = locate(doc.root, id);
  if (t)
    return {
      node: t.node,
      parent: t.parent,
      container: t.parent ? t.parent.children : null,
      index: t.index,
    };
  const floats = doc.floatingTopics;
  if (floats) {
    for (let i = 0; i < floats.length; i++) {
      if (floats[i].id === id)
        return { node: floats[i], parent: null, container: floats, index: i };
      const sub = locate(floats[i], id);
      if (sub?.parent)
        return {
          node: sub.node,
          parent: sub.parent,
          container: sub.parent.children,
          index: sub.index,
        };
    }
  }
  return null;
}

/** Add an empty sibling after `id` (the root gets a child, having no sibling). Floating-aware: the
 *  sibling of a top-level floating topic is a new floating topic. */
export function addSibling(doc: MindMapDoc, id: string): OpResult {
  const next = structuredClone(doc);
  const loc = locateSib(next, id);
  if (!loc) return { doc };
  if (!loc.container) return addChild(doc, id); // the root has no siblings
  const sib: MapNode = { id: makeId(), topic: "", children: [] };
  birth(sib, opsClock());
  loc.container.splice(loc.index + 1, 0, sib);
  return { doc: next, selectId: sib.id };
}

/** Add an empty sibling immediately before `id`. Mirrors iThoughts' Shift+Return shortcut. */
export function addSiblingBefore(doc: MindMapDoc, id: string): OpResult {
  const next = structuredClone(doc);
  const loc = locateSib(next, id);
  if (!loc) return { doc };
  if (!loc.container) return addChild(doc, id); // the root has no siblings
  const sib: MapNode = { id: makeId(), topic: "", children: [] };
  birth(sib, opsClock());
  loc.container.splice(loc.index, 0, sib);
  return { doc: next, selectId: sib.id };
}

/** Append an empty child to `id` and expand it (works on a floating topic too). */
export function addChild(doc: MindMapDoc, id: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  const child: MapNode = { id: makeId(), topic: "", children: [] };
  birth(child, opsClock());
  node.children.push(child);
  node.collapsed = false;
  return { doc: next, selectId: child.id };
}

/** Move `id` up to be a sibling of its parent. For a direct child of a top-level floating topic this
 *  promotes it to its own top-level floating topic. No-op for the root, a top-level floating topic, or
 *  a direct child of the root (nowhere higher to go). */
export function outdent(doc: MindMapDoc, id: string): OpResult {
  const next = structuredClone(doc);
  const loc = locateSib(next, id);
  if (!loc || !loc.parent || !loc.container) return { doc };
  const grand = locateSib(next, loc.parent.id);
  if (!grand || !grand.container) return { doc };
  loc.container.splice(loc.index, 1);
  grand.container.splice(grand.index + 1, 0, loc.node);
  return { doc: next, selectId: loc.node.id };
}

/** Move `id` under its previous sibling (no-op if it's the first child). Floating-aware: a top-level
 *  floating topic indents under the previous floating topic. */
export function indent(doc: MindMapDoc, id: string): OpResult {
  const next = structuredClone(doc);
  const loc = locateSib(next, id);
  if (!loc || !loc.container || loc.index === 0) return { doc };
  const prev = loc.container[loc.index - 1];
  loc.container.splice(loc.index, 1);
  prev.children.push(loc.node);
  prev.collapsed = false;
  return { doc: next, selectId: loc.node.id };
}

/** Swap `id` with its previous/next sibling (reorder among siblings). No-op at an end. Floating-aware. */
export function moveSibling(doc: MindMapDoc, id: string, dir: "up" | "down"): OpResult {
  const next = structuredClone(doc);
  const loc = locateSib(next, id);
  if (!loc || !loc.container) return { doc };
  const sibs = loc.container;
  const j = dir === "up" ? loc.index - 1 : loc.index + 1;
  if (j < 0 || j >= sibs.length) return { doc };
  [sibs[loc.index], sibs[j]] = [sibs[j], sibs[loc.index]];
  return { doc: next, selectId: loc.node.id };
}

export type SortKey = "alpha" | "priority" | "due" | "progress";

/** Reorder a node's direct children by a key (stable on ties): A→Z by topic, priority (1 = highest,
 *  first), due date (earliest first), or progress (least-done first). Unset task fields sort last. */
export function sortChildren(doc: MindMapDoc, id: string, by: SortKey): OpResult {
  const probe = findAnyNode(doc, id);
  if (!probe || probe.children.length < 2) return { doc };
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  const rank = (c: MapNode): number | string => {
    if (by === "alpha") return c.topic.toLocaleLowerCase();
    if (by === "priority") return c.task?.priority ?? Number.POSITIVE_INFINITY;
    if (by === "due") return c.task?.due ?? "￿"; // undated → after every ISO date
    return c.task?.progress ?? Number.POSITIVE_INFINITY; // no task → last
  };
  node.children = node.children
    .map((c, i) => [c, i] as const)
    .sort((a, b) => {
      const ra = rank(a[0]);
      const rb = rank(b[0]);
      if (ra < rb) return -1;
      if (ra > rb) return 1;
      return a[1] - b[1]; // stable: preserve original order within equal ranks
    })
    .map(([c]) => c);
  return { doc: next, selectId: id };
}

/** Filter a selection to its "maximal" branch roots: drop the central root, and drop any id nested
 *  inside another selected id (so selecting a branch + one of its descendants copies just the branch).
 *  Order-preserving. Used by the multi-branch clipboard. */
export function maximalBranchIds(doc: MindMapDoc, ids: string[]): string[] {
  // Drop the central root first so it can't swallow every other selection (it contains them all).
  const candidates = ids.filter((id) => id !== doc.root.id);
  return candidates.filter(
    (id) =>
      !candidates.some((other) => {
        if (other === id) return false;
        const on = findAnyNode(doc, other);
        return on ? isDescendant(on, id) : false;
      }),
  );
}

/** Remove a node's subtree; prune dangling links/boundaries; select a neighbour. Works on a central-tree
 *  node, a top-level floating topic, or a node nested inside one. No-op for the root. */
export function deleteNode(doc: MindMapDoc, id: string): OpResult {
  const probe = locateSib(doc, id);
  if (!probe || !probe.container) return { doc }; // can't delete the root
  const next = structuredClone(doc);
  const loc = locateSib(next, id);
  if (!loc || !loc.container) return { doc };
  const container = loc.container;
  container.splice(loc.index, 1);
  const selectId = container[loc.index]?.id ?? container[loc.index - 1]?.id ?? loc.parent?.id;
  // Drop an emptied floatingTopics array so a cleared map stays lossless.
  if (loc.parent === null && next.floatingTopics && next.floatingTopics.length === 0)
    next.floatingTopics = undefined;

  const removed = new Set<string>();
  const collect = (n: MapNode) => {
    removed.add(n.id);
    for (const c of n.children) collect(c);
  };
  collect(loc.node);
  if (next.links) next.links = next.links.filter((l) => !removed.has(l.from) && !removed.has(l.to));
  if (next.boundaries) {
    const kept = next.boundaries
      .map((b) => ({ ...b, nodeIds: b.nodeIds.filter((nid) => !removed.has(nid)) }))
      .filter((b) => b.nodeIds.length > 0);
    next.boundaries = kept.length > 0 ? kept : undefined;
  }
  if (next.summaries) {
    const kept = next.summaries
      .map((s) => ({ ...s, nodeIds: s.nodeIds.filter((nid) => !removed.has(nid)) }))
      .filter((s) => s.nodeIds.length > 0);
    next.summaries = kept.length > 0 ? kept : undefined;
  }
  return { doc: next, selectId };
}

/** Delete every node in `ids` (and their subtrees) as ONE edit. A node that's a descendant of another
 *  selected node is absorbed — only the maximal selected subtrees are removed — so deleting a parent
 *  together with one of its children counts (and re-selects) once. The root is never deleted. Returns
 *  the new doc, a surviving node to select, and how many top-level topics were removed. */
export function deleteNodes(doc: MindMapDoc, ids: string[]): OpResult & { removed: number } {
  // Drop the central root up front: it can't be deleted, so it must not absorb its (every) descendant
  // out of the set — selecting root + a child should still delete the child.
  const present = ids
    .map((id) => ({ id, node: findAnyNode(doc, id) }))
    .filter((x): x is { id: string; node: MapNode } => x.node !== null && x.id !== doc.root.id);
  // Keep only ids whose subtree isn't already covered by another selected id.
  const maximal = present.filter(
    (x) => !present.some((y) => y.id !== x.id && isDescendant(y.node, x.id)),
  );
  let next = doc;
  let removed = 0;
  let selectId: string | undefined;
  for (const { id } of maximal) {
    const r = deleteNode(next, id);
    if (r.doc !== next) {
      next = r.doc;
      removed += 1;
      selectId = r.selectId;
    }
  }
  // A neighbour we picked may itself have been removed by a later id — fall back to the root.
  if (selectId && !findAnyNode(next, selectId)) selectId = next.root.id;
  return { doc: next, selectId, removed };
}

/** Locate a node ANYWHERE it can be reparented from — the central tree, a top-level floating topic,
 *  or a node nested inside a floating topic's subtree — and return a `remove()` that detaches it from
 *  whichever container holds it. Null for the root (no parent to detach from) or an unknown id. */
function locateRemovable(
  doc: MindMapDoc,
  id: string,
): { node: MapNode; remove: () => void } | null {
  const inTree = locate(doc.root, id);
  if (inTree?.parent) {
    const { parent, index } = inTree;
    return { node: inTree.node, remove: () => parent.children.splice(index, 1) };
  }
  if (inTree) return null; // the root itself — not reparentable
  const floats = doc.floatingTopics ?? [];
  const fi = floats.findIndex((f) => f.id === id);
  if (fi >= 0) return { node: floats[fi], remove: () => floats.splice(fi, 1) };
  for (const f of floats) {
    const sub = locate(f, id);
    if (sub?.parent) {
      const { parent, index } = sub;
      return { node: sub.node, remove: () => parent.children.splice(index, 1) };
    }
  }
  return null;
}

/** Move a subtree under a new parent (guards against cycles). Works across the tree/floating boundary:
 *  a floating topic can be dragged INTO the tree (or under another floating topic), and a tree node onto
 *  a floating topic — the drag UI already resolves floating nodes as drop targets, so this op must too. */
export function reparent(
  doc: MindMapDoc,
  id: string,
  newParentId: string,
  index?: number,
): OpResult {
  if (id === newParentId) return { doc };
  const next = structuredClone(doc);
  const src = locateRemovable(next, id);
  const destParent = findAnyNode(next, newParentId);
  if (!src || !destParent) return { doc };
  if (isDescendant(src.node, newParentId)) return { doc }; // would create a cycle
  src.remove();
  const at = index ?? destParent.children.length;
  destParent.children.splice(at, 0, src.node);
  destParent.collapsed = false;
  // A floating topic moved into the tree empties the array; drop it so the doc stays clean (lossless).
  if (next.floatingTopics && next.floatingTopics.length === 0) next.floatingTopics = undefined;
  return { doc: next, selectId: id };
}

/** Reorder / restructure within the central tree from an outline drag: place `dragId` relative to
 *  `targetId` — `before` it, `after` it, or as its last `child`. Guards self-drops + cycles; a no-op
 *  (same doc) when an id is missing, the root is dragged, or the target is the dragged node's own
 *  descendant. The outline only shows the central hierarchy, so both ids live in `doc.root`. */
export function moveInTree(
  doc: MindMapDoc,
  dragId: string,
  targetId: string,
  where: "before" | "after" | "child",
): OpResult {
  if (dragId === targetId) return { doc };
  const next = structuredClone(doc);
  const src = locateRemovable(next, dragId);
  if (!src) return { doc }; // missing, or the root itself (not reparentable)
  if (isDescendant(src.node, targetId)) return { doc }; // would create a cycle
  if (where === "child") {
    const dest = findAnyNode(next, targetId);
    if (!dest) return { doc };
    src.remove();
    dest.children.push(src.node);
    dest.collapsed = false;
  } else {
    src.remove();
    // Re-locate the target AFTER removal so the sibling index is correct (it may have shifted).
    const loc = locate(next.root, targetId);
    if (!loc) return { doc };
    if (!loc.parent) {
      next.root.children.push(src.node); // target is the root — can't be a sibling; nest under it
    } else {
      loc.parent.children.splice(loc.index + (where === "after" ? 1 : 0), 0, src.node);
    }
  }
  touch(src.node, opsClock());
  if (next.floatingTopics && next.floatingTopics.length === 0) next.floatingTopics = undefined;
  return { doc: next, selectId: dragId };
}

/** Group drag in tree mode: move every selected branch to `targetId` (as a child, or before/after the
 *  target) in ONE undo step. Rules that keep it safe:
 *   • the root is never moved;
 *   • a selected node nested under another selected node moves WITH its ancestor (excluded here), so we
 *     don't double-move it;
 *   • moveInTree's own cycle guard rejects moving a node into its own subtree (e.g. dropping onto a
 *     selected member), so those simply no-op.
 *  `dragId` (the grabbed node) is moved first so its drop intent leads and stays selected. Pure. */
export function moveSelectionInTree(
  doc: MindMapDoc,
  ids: string[],
  dragId: string,
  targetId: string,
  where: "before" | "after" | "child",
): OpResult {
  const tops = ids.filter(
    (id) =>
      id !== doc.root.id &&
      // Excluded only if nested under another selected node that ITSELF moves — the root never moves,
      // so being under a selected root doesn't pull a node out of the move set.
      !ids.some((other) => {
        if (other === id || other === doc.root.id) return false;
        const on = findAnyNode(doc, other);
        return on ? isDescendant(on, id) : false;
      }),
  );
  // Grabbed node first; the rest keep their given order.
  tops.sort((a, b) => (a === dragId ? -1 : b === dragId ? 1 : 0));
  let next = doc;
  for (const id of tops) next = moveInTree(next, id, targetId, where).doc;
  return next === doc ? { doc } : { doc: next, selectId: dragId };
}

/** Fold a per-node op across `ids` into ONE OpResult (one undo step) — the value-setting bulk edits
 *  (priority / branch colour) over a multi-selection, and keyboard indent/outdent over the selection.
 *  Returns the input doc unchanged when nothing changed. Pure. */
export function applyAcrossIds(
  doc: MindMapDoc,
  ids: Iterable<string>,
  op: (d: MindMapDoc, id: string) => OpResult,
): OpResult {
  let next = doc;
  for (const id of ids) next = op(next, id).doc;
  return next === doc ? { doc } : { doc: next };
}

// --- content edits ---------------------------------------------------------

/** Set a node's topic text (renaming the root also updates the doc title). */
export function setTopic(doc: MindMapDoc, id: string, topic: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.topic = topic;
  if (id === next.root.id) next.title = topic || next.title; // only the real root drives the doc title
  touch(node, opsClock());
  return { doc: next };
}

/**
 * Set a node's rich-text topic. `rich` is already-sanitised inline HTML (or undefined when the
 * text carries no formatting); `plain` is its plain-text form, stored on `topic` as the fallback.
 * Pure — the caller (a browser context) does the DOM sanitising, so this stays node-testable.
 */
export function setTopicRich(
  doc: MindMapDoc,
  id: string,
  rich: string | undefined,
  plain: string,
): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.topic = plain;
  node.topicRich = rich || undefined;
  if (id === next.root.id) next.title = plain || next.title; // only the real root drives the doc title
  touch(node, opsClock());
  return { doc: next };
}

/** Toggle a node's collapsed state (no-op for a leaf). */
export function toggleCollapse(doc: MindMapDoc, id: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node || node.children.length === 0) return { doc };
  node.collapsed = !node.collapsed;
  return { doc: next };
}

/** Toggle a node's locked (pinned-in-place) flag. Any node can be locked; clears the flag rather than
 *  storing `false`. */
export function toggleLocked(doc: MindMapDoc, id: string): OpResult {
  return mutateAnyNode(doc, id, (n) => {
    n.locked = n.locked ? undefined : true;
  });
}

/** Collapse (false) or expand (true) every branch below the root. */
export function setAllExpanded(doc: MindMapDoc, expanded: boolean): OpResult {
  const next = structuredClone(doc);
  walkTree(next.root, (node, depth) => {
    if (depth > 0 && node.children.length > 0) node.collapsed = !expanded;
  });
  return { doc: next };
}

/** Isolate the branch containing `id`: collapse every *other* top-level branch and expand the path
 *  down to `id` so it's revealed — a fast "focus on this line" that stays editable in place (unlike
 *  drill-in, which re-roots the view). No-op when `id` is the root or isn't in the central tree. */
export function isolateBranch(doc: MindMapDoc, id: string): OpResult {
  const path = nodePath(doc, id);
  if (!path || path.depth === 0) return { doc }; // root or not found
  // The depth-1 branch this node lives under (or the node itself when it IS a top branch).
  const topId = path.ancestors[1]?.id ?? id;
  // Every ancestor below the root + the node itself must be expanded so `id` is visible.
  const reveal = new Set([...path.ancestors.slice(1).map((a) => a.id), id]);
  const next = structuredClone(doc);
  for (const child of next.root.children) {
    child.collapsed = child.id === topId ? undefined : true;
  }
  walkTree(next.root, (node) => {
    if (reveal.has(node.id)) node.collapsed = undefined;
  });
  return { doc: next, selectId: id };
}

/** Expand the central tree to `level` and collapse below it: a topic with children is collapsed iff
 *  its depth ≥ level (root = depth 0). Level 1 shows only the top branches (collapsed); higher levels
 *  reveal more tiers — MindManager's "detail level" control. `level` is clamped to ≥ 1. */
export function setExpandedToLevel(doc: MindMapDoc, level: number): OpResult {
  const lvl = Math.max(1, Math.trunc(level));
  const next = structuredClone(doc);
  walkTree(next.root, (node, depth) => {
    if (depth > 0 && node.children.length > 0) node.collapsed = depth >= lvl;
  });
  return { doc: next };
}

/** Expand only the branch rooted at `id` to a relative detail level. The selected topic is relative
 *  depth 0, so level 1 reveals its direct children and collapses those children's own descendants;
 *  level 2 reveals one tier further, and so on. Level 0 expands the complete selected branch. Topics
 *  outside the branch are deliberately untouched — this is the iThoughts digit-key behaviour. */
export function setBranchExpandedToLevel(doc: MindMapDoc, id: string, level: number): OpResult {
  const source = findAnyNode(doc, id);
  if (!source || source.children.length === 0) return { doc };
  const next = structuredClone(doc);
  const root = findAnyNode(next, id);
  if (!root) return { doc };
  const showAll = Math.trunc(level) === 0;
  const lvl = Math.max(1, Math.trunc(level));
  walkTree(root, (node, depth) => {
    if (node.children.length > 0) node.collapsed = showAll ? false : depth >= lvl;
  });
  return { doc: next, selectId: id };
}

/** Set the note on a node (empty or whitespace-only clears it). */
export function setNote(doc: MindMapDoc, id: string, note: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  // A blank or whitespace-only note is "no note" — clear it so the 📝 indicator disappears
  // (matches the Outline panel, which has always judged notes by their trimmed content).
  node.note = note.trim() ? note : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Deep-clone a subtree with fresh ids (so grafted/pasted nodes never collide with existing ones).
 *  Re-id'd nodes are newly born, so each gets created = modified = now. */
function reId(node: MapNode): MapNode {
  const cloned: MapNode = {
    ...node,
    id: makeId(),
    children: node.children.map(reId),
    // Callouts carry their own ids and are rendered keyed by id; without fresh ids a pasted branch
    // would share callout ids with the original, tripping React's duplicate-key warning (and letting
    // the two callouts' selection/edits collide).
    ...(node.callouts ? { callouts: node.callouts.map((c) => ({ ...c, id: makeId() })) } : {}),
  };
  birth(cloned, opsClock());
  return cloned;
}

/** Graft a forest of nodes (e.g. parsed from pasted text) as children of a node; expands it.
 *  The nodes are re-id'd, so the same parsed forest can be pasted repeatedly without id clashes. */
export function addSubtree(doc: MindMapDoc, parentId: string, nodes: MapNode[]): OpResult {
  if (nodes.length === 0) return { doc };
  const next = structuredClone(doc);
  const parent = findAnyNode(next, parentId);
  if (!parent) return { doc };
  const grafted = nodes.map(reId);
  parent.children.push(...grafted);
  parent.collapsed = false;
  return { doc: next, selectId: grafted[0]?.id };
}

/** Build a brand-new standalone map document from a node's branch ("New map from topic") — the subtree
 *  re-id'd as the new map's root, so the two maps never share ids. Returns null for the central root or
 *  a missing node. Non-destructive: the source map is untouched (the branch is COPIED). The caller
 *  assigns the library id + persists. Branch-internal relationships/boundaries aren't carried (they
 *  reference the source map's ids). */
export function newMapFromBranch(doc: MindMapDoc, id: string): MindMapDoc | null {
  if (id === doc.root.id) return null;
  const node = findAnyNode(doc, id);
  if (!node) return null;
  return {
    schemaVersion: doc.schemaVersion,
    id: makeId(),
    title: node.topic || "Untitled map",
    root: reId(node),
  };
}

/** Build a scoped MindMapDoc rooted at a node's subtree for "Export this branch" (B4). Unlike
 *  newMapFromBranch this KEEPS the original node ids (so a renderer-backed export can reuse the live
 *  canvas node rects) and carries the branch-internal relationships / boundaries / summaries + the map
 *  meta (theme / accent / connectors / font) so the exported branch looks like it did on the canvas.
 *  Cross-links / boundaries / summaries with any endpoint outside the subtree are dropped. Returns null
 *  for the central root or a missing node. Pure. */
export function subtreeExportDoc(doc: MindMapDoc, id: string): MindMapDoc | null {
  if (id === doc.root.id) return null;
  const node = findAnyNode(doc, id);
  if (!node) return null;
  const ids = new Set<string>();
  const collect = (n: MapNode) => {
    ids.add(n.id);
    for (const c of n.children) collect(c);
  };
  collect(node);
  const has = (nid: string) => ids.has(nid);
  return {
    schemaVersion: doc.schemaVersion,
    id: doc.id,
    title: node.topic || doc.title || "Branch",
    root: structuredClone(node),
    links: (doc.links ?? []).filter((l) => has(l.from) && has(l.to)),
    boundaries: (doc.boundaries ?? [])
      .map((b) => ({ ...b, nodeIds: b.nodeIds.filter(has) }))
      .filter((b) => b.nodeIds.length > 0),
    summaries: (doc.summaries ?? []).filter((s) => s.nodeIds.every(has)),
    rules: doc.rules,
    meta: doc.meta,
  };
}

/** Paste a copied branch: graft it (re-id'd) under `parentId` when that's a tree node, otherwise
 *  drop it in as a floating topic. Always inserts — the cross-map branch paste. Re-ids so the same
 *  clipboard branch can be pasted repeatedly (and across maps) without id clashes. */
export function pasteBranch(doc: MindMapDoc, parentId: string | null, node: MapNode): OpResult {
  const next = structuredClone(doc);
  const fresh = reId(node);
  if (parentId) {
    const parent = findAnyNode(next, parentId);
    if (parent) {
      parent.children.push(fresh);
      parent.collapsed = false;
      return { doc: next, selectId: fresh.id };
    }
  }
  next.floatingTopics = [...(next.floatingTopics ?? []), fresh];
  return { doc: next, selectId: fresh.id };
}

/** Add a detached floating topic (e.g. a link dropped onto the canvas), optionally with a link. */
export function addFloatingTopic(doc: MindMapDoc, topic: string, hyperlink?: string): OpResult {
  const next = structuredClone(doc);
  const node: MapNode = {
    id: makeId(),
    topic,
    children: [],
    ...(hyperlink ? { hyperlink } : {}),
  };
  birth(node, opsClock());
  next.floatingTopics = [...(next.floatingTopics ?? []), node];
  return { doc: next, selectId: node.id };
}

/** The sticky-note colour set (name → {fill, border, ink}) — a small palette so notes are visually
 *  sortable, like MindManager's 9 sticky colours. `amber` is the historical default (unchanged look).
 *  A sticky note is just a floating topic carrying one of these as its per-topic style, so it renders +
 *  exports through the normal style path. Insertion order defines the palette order in the UI. */
export const STICKY_NOTE_COLORS = {
  amber: { background: "#fef3c7", border: "1px solid #fcd34d", color: "#713f12" },
  lime: { background: "#ecfccb", border: "1px solid #bef264", color: "#3f6212" },
  sky: { background: "#e0f2fe", border: "1px solid #7dd3fc", color: "#075985" },
  rose: { background: "#ffe4e6", border: "1px solid #fda4af", color: "#9f1239" },
  violet: { background: "#ede9fe", border: "1px solid #c4b5fd", color: "#5b21b6" },
  slate: { background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#334155" },
} as const;
export type StickyNoteColor = keyof typeof STICKY_NOTE_COLORS;

const stickyStyle = (color: StickyNoteColor): NodeStyle => ({
  ...STICKY_NOTE_COLORS[color],
  borderRadius: "2px",
});

/** Add a sticky note: a free-floating topic styled as a coloured note card (default amber). New
 *  notes stagger so they don't stack exactly (the offset matters only in free-canvas mode; auto-
 *  layouts ignore it). */
export function addStickyNote(
  doc: MindMapDoc,
  text = "Note",
  color: StickyNoteColor = "amber",
): OpResult {
  const next = structuredClone(doc);
  const n = (next.floatingTopics ?? []).length;
  const node: MapNode = {
    id: makeId(),
    topic: text,
    children: [],
    style: stickyStyle(color),
    pos: { x: 40 + n * 24, y: 40 + n * 24 },
  };
  birth(node, opsClock());
  next.floatingTopics = [...(next.floatingTopics ?? []), node];
  return { doc: next, selectId: node.id };
}

/** Detach a branch into a free-floating topic: pop the node + its whole subtree out of the central
 *  hierarchy and add it to `floatingTopics` (it keeps a `pos` so it lands somewhere in free-canvas
 *  mode). No-op for the root or a node that's already a top-level floating topic. Re-attach is just
 *  `reparent` (drag it back in, or the "re-attach" menu item). */
export function detachBranch(doc: MindMapDoc, id: string): OpResult {
  if (id === doc.root.id) return { doc };
  if ((doc.floatingTopics ?? []).some((f) => f.id === id)) return { doc }; // already floating
  const next = structuredClone(doc);
  const src = locateRemovable(next, id);
  if (!src) return { doc };
  src.remove();
  // Give it a position if it has none, staggered by the existing count, so it doesn't stack on others.
  if (!src.node.pos) {
    const n = (next.floatingTopics ?? []).length;
    src.node.pos = { x: 60 + n * 24, y: 60 + n * 24 };
  }
  next.floatingTopics = [...(next.floatingTopics ?? []), src.node];
  return { doc: next, selectId: id };
}

/** Replace a node's tags (an empty array clears them). */
export function setTags(doc: MindMapDoc, id: string, tags: string[]): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id); // reach floating topics too (single + bulk tag toggles)
  if (!node) return { doc };
  node.tags = tags.length > 0 ? tags : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Replace a node's markers/icons (an empty array clears them) — the board's drag-to-set-marker drop. */
export function setIcons(doc: MindMapDoc, id: string, icons: string[]): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.icons = icons.length > 0 ? icons : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Rename a tag everywhere it appears (central tree + floating topics). Renaming to a name a node
 *  ALREADY carries merges the two (deduped) — that's how the tag manager merges tags. A blank target
 *  or a rename-to-self is a no-op; the same doc is returned when nothing carried the tag. */
export function renameTag(doc: MindMapDoc, from: string, to: string): OpResult {
  const next = to.trim();
  if (!next || next === from) return { doc };
  const copy = structuredClone(doc);
  let changed = false;
  const walk = (n: MapNode) => {
    if (n.tags?.includes(from)) {
      const set = n.tags.filter((t) => t !== from);
      if (!set.includes(next)) set.push(next);
      n.tags = set.length > 0 ? set : undefined;
      touch(n, opsClock());
      changed = true;
    }
    for (const c of n.children) walk(c);
  };
  walk(copy.root);
  for (const f of copy.floatingTopics ?? []) walk(f);
  return { doc: changed ? copy : doc };
}

/** Remove a tag from every node in the map (central tree + floating topics). Same doc if unused. */
export function deleteTag(doc: MindMapDoc, tag: string): OpResult {
  const copy = structuredClone(doc);
  let changed = false;
  const walk = (n: MapNode) => {
    if (n.tags?.includes(tag)) {
      const set = n.tags.filter((t) => t !== tag);
      n.tags = set.length > 0 ? set : undefined;
      touch(n, opsClock());
      changed = true;
    }
    for (const c of n.children) walk(c);
  };
  walk(copy.root);
  for (const f of copy.floatingTopics ?? []) walk(f);
  return { doc: changed ? copy : doc };
}

/** Merge a patch into a node's TaskInfo; a key set to undefined/"" is dropped, and the whole `task`
 *  object falls away once it carries nothing — so clearing the last field stops it being a task. */
function patchTask(doc: MindMapDoc, id: string, patch: Partial<TaskInfo>): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  const merged: TaskInfo = {};
  for (const [k, v] of Object.entries({ ...(node.task ?? {}), ...patch }))
    if (v !== undefined && v !== "") (merged as Record<string, unknown>)[k] = v;
  node.task = Object.keys(merged).length > 0 ? merged : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Set a node's task completion (0..1), or clear its task status with `undefined`. */
export function setProgress(doc: MindMapDoc, id: string, progress: number | undefined): OpResult {
  return patchTask(doc, id, {
    progress: progress === undefined ? undefined : Math.max(0, Math.min(1, progress)),
  });
}

/** Set a node's due date ("YYYY-MM-DD"), or clear it with "" / undefined. */
export function setDue(doc: MindMapDoc, id: string, due: string | undefined): OpResult {
  return patchTask(doc, id, { due: due || undefined });
}

/** Set a node's start date ("YYYY-MM-DD"), or clear it with "" / undefined. */
export function setStart(doc: MindMapDoc, id: string, start: string | undefined): OpResult {
  return patchTask(doc, id, { start: start || undefined });
}

/** Set a node's task priority (1 = High .. 3 = Low), or clear it with undefined. */
export function setPriority(doc: MindMapDoc, id: string, priority: number | undefined): OpResult {
  return patchTask(doc, id, { priority });
}

/** Shift every task start/due date in a scope by `days` (±), preserving relative offsets — the
 *  "Move project" reschedule (MindManager). `scopeId` limits it to that node's subtree (root's own id
 *  = the whole map). Only dated tasks change; nodes without start/due are untouched. One undo step;
 *  a no-op (nothing dated, or `days === 0`) returns the original doc so it doesn't churn history. */
export function shiftDates(doc: MindMapDoc, days: number, scopeId?: string): OpResult {
  if (days === 0) return { doc };
  const scope = scopeId ? findAnyNode(doc, scopeId) : doc.root;
  if (!scope) return { doc };
  const next = structuredClone(doc);
  const scopeNode = scopeId ? findAnyNode(next, scopeId) : next.root;
  if (!scopeNode) return { doc };
  let changed = 0;
  const shift = (n: MapNode) => {
    if (n.task && (n.task.start || n.task.due)) {
      if (n.task.start) n.task.start = addDaysISO(n.task.start, days);
      if (n.task.due) n.task.due = addDaysISO(n.task.due, days);
      touch(n, opsClock());
      changed += 1;
    }
  };
  // The scope's whole subtree; if the scope is the central root, also sweep floating topics (they're
  // part of "the project" too — the whole-map case).
  walkTree(scopeNode, shift);
  if (!scopeId || scopeId === next.root.id)
    for (const f of next.floatingTopics ?? []) walkTree(f, shift);
  return changed > 0 ? { doc: next } : { doc };
}

/** Replace the map's conditional-formatting rules (an empty array clears them). */
export function setRules(doc: MindMapDoc, rules: ConditionalRule[]): OpResult {
  const next = structuredClone(doc);
  next.rules = rules.length > 0 ? rules : undefined;
  return { doc: next };
}

/** Replace the custom presentation deck (`meta.slides`); an empty array clears it back to the auto
 *  walk-through. */
export function setSlides(doc: MindMapDoc, slides: SlideRef[]): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, slides: slides.length > 0 ? slides : undefined };
  return { doc: next };
}

/** Set the per-map canvas background colour ("" clears it back to the theme default). */
export function setBackground(doc: MindMapDoc, color: string): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, background: color || undefined };
  return { doc: next };
}

/** Set the map-wide accent colour (default stroke for relationships + boundaries); "" clears it. */
export function setAccentColor(doc: MindMapDoc, color: string): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, accentColor: color || undefined };
  return { doc: next };
}

/** Set the per-map canvas background image (a data: URL); "" clears it. The image draws behind
 *  everything, on top of any background colour. */
export function setBackgroundImage(doc: MindMapDoc, url: string): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, backgroundImage: url || undefined };
  return { doc: next };
}

/** Toggle line-jumps: draw a hop where two relationship lines cross (false clears the flag). */
export function setLineJumps(doc: MindMapDoc, on: boolean): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, lineJumps: on || undefined };
  return { doc: next };
}

/** Toggle the map legend (markers / tags / rules overlay + export); false clears the flag. */
export function setLegend(doc: MindMapDoc, on: boolean): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, legend: on || undefined };
  return { doc: next };
}

/** Toggle the on-canvas relationship type pills (meta.showLinkTypes); false clears the flag. */
export function setShowLinkTypes(doc: MindMapDoc, on: boolean): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, showLinkTypes: on || undefined };
  return { doc: next };
}

/** Set the map's outline-numbering scheme; "decimal" (the default) clears the override. */
export function setNumberStyle(doc: MindMapDoc, style: NumberStyle): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, numberStyle: style === "decimal" ? undefined : style };
  return { doc: next };
}

/** Set the map's branch connector style; "organic" (the default) clears the override. */
export function setConnectorStyle(
  doc: MindMapDoc,
  style: "organic" | "curved" | "elbow" | "straight",
): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, connectorStyle: style === "organic" ? undefined : style };
  return { doc: next };
}

/** Set the map-wide branch growth weight ("regular" clears it back to the historical default widths). */
export function setBranchGrowth(doc: MindMapDoc, growth: BranchGrowth): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, branchGrowth: growth === "regular" ? undefined : growth };
  return { doc: next };
}

/** Set the map-wide base font family ("" / undefined clears it back to the canvas default). */
export function setFontFamily(doc: MindMapDoc, family: string | undefined): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, fontFamily: family?.trim() || undefined };
  return { doc: next };
}

/** Set the map-wide font-size scale; "comfortable" (the default) clears the override. */
export function setFontScale(doc: MindMapDoc, scale: FontScale): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, fontScale: scale === "comfortable" ? undefined : scale };
  return { doc: next };
}

/** Set a node's per-branch connector colour ("" clears it back to the auto-palette). Inherited by the
 *  node's subtree at render time. */
export function setBranchColor(doc: MindMapDoc, id: string, color: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.branchColor = color || undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Auto-colour the map: give each top-level branch a distinct connector colour, cycling `colors`
 *  (their subtrees inherit it at render time). A one-click "restyle branches" — clears to a clean
 *  per-branch palette. No-op when `colors` is empty. */
export function assignBranchColors(doc: MindMapDoc, colors: string[]): OpResult {
  if (colors.length === 0) return { doc };
  const next = structuredClone(doc);
  next.root.children.forEach((child, i) => {
    child.branchColor = colors[i % colors.length];
  });
  return { doc: next };
}

/** Set the line style of a node's incoming branch connector; "solid" (the default) clears it. */
export function setLineDash(
  doc: MindMapDoc,
  id: string,
  dash: "solid" | "dashed" | "dotted",
): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.lineDash = dash === "solid" ? undefined : dash;
  touch(node, opsClock());
  return { doc: next };
}

/** Set a node's hyperlink ("" clears it). */
export function setHyperlink(doc: MindMapDoc, id: string, url: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  // Drop a script-bearing scheme at the store boundary (mirrors the import + canvas-sync guards) so a
  // javascript:/data:/vbscript: URL never persists on the node or in the lossless .json export.
  node.hyperlink = url && !isDangerousUrl(url) ? url : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Append an additional hyperlink to a node's `hyperlinks` (the extras beyond the primary). No-op for
 *  a blank/dangerous URL or an exact duplicate (of the primary or an existing extra). */
export function addHyperlink(doc: MindMapDoc, id: string, url: string): OpResult {
  const trimmed = url.trim();
  if (!trimmed || isDangerousUrl(trimmed)) return { doc };
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  const existing = node.hyperlinks ?? [];
  if (trimmed === node.hyperlink || existing.includes(trimmed)) return { doc };
  node.hyperlinks = [...existing, trimmed];
  touch(node, opsClock());
  return { doc: next };
}

/** Remove the additional hyperlink at `index` from a node's `hyperlinks` (drops the array when empty).
 *  No-op if the node/index isn't found. */
export function removeHyperlink(doc: MindMapDoc, id: string, index: number): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node?.hyperlinks || index < 0 || index >= node.hyperlinks.length) return { doc };
  const rest = node.hyperlinks.filter((_, i) => i !== index);
  node.hyperlinks = rest.length > 0 ? rest : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Append a file attachment to a node. */
export function addAttachment(doc: MindMapDoc, id: string, attachment: MapAttachment): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.attachments = [...(node.attachments ?? []), attachment];
  touch(node, opsClock());
  return { doc: next };
}

/** Remove the attachment at `index` from a node (clearing the array when it empties). */
export function removeAttachment(doc: MindMapDoc, id: string, index: number): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node?.attachments) return { doc };
  const kept = node.attachments.filter((_, i) => i !== index);
  node.attachments = kept.length > 0 ? kept : undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Set a node's image. */
export function setImage(doc: MindMapDoc, id: string, image: MapImage): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  node.image = image;
  touch(node, opsClock());
  return { doc: next };
}

/** Toggle a marker icon on a node. */
export function toggleIcon(doc: MindMapDoc, id: string, icon: string): OpResult {
  const next = structuredClone(doc);
  // findAnyNode (not locate(next.root)) so a floating topic's marker is toggled too — otherwise a
  // single or bulk toggle on a floating topic silently no-ops (the bulk op decides via findAnyNode).
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  // Group semantics live in toggleMarkerInList: adding a grouped marker drops any sibling in its
  // single-select group (Priority / Status / …), so a topic keeps at most one per group.
  const icons = toggleMarkerInList(node.icons ?? [], icon);
  node.icons = icons.length > 0 ? icons : undefined;
  touch(node, opsClock());
  return { doc: next };
}

// --- callouts (anchored annotation bubbles) --------------------------------

// Callouts attach to ANY node — central-tree or floating topic — and both render (FlowMindMap builds
// the overlay by walking floatingTopics too) and prune via findAnyNode. So these writes resolve the
// host with findAnyNode, not locate(root), or a floating topic's callout edits would silently no-op.

/** Add a callout to a node (offset staggered by existing count so they don't stack). */
export function addCallout(doc: MindMapDoc, nodeId: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, nodeId);
  if (!node) return { doc };
  const callouts = node.callouts ?? [];
  const callout: Callout = { id: makeId(), text: "Note", dx: 48, dy: -28 + callouts.length * 46 };
  node.callouts = [...callouts, callout];
  touch(node, opsClock());
  return { doc: next, selectId: nodeId };
}

/** Set a callout's text. */
export function setCalloutText(
  doc: MindMapDoc,
  nodeId: string,
  calloutId: string,
  text: string,
): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, nodeId);
  const callout = node?.callouts?.find((c) => c.id === calloutId);
  if (!node || !callout) return { doc };
  callout.text = text;
  touch(node, opsClock());
  return { doc: next };
}

/** Set (or clear, with "") a callout's colour override. */
export function setCalloutColor(
  doc: MindMapDoc,
  nodeId: string,
  calloutId: string,
  color: string,
): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, nodeId);
  const callout = node?.callouts?.find((c) => c.id === calloutId);
  if (!node || !callout) return { doc };
  callout.color = color || undefined;
  touch(node, opsClock());
  return { doc: next };
}

/** Remove a callout (clearing the array when it empties). */
export function deleteCallout(doc: MindMapDoc, nodeId: string, calloutId: string): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, nodeId);
  if (!node?.callouts) return { doc };
  const kept = node.callouts.filter((c) => c.id !== calloutId);
  node.callouts = kept.length > 0 ? kept : undefined;
  touch(node, opsClock());
  return { doc: next };
}

// --- cross-links (relationship arrows) -------------------------------------

/** Add a labelled cross-link between two distinct, existing nodes (no exact duplicate). Either end
 *  may be a floating topic — the canvas lets you drag a relationship to/from one, and the crosslink
 *  edge renders for any endpoint, so endpoint validation must look beyond the central tree. */
export function addLink(doc: MindMapDoc, from: string, to: string, label?: string): OpResult {
  if (from === to || !findAnyNode(doc, from) || !findAnyNode(doc, to)) return { doc };
  if ((doc.links ?? []).some((l) => l.from === from && l.to === to)) return { doc };
  const next = structuredClone(doc);
  const link: CrossLink = { id: makeId(), from, to, ...(label ? { label } : {}) };
  next.links = [...(next.links ?? []), link];
  return { doc: next };
}

/** Set (or clear, with "") a cross-link's label — preserving its style fields. */
export function setLinkLabel(doc: MindMapDoc, id: string, label: string): OpResult {
  if (!(doc.links ?? []).some((l) => l.id === id)) return { doc };
  const next = structuredClone(doc);
  next.links = (next.links ?? []).map((l) => {
    if (l.id !== id) return l;
    const { label: _drop, ...rest } = l;
    return label ? { ...rest, label } : rest;
  });
  return { doc: next };
}

/** Set a cross-link's arrowhead placement. "to" is the implicit default (single-headed at the
 *  target, today's look), so it's stored as the absence of the field to keep the .json lean. */
export function setLinkArrow(doc: MindMapDoc, id: string, arrow: CrossLink["arrow"]): OpResult {
  if (!(doc.links ?? []).some((l) => l.id === id)) return { doc };
  const next = structuredClone(doc);
  next.links = (next.links ?? []).map((l) => {
    if (l.id !== id) return l;
    const { arrow: _drop, ...rest } = l;
    return arrow && arrow !== "to" ? { ...rest, arrow } : rest;
  });
  return { doc: next };
}

/** Merge a style patch (colour / width / dash / curve / arrow) into a cross-link. A field cleared to a
 *  falsy value — or an implicit default (`dash:"dashed"`, `arrow:"to"`) — is dropped, so a reset link
 *  serialises field-free. `arrow` is accepted here too so one-click presets set the whole look in a
 *  single op (one undo step). */
export function setLinkStyle(
  doc: MindMapDoc,
  id: string,
  patch: {
    color?: string;
    width?: number;
    dash?: CrossLink["dash"];
    curve?: number;
    arrow?: CrossLink["arrow"];
    type?: CrossLink["type"];
  },
): OpResult {
  if (!(doc.links ?? []).some((l) => l.id === id)) return { doc };
  const next = structuredClone(doc);
  next.links = (next.links ?? []).map((l) => {
    if (l.id !== id) return l;
    const merged = {
      ...l,
      ...("color" in patch ? { color: patch.color || undefined } : {}),
      ...("width" in patch ? { width: patch.width || undefined } : {}),
      ...("dash" in patch
        ? { dash: patch.dash && patch.dash !== "dashed" ? patch.dash : undefined }
        : {}),
      // Curve bow (perpendicular offset, px). `curve: 0` is an explicit STRAIGHT line; `undefined`
      // resets to the gentle auto-bow (so a default link serialises field-free).
      ...("curve" in patch
        ? { curve: patch.curve == null ? undefined : Math.round(patch.curve) }
        : {}),
      // Arrow: "to" (or falsy) is the implicit default → dropped, like setLinkArrow.
      ...("arrow" in patch
        ? { arrow: patch.arrow && patch.arrow !== "to" ? patch.arrow : undefined }
        : {}),
      // Type: "relates-to" (or falsy) is the implicit default → dropped, so a plain link serialises
      // field-free.
      ...("type" in patch
        ? { type: patch.type && patch.type !== "relates-to" ? patch.type : undefined }
        : {}),
    };
    // Strip keys now undefined so a cleared field doesn't survive in the lossless .json.
    return Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined),
    ) as unknown as CrossLink;
  });
  return { doc: next };
}

/** Remove a cross-link by id (clearing the array when it empties). */
export function deleteLink(doc: MindMapDoc, id: string): OpResult {
  if (!(doc.links ?? []).some((l) => l.id === id)) return { doc };
  const next = structuredClone(doc);
  const kept = (next.links ?? []).filter((l) => l.id !== id);
  next.links = kept.length > 0 ? kept : undefined;
  return { doc: next };
}

/** Add a filled boundary enclosing exactly `nodeIds` (deduped, keeping only ids in the central tree).
 *  The shared core behind groupBranch (a subtree) and groupNodes (an arbitrary selection). A no-op
 *  (same doc) when no id resolves; `selectId` follows the first enclosed node. */
function addBoundaryForNodes(doc: MindMapDoc, nodeIds: string[]): OpResult {
  const ids = [...new Set(nodeIds)].filter((id) => findAnyNode(doc, id));
  if (ids.length === 0) return { doc };
  const next = structuredClone(doc);
  next.boundaries = [...(next.boundaries ?? []), { id: makeId(), nodeIds: ids }];
  return { doc: next, selectId: ids[0] };
}

/** Add a filled boundary around a node and its whole subtree. */
export function groupBranch(doc: MindMapDoc, id: string): OpResult {
  const node = findAnyNode(doc, id);
  if (!node) return { doc };
  const ids: string[] = [];
  const collect = (n: MapNode) => {
    ids.push(n.id);
    for (const c of n.children) collect(c);
  };
  collect(node);
  return { ...addBoundaryForNodes(doc, ids), selectId: id };
}

/** Add a filled boundary around an arbitrary selection of topics (the multi-select "group" gesture). */
export function groupNodes(doc: MindMapDoc, ids: Iterable<string>): OpResult {
  return addBoundaryForNodes(doc, [...ids]);
}

/** Add a labelled summary bracket around a node and its whole subtree. */
export function groupSummary(doc: MindMapDoc, id: string): OpResult {
  const node = findAnyNode(doc, id);
  if (!node) return { doc };
  const ids: string[] = [];
  const collect = (n: MapNode) => {
    ids.push(n.id);
    for (const c of n.children) collect(c);
  };
  collect(node);
  const next = structuredClone(doc);
  next.summaries = [...(next.summaries ?? []), { id: makeId(), nodeIds: ids, label: "Summary" }];
  return { doc: next, selectId: id };
}

/** Set (or clear, with "") a summary's label by id. */
export function setSummaryLabel(doc: MindMapDoc, id: string, label: string): OpResult {
  if (!(doc.summaries ?? []).some((s) => s.id === id)) return { doc };
  const next = structuredClone(doc);
  next.summaries = (next.summaries ?? []).map((s) =>
    s.id === id ? { ...s, label: label.trim() || undefined } : s,
  );
  return { doc: next };
}

/** Remove a summary by id (clearing the array when it empties). */
export function deleteSummary(doc: MindMapDoc, id: string): OpResult {
  if (!(doc.summaries ?? []).some((s) => s.id === id)) return { doc };
  const next = structuredClone(doc);
  const kept = (next.summaries ?? []).filter((s) => s.id !== id);
  next.summaries = kept.length > 0 ? kept : undefined;
  return { doc: next };
}

/** Set (or clear, with "") a boundary's label by id. */
export function setBoundaryLabel(doc: MindMapDoc, id: string, label: string): OpResult {
  if (!(doc.boundaries ?? []).some((b) => b.id === id)) return { doc };
  const next = structuredClone(doc);
  next.boundaries = (next.boundaries ?? []).map((b) =>
    b.id === id ? { ...b, label: label.trim() || undefined } : b,
  );
  return { doc: next };
}

/** Remove a boundary by id (clearing the array when it empties). */
export function deleteBoundary(doc: MindMapDoc, id: string): OpResult {
  if (!(doc.boundaries ?? []).some((b) => b.id === id)) return { doc };
  const next = structuredClone(doc);
  const kept = (next.boundaries ?? []).filter((b) => b.id !== id);
  next.boundaries = kept.length > 0 ? kept : undefined;
  return { doc: next };
}

/** Set (or clear, with "") a boundary's colour override by id. */
export function setBoundaryColor(doc: MindMapDoc, id: string, color: string): OpResult {
  if (!(doc.boundaries ?? []).some((b) => b.id === id)) return { doc };
  const next = structuredClone(doc);
  next.boundaries = (next.boundaries ?? []).map((b) =>
    b.id === id ? { ...b, color: color || undefined } : b,
  );
  return { doc: next };
}

/** Set a boundary's outline shape; "roundRect" (the default) clears the override. */
export function setBoundaryShape(
  doc: MindMapDoc,
  id: string,
  shape: NonNullable<Boundary["shape"]>,
): OpResult {
  if (!(doc.boundaries ?? []).some((b) => b.id === id)) return { doc };
  const next = structuredClone(doc);
  next.boundaries = (next.boundaries ?? []).map((b) => {
    if (b.id !== id) return b;
    const { shape: _drop, ...rest } = b;
    return shape === "roundRect" ? rest : { ...rest, shape };
  });
  return { doc: next };
}

/** Set a boundary's outline line style; "solid" (the default) clears the override. */
export function setBoundaryDash(
  doc: MindMapDoc,
  id: string,
  dash: NonNullable<Boundary["dash"]>,
): OpResult {
  if (!(doc.boundaries ?? []).some((b) => b.id === id)) return { doc };
  const next = structuredClone(doc);
  next.boundaries = (next.boundaries ?? []).map((b) => {
    if (b.id !== id) return b;
    const { dash: _drop, ...rest } = b;
    return dash === "solid" ? rest : { ...rest, dash };
  });
  return { doc: next };
}

/** Set (or clear, with "") a summary's colour override by id. */
export function setSummaryColor(doc: MindMapDoc, id: string, color: string): OpResult {
  if (!(doc.summaries ?? []).some((s) => s.id === id)) return { doc };
  const next = structuredClone(doc);
  next.summaries = (next.summaries ?? []).map((s) =>
    s.id === id ? { ...s, color: color || undefined } : s,
  );
  return { doc: next };
}

/** Replace `query` (case-insensitive) in every topic; returns the doc + count changed. */
export function replaceTopics(
  doc: MindMapDoc,
  query: string,
  replacement: string,
  scope: { topics?: boolean; notes?: boolean; regex?: boolean; matchCase?: boolean } = {},
): { doc: MindMapDoc; count: number } {
  if (!query) return { doc, count: 0 };
  // Default to topics (back-compat); callers opt into notes.
  const inTopics = scope.topics ?? true;
  const inNotes = scope.notes ?? false;
  // `regex` treats the query as a pattern (else it's a literal — special chars escaped); `matchCase`
  // drops the case-insensitive flag. A malformed pattern → count -1 so the UI can say "invalid regex"
  // instead of silently doing nothing.
  const pattern = scope.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = `g${scope.matchCase ? "" : "i"}`;
  try {
    new RegExp(pattern, flags);
  } catch {
    return { doc, count: -1 };
  }
  const re = () => new RegExp(pattern, flags);
  const next = structuredClone(doc);
  let count = 0;
  const walk = (n: MapNode) => {
    if (inTopics) {
      const replaced = n.topic.replace(re(), replacement);
      if (replaced !== n.topic) {
        n.topic = replaced;
        count += 1;
      }
    }
    if (inNotes && n.note) {
      const replaced = n.note.replace(re(), replacement);
      if (replaced !== n.note) {
        n.note = replaced;
        count += 1;
      }
    }
    for (const c of n.children) walk(c);
  };
  walk(next.root);
  for (const f of next.floatingTopics ?? []) walk(f); // Find searches floating topics, so Replace must too
  if (count > 0) next.title = next.root.topic || next.title;
  return { doc: count > 0 ? next : doc, count };
}

/** Merge a style patch into a node ("" / null clears a key; an empty style is dropped). */
export function mergeStyle(doc: MindMapDoc, id: string, patch: Partial<NodeStyle>): OpResult {
  const next = structuredClone(doc);
  const node = findAnyNode(next, id);
  if (!node) return { doc };
  const merged: Record<string, string | boolean> = { ...(node.style ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === "" || v == null || v === false) delete merged[k];
    else merged[k] = v;
  }
  node.style = Object.keys(merged).length > 0 ? (merged as NodeStyle) : undefined;
  touch(node, opsClock());
  return { doc: next };
}

// --- free-canvas (whiteboard) mode -----------------------------------------

/** Clone the doc, find a node by id ANYWHERE (central tree OR a floating-topic subtree), apply `fn`
 *  to it and bump its modified timestamp, then return the new doc — or the SAME doc reference untouched
 *  when the id isn't found. The shared scaffold behind setNodePos / setNodeLayout / setRollup. */
function mutateAnyNode(doc: MindMapDoc, id: string, fn: (node: MapNode) => void): OpResult {
  const next = structuredClone(doc);
  const walk = (n: MapNode): boolean => {
    if (n.id === id) {
      fn(n);
      touch(n, opsClock());
      return true;
    }
    return n.children.some(walk);
  };
  let hit = walk(next.root);
  if (!hit) {
    for (const f of next.floatingTopics ?? []) {
      if (walk(f)) {
        hit = true;
        break;
      }
    }
  }
  return { doc: hit ? next : doc };
}

/** Set a node's explicit free-canvas position (top-left, flow coords). Searches the tree and
 *  floating topics, so any node can be placed; a no-op (same doc) if the id isn't found. */
export function setNodePos(doc: MindMapDoc, id: string, x: number, y: number): OpResult {
  return mutateAnyNode(doc, id, (n) => {
    n.pos = { x, y };
  });
}

/** Set several free-canvas node positions in one shot (one undo step) — the group-drag path: every
 *  selected node moves together. Locked or missing nodes are skipped; an empty list is a no-op. Pure. */
export function setNodePositions(
  doc: MindMapDoc,
  positions: { id: string; x: number; y: number }[],
): OpResult {
  if (positions.length === 0) return { doc };
  const byId = new Map(positions.map((p) => [p.id, p]));
  const next = structuredClone(doc);
  const now = opsClock();
  const visit = (n: MapNode) => {
    const p = byId.get(n.id);
    if (p && !n.locked) {
      n.pos = { x: p.x, y: p.y };
      touch(n, now);
    }
    for (const c of n.children) visit(c);
  };
  visit(next.root);
  for (const f of next.floatingTopics ?? []) visit(f);
  return { doc: next };
}

/** Edge/centre to align free-canvas nodes to. */
export type AlignMode = "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom";
/** Measured on-canvas size of a node (from the renderer), keyed by id — needed for centre/right
 *  alignment + distribution. */
export type NodeSizes = Record<string, { w: number; h: number }>;

interface ArrangeBox {
  node: MapNode;
  x: number;
  y: number;
  w: number;
  h: number;
}
function arrangeBoxes(doc: MindMapDoc, ids: Iterable<string>, sizes: NodeSizes): ArrangeBox[] {
  const out: ArrangeBox[] = [];
  for (const id of ids) {
    const node = findAnyNode(doc, id);
    if (!node?.pos || node.locked) continue; // only free-canvas, un-pinned nodes can be arranged
    const s = sizes[id] ?? { w: 0, h: 0 };
    out.push({ node, x: node.pos.x, y: node.pos.y, w: s.w, h: s.h });
  }
  return out;
}

/** Align free-canvas nodes to a shared edge/centre of the selection's bounding box (freeform only).
 *  No-op for fewer than 2 positioned nodes. Pure. */
export function alignNodes(
  doc: MindMapDoc,
  ids: Iterable<string>,
  mode: AlignMode,
  sizes: NodeSizes,
): OpResult {
  const next = structuredClone(doc);
  const boxes = arrangeBoxes(next, ids, sizes);
  if (boxes.length < 2) return { doc };
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxR = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxB = Math.max(...boxes.map((b) => b.y + b.h));
  const cx = (minX + maxR) / 2;
  const cy = (minY + maxB) / 2;
  for (const b of boxes) {
    const p = b.node.pos as { x: number; y: number };
    if (mode === "left") p.x = minX;
    else if (mode === "right") p.x = maxR - b.w;
    else if (mode === "hcenter") p.x = cx - b.w / 2;
    else if (mode === "top") p.y = minY;
    else if (mode === "bottom") p.y = maxB - b.h;
    else if (mode === "vmiddle") p.y = cy - b.h / 2;
  }
  return { doc: next };
}

/** Evenly space free-canvas nodes between the two extremes (by centre) along an axis (freeform only).
 *  No-op for fewer than 3 positioned nodes. Pure. */
export function distributeNodes(
  doc: MindMapDoc,
  ids: Iterable<string>,
  axis: "h" | "v",
  sizes: NodeSizes,
): OpResult {
  const next = structuredClone(doc);
  const boxes = arrangeBoxes(next, ids, sizes);
  if (boxes.length < 3) return { doc };
  const centre = (b: ArrangeBox) => (axis === "h" ? b.x + b.w / 2 : b.y + b.h / 2);
  boxes.sort((a, b) => centre(a) - centre(b));
  const first = centre(boxes[0]);
  const step = (centre(boxes[boxes.length - 1]) - first) / (boxes.length - 1);
  boxes.forEach((b, i) => {
    const c = first + i * step;
    const p = b.node.pos as { x: number; y: number };
    if (axis === "h") p.x = c - b.w / 2;
    else p.y = c - b.h / 2;
  });
  return { doc: next };
}

// --- dedicated diagram backdrops (onion / funnel / Venn) -------------------

/** Set (or replace) the map's diagram backdrop. */
export function setBackdrop(doc: MindMapDoc, kind: BackdropKind, rings?: number): OpResult {
  const next = structuredClone(doc);
  next.backdrop = rings !== undefined ? { kind, rings } : { kind };
  return { doc: next };
}

/** Add/remove a ring or stage on an onion/funnel backdrop (clamped to 2..6); no-op for venn. */
export function setBackdropRings(doc: MindMapDoc, delta: number): OpResult {
  const b = doc.backdrop;
  if (!b || b.kind === "venn2" || b.kind === "venn3") return { doc };
  const next = structuredClone(doc);
  if (next.backdrop) next.backdrop.rings = Math.max(2, Math.min(6, (b.rings ?? 3) + delta));
  return { doc: next };
}

/** Remove the diagram backdrop. */
export function clearBackdrop(doc: MindMapDoc): OpResult {
  if (!doc.backdrop) return { doc };
  const next = structuredClone(doc);
  next.backdrop = undefined;
  return { doc: next };
}

/** Set (or clear, with "") the diagram backdrop's colour override; no-op if there's no backdrop. */
export function setBackdropColor(doc: MindMapDoc, color: string): OpResult {
  if (!doc.backdrop) return { doc };
  const next = structuredClone(doc);
  if (next.backdrop) next.backdrop.color = color || undefined;
  return { doc: next };
}

// --- free background shapes + smart containers (items 23 + 22) --------------

/** Default size (flow units) per shape kind — containers are larger to hold topics. */
const SHAPE_DEFAULTS: Record<CanvasShapeKind, { w: number; h: number }> = {
  rect: { w: 260, h: 170 },
  ellipse: { w: 240, h: 170 },
  blockArrow: { w: 240, h: 120 },
  chevron: { w: 220, h: 120 },
  swimlane: { w: 540, h: 360 },
  matrix: { w: 420, h: 320 },
};

/** Add a free shape / container, centred on `pos` (default: the origin). Selects the new shape. */
export function addShape(
  doc: MindMapDoc,
  kind: CanvasShapeKind,
  pos?: { x: number; y: number },
): OpResult {
  const next = structuredClone(doc);
  const size = SHAPE_DEFAULTS[kind];
  const centre = pos ?? { x: 0, y: 0 };
  const shape: CanvasShape = {
    id: makeId(),
    kind,
    pos: { x: centre.x - size.w / 2, y: centre.y - size.h / 2 },
    size: { ...size },
    ...(kind === "swimlane" ? { lanes: 3 } : {}),
    ...(kind === "matrix" ? { lanes: 2, rows: 2 } : {}),
  };
  next.shapes = [...(next.shapes ?? []), shape];
  return { doc: next, selectId: shape.id };
}

/** Mutate one shape by id (a no-op returning the same doc if the id isn't found). */
function mutateShape(doc: MindMapDoc, id: string, fn: (s: CanvasShape) => void): OpResult {
  const idx = (doc.shapes ?? []).findIndex((s) => s.id === id);
  if (idx < 0) return { doc };
  const next = structuredClone(doc);
  const s = next.shapes?.[idx];
  if (s) fn(s);
  return { doc: next };
}

/** Move a shape's top-left corner (freeform drag). */
export function setShapePos(doc: MindMapDoc, id: string, x: number, y: number): OpResult {
  return mutateShape(doc, id, (s) => {
    s.pos = { x, y };
  });
}

/** Resize a shape (clamped to a small minimum so it stays grabbable). */
export function setShapeSize(doc: MindMapDoc, id: string, w: number, h: number): OpResult {
  return mutateShape(doc, id, (s) => {
    s.size = { w: Math.max(40, w), h: Math.max(30, h) };
  });
}

/** Set a shape's whole box (pos + size) in one step — the corner-resize commit, where dragging a top/
 *  left grip moves the origin too. Size is min-clamped. */
export function setShapeRect(
  doc: MindMapDoc,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): OpResult {
  return mutateShape(doc, id, (s) => {
    s.pos = { x, y };
    s.size = { w: Math.max(40, w), h: Math.max(30, h) };
  });
}

/** Set (or clear, with "") a shape's colour override. */
export function setShapeColor(doc: MindMapDoc, id: string, color: string): OpResult {
  return mutateShape(doc, id, (s) => {
    s.color = color || undefined;
  });
}

/** Change a shape's kind (rect ↔ ellipse ↔ arrow ↔ chevron ↔ container). */
export function setShapeKind(doc: MindMapDoc, id: string, kind: CanvasShapeKind): OpResult {
  return mutateShape(doc, id, (s) => {
    s.kind = kind;
  });
}

/** Set (or clear, with "") a shape's centred label. */
export function setShapeLabel(doc: MindMapDoc, id: string, label: string): OpResult {
  return mutateShape(doc, id, (s) => {
    s.label = label || undefined;
  });
}

/** Remove a shape by id. */
export function deleteShape(doc: MindMapDoc, id: string): OpResult {
  if (!(doc.shapes ?? []).some((s) => s.id === id)) return { doc };
  const next = structuredClone(doc);
  next.shapes = (next.shapes ?? []).filter((s) => s.id !== id);
  return { doc: next };
}

/** Per-branch layout: set (or clear, with undefined / "") a node's subtree layout override.
 *  Searches the tree and floating topics; a no-op (same doc) if the id isn't found. */
export function setNodeLayout(doc: MindMapDoc, id: string, kind: string | undefined): OpResult {
  return mutateAnyNode(doc, id, (n) => {
    n.layout = kind || undefined;
  });
}

/** Pin a main branch to the left/right half of the two-sided ("side") map — or `undefined` to let it
 *  auto-balance again. Only the root's direct children honour `side` (project's assignSides); on any
 *  other node it's stored but inert. */
export function setNodeSide(
  doc: MindMapDoc,
  id: string,
  side: "left" | "right" | undefined,
): OpResult {
  return mutateAnyNode(doc, id, (n) => {
    n.side = side;
  });
}

/** Balance the two-sided map: clear every main branch's pinned `side` so the auto-balancer (assignSides)
 *  redistributes them evenly by subtree weight. A no-op (same doc) when nothing is pinned. */
export function balanceMap(doc: MindMapDoc): OpResult {
  const next = structuredClone(doc);
  let changed = false;
  for (const child of next.root.children) {
    if (child.side !== undefined) {
      child.side = undefined;
      changed = true;
    }
  }
  return { doc: changed ? next : doc };
}

// --- automated multi-map roll-ups -----------------------------------------

/** Bind (or unbind, with undefined / "") a node to a roll-up source map id. The node's children then
 *  mirror that map, refreshed by `refreshRollups`. Searches tree + floating; no-op if id not found. */
export function setRollup(doc: MindMapDoc, id: string, mapId: string | undefined): OpResult {
  return mutateAnyNode(doc, id, (n) => {
    n.rollup = mapId || undefined;
  });
}

/** Every distinct roll-up source map id referenced in the doc (tree + floating topics). */
export function collectRollupMapIds(doc: MindMapDoc): string[] {
  const ids = new Set<string>();
  const walk = (n: MapNode) => {
    if (n.rollup) ids.add(n.rollup);
    n.children.forEach(walk);
  };
  walk(doc.root);
  for (const f of doc.floatingTopics ?? []) walk(f);
  return [...ids];
}

/** Replace every roll-up node's children with a fresh copy of its source map's branches. `sources`
 *  maps a source map id → that map's root children. Pure; re-ids so pulled nodes never clash, and a
 *  refreshed node isn't recursed into (its subtree is fully managed by the pull). A source missing
 *  from `sources` leaves that node untouched. Returns the doc + the number of roll-ups refreshed. */
export function applyRollups(
  doc: MindMapDoc,
  sources: Map<string, MapNode[]>,
): { doc: MindMapDoc; count: number } {
  const next = structuredClone(doc);
  let count = 0;
  const walk = (n: MapNode) => {
    if (n.rollup && sources.has(n.rollup)) {
      n.children = (sources.get(n.rollup) ?? []).map(reId);
      n.collapsed = false;
      count += 1;
      return; // the pulled subtree is owned by the roll-up — don't recurse into it
    }
    n.children.forEach(walk);
  };
  walk(next.root);
  for (const f of next.floatingTopics ?? []) walk(f);
  return { doc: count > 0 ? next : doc, count };
}

/** Toggle free-canvas mode. When enabling with a positions map, seed each node's `pos` from it so
 *  the switch is seamless; disabling clears the flag but keeps positions (for re-enabling). */
export function setFreeform(
  doc: MindMapDoc,
  on: boolean,
  positions?: Map<string, { x: number; y: number }>,
): OpResult {
  const next = structuredClone(doc);
  next.meta = { ...next.meta, freeform: on || undefined };
  if (on && positions) {
    const seed = (n: MapNode): void => {
      const p = positions.get(n.id);
      if (p) n.pos = { x: p.x, y: p.y };
      n.children.forEach(seed);
    };
    seed(next.root);
    for (const f of next.floatingTopics ?? []) seed(f);
  }
  return { doc: next };
}
