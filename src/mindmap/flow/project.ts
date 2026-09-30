import type { MapNode, MindMapDoc } from "../../model/types";
import { outlineNumbers } from "../../outline";
import { cachedNodeProgress } from "../../progress";
import { conditionalActions, conditionalStyle, relationshipTypeIndex } from "../../rules";
import type { LayoutKind } from "../contract";
import { CROSSLINK_COLOR, fontScaleFactor } from "./style";
import type { FlowEdge, TopicNode } from "./types";

// Pure projection: canonical MindMapDoc → React Flow nodes + edges (positions are 0,0
// here; layout.ts assigns them). One node per MapNode; one "branch" edge per parent→child;
// cross-links become "crosslink" edges; floating topics become detached nodes. Branch
// colour follows the palette cycled by root-branch (the MindManager "coloured branch"
// identity). Collapsed subtrees are omitted (the node stays, flagged hasChildren). Pure +
// unit-tested — the read-only render and (later) the SVG export both build on it.

const FALLBACK_PALETTE = [
  "#E8593C",
  "#3B8BD4",
  "#27500A",
  "#BA7517",
  "#72243E",
  "#0C447C",
  "#993C1D",
];
const ROOT_COLOR = "#26215c";

export interface ProjectResult {
  nodes: TopicNode[];
  edges: FlowEdge[];
}

/** Count nodes in a subtree (used to balance the two sides). */
function subtreeSize(node: MapNode): number {
  return 1 + node.children.reduce((sum, c) => sum + subtreeSize(c), 0);
}

/** Assign each root-child to a side of the two-sided map. A pinned `side` is honoured (and counted);
 *  the unpinned branches are balanced by subtree size with Longest-Processing-Time — heaviest first,
 *  each placed on the currently-lighter side — which gives a tighter split than the old in-order greedy
 *  (the "Balance map" command clears all pins so this pure auto-balance reasserts). Result preserves the
 *  children's original order. */
function assignSides(children: MapNode[]): ("left" | "right")[] {
  const sizes = children.map(subtreeSize);
  const result: ("left" | "right")[] = new Array(children.length);
  let left = 0;
  let right = 0;
  const auto: number[] = [];
  children.forEach((child, i) => {
    if (child.side) {
      result[i] = child.side;
      if (child.side === "right") right += sizes[i];
      else left += sizes[i];
    } else {
      auto.push(i);
    }
  });
  // Heaviest unpinned branch first → the lighter side; deterministic tie-break by original index.
  auto.sort((a, b) => sizes[b] - sizes[a] || a - b);
  for (const i of auto) {
    const side: "left" | "right" = right <= left ? "right" : "left";
    result[i] = side;
    if (side === "right") right += sizes[i];
    else left += sizes[i];
  }
  return result;
}

/** Org-chart layouts (vertical hierarchy) draw right-angle elbow connectors, not the organic taper. */
const isOrg = (k: LayoutKind): boolean => k === "org-down" || k === "org-up";

export function project(
  doc: MindMapDoc,
  palette: string[] = FALLBACK_PALETTE,
  numbered = false,
  kind: LayoutKind = "side",
  rollupTitles?: ReadonlyMap<string, string>,
): ProjectResult {
  const pal = palette.length > 0 ? palette : FALLBACK_PALETTE;
  const connectorStyle = doc.meta?.connectorStyle;
  const branchGrowth = doc.meta?.branchGrowth;
  // Map-wide typography: one scale factor + base family for every node, so the canvas, the layout
  // estimate, and the exporter (all read from TopicData) size + render type identically.
  const fontScale = fontScaleFactor(doc.meta?.fontScale);
  const fontFamily = doc.meta?.fontFamily;
  const nodes: TopicNode[] = [];
  const edges: FlowEdge[] = [];
  // Auto-numbering is a view concern: numbers are computed from the tree and shown as a prefix,
  // never written into the model's `topic` (so exports/search/outline stay clean).
  const numbers = numbered ? outlineNumbers(doc.root, doc.meta?.numberStyle) : undefined;
  // Conditional formatting: a view-only style layered *under* each node's own style.
  const rules = doc.rules ?? [];
  // Per-node relationship-type sets, so a "relationshipType" rule can match endpoints — whether it's
  // a rule's primary condition or one of its AND-ed `also` clauses. Built once (the whole map's links)
  // rather than per node. Empty when no rule needs it — cheap either way.
  const relTypes = rules.some(
    (r) => r.kind === "relationshipType" || r.also?.some((c) => c.kind === "relationshipType"),
  )
    ? relationshipTypeIndex(doc.links)
    : undefined;

  const emit = (
    node: MapNode,
    parentId: string | undefined,
    depth: number,
    side: "left" | "right",
    color: string,
    floating: boolean,
    isRoot: boolean,
    recurse = true,
    // The layout governing the edge INTO this node (= the layout that placed it). Org layouts → the
    // branch renders as a right-angle elbow. A node's own `layout` override governs its children.
    edgeLayout: LayoutKind = kind,
    // How many children the parent has (the fan size of the edge INTO this node) — thins the trunk for
    // dense fans so the shared origin doesn't blob.
    parentFan = 0,
  ): void => {
    const progress = cachedNodeProgress(node);
    // Conditional-formatting *actions* (view-only, like condStyle): rule-applied markers + branch
    // colour. Merged into the projected `icons` / `branchColor` here, so TopicNode AND the SVG export
    // (both read this projected data) render them identically — canvas == export, nothing baked into
    // the model.
    const actions = conditionalActions(
      node,
      rules,
      progress?.progress,
      undefined,
      relTypes?.get(node.id),
    );
    // A node's own `branchColor` override (if set) recolours it AND its subtree (inherited via the
    // `color` passed down to children); a rule-applied branch colour is next; otherwise it keeps the
    // inherited auto-palette colour. `||` (not `??`): an imported/hand-edited "" branchColor must fall
    // back, not pass through as an empty stroke (setBranchColor already normalises "" → undefined).
    const nodeColor = node.branchColor || actions.branchColor || color;
    // Rule markers are unioned onto the node's own (deduped, node's first), so manual + auto coexist.
    const icons = actions.icons.length
      ? [...(node.icons ?? []), ...actions.icons.filter((ic) => !node.icons?.includes(ic))]
      : node.icons;
    // This node's children are governed by its own layout override, else the layout that placed it.
    // A subtree that grows LEFT (the two-sided map's left half, or an all-left layout) wants its
    // collapse toggle on the left (leaf-facing) edge — MindManager-style.
    const childLayout = (node.layout as LayoutKind | undefined) ?? edgeLayout;
    const tipLeft = childLayout === "left" || (childLayout === "side" && side === "left");
    nodes.push({
      id: node.id,
      type: "topic",
      position: { x: 0, y: 0 },
      data: {
        topic: node.topic,
        topicRich: node.topicRich,
        number: numbers?.get(node.id),
        note: node.note,
        hyperlink: node.hyperlink,
        image: node.image,
        icons,
        tags: node.tags,
        rollup: node.rollup,
        // The bound source map's title (resolved from the library) so the node's ⤵ badge can name it
        // (I11); undefined when the source map isn't in the local library.
        rollupTitle: node.rollup ? rollupTitles?.get(node.rollup) : undefined,
        style: node.style,
        // Conditional formatting is a separate view-only overlay (merged under `style` at render),
        // so the model + fromFlow stay lossless — nothing bakes into node.style.
        condStyle: conditionalStyle(
          node,
          rules,
          progress?.progress,
          undefined,
          relTypes?.get(node.id),
        ),
        pos: node.pos,
        layout: node.layout,
        isRoot,
        depth,
        branchColor: nodeColor,
        side,
        tipLeft: tipLeft || undefined,
        collapsed: Boolean(node.collapsed),
        hasChildren: node.children.length > 0,
        hiddenCount: node.collapsed ? node.children.length : undefined,
        childTitles: node.collapsed ? node.children.slice(0, 6).map((c) => c.topic) : undefined,
        progress,
        due: node.task?.due,
        start: node.task?.start,
        durationDays: node.task?.durationDays,
        resources: node.task?.resources,
        priority: node.task?.priority,
        attachmentCount: node.attachments?.length,
        attachmentNames: node.attachments?.map((a) => a.name),
        floating,
        locked: node.locked,
        fontScale,
        fontFamily,
      },
      // A locked node can't be dragged (move in freeform / reparent in the auto-layouts); undefined
      // leaves React Flow's global `nodesDraggable` in charge for everyone else.
      draggable: node.locked ? false : undefined,
    });
    if (parentId !== undefined) {
      edges.push({
        id: `e:${parentId}:${node.id}`,
        source: parentId,
        target: node.id,
        type: "branch", // a floating tapered edge — routes itself from the node borders
        data: {
          depth,
          branchColor: nodeColor,
          crosslink: false,
          elbow: isOrg(edgeLayout),
          connectorStyle,
          branchGrowth,
          fanCount: parentFan,
          dash: node.lineDash,
        },
      });
    }
    // Collapsed → keep the node (with hasChildren) but omit its descendants. The root is
    // emitted with recurse=false so its children are emitted once, per-branch (colour/side).
    if (node.collapsed || !recurse) return;
    // `childLayout` (computed above for the toggle side) also governs this node's children's edges.
    // The fan size carried on each child's edge = how many children share this node's origin.
    const fan = node.children.length;
    for (const child of node.children) {
      emit(child, node.id, depth + 1, side, nodeColor, floating, false, true, childLayout, fan);
    }
  };

  const root = doc.root;
  const rootFan = root.children.length;
  emit(root, undefined, 0, "right", ROOT_COLOR, false, true, false);
  const sides = assignSides(root.children);
  if (!root.collapsed) {
    root.children.forEach((child, i) => {
      emit(child, root.id, 1, sides[i], pal[i % pal.length], false, false, true, kind, rootFan);
    });
  }

  // Floating topics: each a detached subtree (no edge to the root). Each gets its own palette colour
  // (cycled) rather than a washed-out grey, so a floating cluster reads like a normal coloured mini-map
  // (MindManager). Floating subtrees are always placed horizontally (placeFloating), so their branches
  // stay organic even in an org-chart map. A sticky note keeps its explicit amber style (set per-node).
  (doc.floatingTopics ?? []).forEach((floating, i) => {
    emit(floating, undefined, 1, "right", pal[i % pal.length], true, false, true, "right");
  });

  // Cross-links: dashed, labelled relationship edges (floating custom edge).
  const lineJumps = Boolean(doc.meta?.lineJumps);
  for (const link of doc.links ?? []) {
    edges.push({
      id: link.id,
      source: link.from,
      target: link.to,
      type: "crosslink",
      label: link.label,
      data: {
        depth: 0,
        branchColor: CROSSLINK_COLOR,
        crosslink: true,
        lineJumps,
        arrow: link.arrow,
        color: link.color,
        width: link.width,
        dash: link.dash,
        curve: link.curve,
        linkType: link.type,
        showLinkTypes: Boolean(doc.meta?.showLinkTypes),
      },
    });
  }

  return { nodes, edges };
}
