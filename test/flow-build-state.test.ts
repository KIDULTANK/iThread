import { describe, expect, it } from "vitest";
import { type MeasuredNode, buildFlowState } from "../src/mindmap/flow/buildFlowState";
import {
  type Box,
  attachSideFor,
  axisForLayoutKind,
  computeAxisByParent,
} from "../src/mindmap/flow/floating";
import { estimateSizeOf } from "../src/mindmap/flow/layout";
import { project } from "../src/mindmap/flow/project";
import type { MindMapDoc } from "../src/model/types";

// buildFlowState() is the pure project→layout→edge-geometry→flags core lifted out of FlowMindMap.sync().
// These pin its contract directly (sync's logic was previously untested) — including the canvas==export
// invariant: a branch edge's attachSide/attachBow must equal a direct call to the shared floating.ts
// geometry on the same node boxes (the SVG exporter uses the identical helpers).

const PALETTE = ["#E8593C", "#3B8BD4", "#27500A"];

const doc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        children: [
          { id: "a1", topic: "A1", children: [] },
          { id: "a2", topic: "A2", children: [] },
        ],
      },
      { id: "b", topic: "Bravo", children: [] },
    ],
  },
});

const build = (over: Partial<Parameters<typeof buildFlowState>[0]> = {}) =>
  buildFlowState({
    doc: doc(),
    palette: PALETTE,
    numbered: false,
    kind: "left",
    measured: [],
    selectedIds: new Set(),
    selectedEdgeId: null,
    litIds: null,
    ...over,
  });

describe("buildFlowState", () => {
  it("returns one positioned node per projected node + one edge per projected edge", () => {
    const { nodes, edges } = build();
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["a", "a1", "a2", "b", "r"]);
    for (const n of nodes) {
      expect(typeof n.position.x).toBe("number");
      expect(typeof n.position.y).toBe("number");
      expect(Number.isFinite(n.position.x)).toBe(true);
    }
    expect(edges.length).toBe(4); // r→a, r→b, a→a1, a→a2
  });

  it("marks only the nodes in selectedIds as selected; the selected edge carries the halo", () => {
    const { nodes } = build({ selectedIds: new Set(["a", "a1"]) });
    expect(
      nodes
        .filter((n) => n.selected)
        .map((n) => n.id)
        .sort(),
    ).toEqual(["a", "a1"]);

    const { edges } = build();
    const someEdge = edges[0].id;
    const sel = build({ selectedEdgeId: someEdge }).edges;
    expect(sel.find((e) => e.id === someEdge)?.selected).toBe(true);
    expect(sel.filter((e) => e.selected).length).toBe(1);
  });

  it("reuses positions when an edit does not change geometry", () => {
    const first = build();
    const second = build({ selectedIds: new Set(["a"]) });
    const firstById = new Map(first.nodes.map((node) => [node.id, node.position]));
    for (const node of second.nodes) expect(node.position).toBe(firstById.get(node.id));

    const changed = doc();
    changed.root.children[0].topic = "A much longer topic that changes its estimated width";
    const third = build({ doc: changed });
    expect(third.nodes.find((node) => node.id === "a")?.position).not.toBe(firstById.get("a"));
  });

  it("dims everything outside the lit set when a filter is active; no dimmed key when off", () => {
    const lit = build({ litIds: new Set(["r", "a"]) });
    const byId = new Map(lit.nodes.map((n) => [n.id, n]));
    expect(byId.get("r")?.data.dimmed).toBe(false);
    expect(byId.get("a")?.data.dimmed).toBe(false);
    expect(byId.get("b")?.data.dimmed).toBe(true);
    expect(byId.get("a1")?.data.dimmed).toBe(true);
    // filter off → the dimmed property is never touched (left undefined on the projected data)
    expect(build().nodes.every((n) => n.data.dimmed === undefined)).toBe(true);
  });

  it("hides non-lit nodes/edges in hide mode (matches keep their layout positions)", () => {
    const hidden = build({ litIds: new Set(["r", "a"]), hideUnmatched: true });
    const byId = new Map(hidden.nodes.map((n) => [n.id, n]));
    expect(byId.get("r")?.hidden).toBeFalsy();
    expect(byId.get("a")?.hidden).toBeFalsy();
    expect(byId.get("b")?.hidden).toBe(true);
    expect(byId.get("a1")?.hidden).toBe(true);
    // edges to a hidden endpoint hide too (r→a stays, a→a1 / r→b go)
    const edge = (s: string, t: string) =>
      hidden.edges.find((e) => e.source === s && e.target === t);
    expect(edge("r", "a")?.hidden).toBeFalsy();
    expect(edge("a", "a1")?.hidden).toBe(true);
    // dimming-only (hideUnmatched off) never sets hidden
    const dim = build({ litIds: new Set(["r", "a"]) });
    expect(dim.nodes.every((n) => !n.hidden)).toBe(true);
  });

  it("flags Find results with `matched`; no matched key when there's no active search", () => {
    const found = build({ highlightIds: new Set(["a", "a1"]) });
    const byId = new Map(found.nodes.map((n) => [n.id, n]));
    expect(byId.get("a")?.data.matched).toBe(true);
    expect(byId.get("a1")?.data.matched).toBe(true);
    expect(byId.get("b")?.data.matched).toBe(false);
    expect(build().nodes.every((n) => n.data.matched === undefined)).toBe(true);
  });

  it("stamps every branch edge's attachSide/attachBow to match the shared floating.ts geometry (canvas==export)", () => {
    const kind = "left" as const;
    const { nodes, edges } = build({ kind });
    // Independently rebuild the boxes from the returned positions + the same size estimate, then call
    // the shared helper directly — buildFlowState must agree with it edge-for-edge.
    const proj = project(doc(), PALETTE, false, kind);
    const est = estimateSizeOf(proj.nodes);
    const posOf = new Map(nodes.map((n) => [n.id, n.position]));
    const boxOf = (id: string): Box | null => {
      const p = posOf.get(id);
      if (!p) return null;
      const s = est(id);
      return { cx: p.x + s.width / 2, cy: p.y + s.height / 2, w: s.width, h: s.height };
    };
    const axis = computeAxisByParent(proj.edges, boxOf, axisForLayoutKind(kind));
    let branchEdges = 0;
    for (const e of edges) {
      if (e.data?.crosslink) continue;
      branchEdges++;
      const pb = boxOf(e.source);
      const cb = boxOf(e.target);
      const expected = pb && cb ? attachSideFor(pb, cb, axis.get(e.source) ?? "h") : undefined;
      expect(e.data?.attachSide, `${e.source}→${e.target}`).toBe(expected);
      expect(typeof e.data?.attachBow).toBe("number");
    }
    expect(branchEdges).toBe(4);
  });

  it("hides the tapered branch ribbons in brace mode", () => {
    const { edges } = build({ kind: "brace" });
    for (const e of edges) {
      if (!e.data?.crosslink) expect(e.hidden).toBe(true);
    }
  });

  it("uses a node's measured size over the content estimate (it changes the layout)", () => {
    // A node measured far wider than its estimate shifts the tidy-tree layout — proving sizeOf precedence.
    const wide: MeasuredNode[] = [{ id: "a", measured: { width: 600, height: 200 } }];
    const withMeasured = build({ measured: wide });
    const without = build();
    const pa = withMeasured.nodes.find((n) => n.id === "a1")?.position;
    const pb = without.nodes.find((n) => n.id === "a1")?.position;
    expect(pa).not.toEqual(pb);
  });
});
