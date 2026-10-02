import type { MindMapDoc } from "../../model/types";
import type { LayoutKind } from "../contract";
import {
  type Box,
  attachSideFor,
  axisForLayoutKind,
  bowToClear,
  computeAxisByParent,
  isTaperBranch,
} from "./floating";
import { computeLayout, estimateSizeOf } from "./layout";
import { project } from "./project";
import { indexBoxes } from "./spatialBoxes";
import type { EdgeData, FlowEdge, TopicNode } from "./types";

// The PURE core of FlowMindMap.sync(): turn the canonical model into the React Flow node + edge arrays
// the canvas renders. Project → lay out (measured sizes win over estimates) → derive each node's box
// once → stamp per-branch attachSide/attachBow (the SAME shared floating.ts geometry the SVG exporter
// uses, so canvas == export) → carry the selection + filter-dimming flags. No React / refs / setState
// here — the component wrapper owns docRef, setRenderDoc and setNodes/setEdges — which makes this whole
// transform unit-testable in isolation.

/** Minimal shape of a live React Flow node we read for measured sizing (its full type is heavier). */
export interface MeasuredNode {
  id: string;
  measured?: { width?: number; height?: number } | null;
}

export interface BuildFlowStateArgs {
  doc: MindMapDoc;
  palette: string[];
  numbered: boolean;
  /** Precomputed by the caller: `doc.meta?.freeform ? "freeform" : direction`. */
  kind: LayoutKind;
  /** The live React Flow nodes — their measured sizes override the content estimate when present. */
  measured: readonly MeasuredNode[];
  selectedIds: ReadonlySet<string>;
  selectedEdgeId: string | null;
  /** Power-filter "lit" set (matches + their ancestors); null = filter off, nothing dimmed. */
  litIds: ReadonlySet<string> | null;
  /** When true, non-lit nodes/edges are HIDDEN instead of dimmed (the filter's "hide" mode). */
  hideUnmatched?: boolean;
  /** Find-result set: these nodes get a highlight ring. null = no active search. */
  highlightIds?: ReadonlySet<string> | null;
  /** Optional local-library titles used by roll-up badges. */
  rollupTitles?: ReadonlyMap<string, string>;
}

export interface BuildFlowStateResult {
  nodes: TopicNode[];
  edges: FlowEdge[];
}

interface LayoutCacheEntry {
  key: string;
  positions: Map<string, { x: number; y: number }>;
}

// A warm worker survives completed builds, so keep its last geometry result too. Selection, notes,
// colours, task state and relationship edits all re-project the document but do not need another
// tree layout. The key intentionally contains only fields consumed by computeLayout/estimateSizeOf.
let lastLayout: LayoutCacheEntry | null = null;

function layoutKey(
  nodes: TopicNode[],
  edges: FlowEdge[],
  measured: readonly MeasuredNode[],
  kind: LayoutKind,
): string {
  const measuredById = new Map(measured.map((item) => [item.id, item.measured]));
  return JSON.stringify([
    kind,
    nodes.map((node) => {
      const data = node.data;
      const actual = measuredById.get(node.id);
      return [
        node.id,
        data.topic,
        data.number,
        Boolean(data.image),
        data.icons?.length ?? 0,
        data.tags?.length ?? 0,
        data.style?.maxWidth,
        data.layout,
        data.isRoot,
        data.depth,
        data.side,
        data.collapsed,
        data.floating,
        data.pos?.x,
        data.pos?.y,
        data.fontScale,
        actual?.width,
        actual?.height,
      ];
    }),
    edges.filter((edge) => !edge.data?.crosslink).map((edge) => [edge.source, edge.target]),
  ]);
}

export function buildFlowState(args: BuildFlowStateArgs): BuildFlowStateResult {
  const { doc, palette, numbered, kind, measured, selectedIds, selectedEdgeId, litIds } = args;
  const highlightIds = args.highlightIds ?? null;
  // "Hide" filter mode: when on, non-lit nodes/edges are removed from the canvas (React Flow `hidden`)
  // instead of dimmed. Matches keep their layout positions, so the map reads as a spotlight.
  const hideUnmatched = !!args.hideUnmatched && !!litIds;
  const proj = project(doc, palette, numbered, kind, args.rollupTitles);
  const est = estimateSizeOf(proj.nodes);
  // Index the live nodes by id ONCE; sizeOf is called a multiple of N times per layout pass.
  const measuredById = new Map(measured.map((n) => [n.id, n]));
  const sizeOf = (id: string) => {
    const m = measuredById.get(id);
    return m?.measured?.width && m?.measured?.height
      ? { width: m.measured.width, height: m.measured.height }
      : est(id);
  };
  const geometryKey = layoutKey(proj.nodes, proj.edges, measured, kind);
  const pos =
    lastLayout?.key === geometryKey
      ? lastLayout.positions
      : computeLayout(proj.nodes, proj.edges, sizeOf, kind);
  if (lastLayout?.key !== geometryKey) lastLayout = { key: geometryKey, positions: pos };
  const nodes: TopicNode[] = proj.nodes.map((n) => ({
    ...n,
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    selected: selectedIds.has(n.id),
    ...(hideUnmatched && litIds && !litIds.has(n.id) ? { hidden: true } : {}),
    data:
      litIds || highlightIds
        ? {
            ...n.data,
            ...(litIds ? { dimmed: !litIds.has(n.id) } : null),
            ...(highlightIds ? { matched: highlightIds.has(n.id) } : null),
          }
        : n.data,
  }));

  // Brace map hides the tapered branch ribbons (the "{" forks replace them); cross-links stay.
  const brace = kind === "brace";
  // Each node's box, computed ONCE per pass and reused for the attach-side fan + obstacle bow.
  const boxById = new Map<string, Box>();
  for (const n of proj.nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    const z = sizeOf(n.id);
    boxById.set(n.id, { cx: p.x + z.width / 2, cy: p.y + z.height / 2, w: z.width, h: z.height });
  }
  const rectOf = (id: string): Box | null => boxById.get(id) ?? null;
  const axisByParent = computeAxisByParent(proj.edges, rectOf, axisForLayoutKind(kind));
  const allBoxes = [...boxById.entries()].map(([id, box]) => ({ id, box }));
  // bowToClear performs exact geometry checks. On a large map, first narrow its candidates through a
  // conservative grid query; otherwise every branch scans every topic (quadratic growth). 368 is the
  // router's maximum 360px bow plus its default 8px clearance margin.
  const boxIndex = allBoxes.length >= 250 ? indexBoxes(allBoxes) : null;
  const obstaclesNear = (a: Box, b: Box) => {
    if (!boxIndex) return allBoxes;
    const pad = 368;
    return boxIndex.query(
      Math.min(a.cx - a.w / 2, b.cx - b.w / 2) - pad,
      Math.min(a.cy - a.h / 2, b.cy - b.h / 2) - pad,
      Math.max(a.cx + a.w / 2, b.cx + b.w / 2) + pad,
      Math.max(a.cy + a.h / 2, b.cy + b.h / 2) + pad,
    );
  };
  const edges: FlowEdge[] = proj.edges.map((e) => {
    let data = e.data;
    if (!e.data?.crosslink) {
      const pb = rectOf(e.source);
      const cb = rectOf(e.target);
      const attachSide =
        pb && cb ? attachSideFor(pb, cb, axisByParent.get(e.source) ?? "h") : undefined;
      // Only the tapered ribbon honours the bow → skip the work for elbow/straight/curved/dashed.
      const attachBow =
        pb && cb && attachSide && isTaperBranch(e.data ?? {})
          ? bowToClear(pb, cb, attachSide, obstaclesNear(pb, cb), e.source, e.target)
          : 0;
      data = { ...(e.data as EdgeData), attachSide, attachBow };
    }
    if (litIds) {
      data = { ...(data as EdgeData), dimmed: !(litIds.has(e.source) && litIds.has(e.target)) };
    }
    // Stamp the map-wide accent onto relationships so CrosslinkEdge can use it as the default stroke.
    if (e.data?.crosslink && doc.meta?.accentColor) {
      data = { ...(data as EdgeData), accent: doc.meta.accentColor };
    }
    // Hide an edge when the brace map hides ribbons OR (in hide-filter mode) either endpoint is unlit.
    const hidden =
      (brace && !e.data?.crosslink) ||
      (hideUnmatched && litIds ? !(litIds.has(e.source) && litIds.has(e.target)) : false);
    return {
      ...e,
      // Persist the selected relationship's halo across re-projection (mirrors the node path).
      selected: e.id === selectedEdgeId,
      ...(hidden ? { hidden: true } : {}),
      data,
    };
  });
  return { nodes, edges };
}
