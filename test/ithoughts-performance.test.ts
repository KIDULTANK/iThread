import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fromIthoughts } from "../src/io/ithoughts";
import { buildFlowState } from "../src/mindmap/flow/buildFlowState";
import type { MapNode, MindMapDoc } from "../src/model/types";

const samples = [
  ["法理学.itmz", 3017],
  ["法制史.itmz", 3273],
  ["民法 .itmz", 11859],
  ["宪法.itmz", 2367],
  ["刑法.itmz", 10873],
] as const;

const sampleDir = process.env.ITHOUGHTS_SAMPLE_DIR ?? "";
const describeSamples = sampleDir ? describe : describe.skip;
const buildLimitMs = Number(process.env.ITHOUGHTS_BENCH_LIMIT_MS ?? 30_000);

function expandAll(node: MapNode): void {
  node.collapsed = false;
  for (const child of node.children) expandAll(child);
}

function expandDocument(doc: MindMapDoc): void {
  expandAll(doc.root);
  for (const floating of doc.floatingTopics ?? []) expandAll(floating);
}

function build(doc: MindMapDoc) {
  return buildFlowState({
    doc,
    palette: [],
    numbered: false,
    kind: "right",
    measured: [],
    selectedIds: new Set(),
    selectedEdgeId: null,
    litIds: null,
  });
}

// Private-corpus benchmark. It is skipped in CI unless ITHOUGHTS_SAMPLE_DIR is supplied, so the
// user's maps never enter the repository. Besides timing import and layout, this forces every folded
// branch open: the exact worst case that previously made large legal-study maps stutter.
describeSamples("real iThoughts large-map performance", () => {
  for (const [file, topics] of samples) {
    it(`imports and fully lays out ${file}`, () => {
      const bytes = new Uint8Array(readFileSync(join(sampleDir, file)));
      const importStart = performance.now();
      const doc = fromIthoughts(bytes);
      const importMs = performance.now() - importStart;

      const foldedStart = performance.now();
      const folded = build(doc);
      const foldedMs = performance.now() - foldedStart;

      expandDocument(doc);
      const expandedStart = performance.now();
      const expanded = build(doc);
      const expandedMs = performance.now() - expandedStart;

      console.info(
        `[iThread benchmark] ${file}: import=${importMs.toFixed(1)}ms, ` +
          `folded=${folded.nodes.length} nodes/${foldedMs.toFixed(1)}ms, ` +
          `expanded=${expanded.nodes.length} nodes/${expandedMs.toFixed(1)}ms`,
      );

      expect(expanded.nodes).toHaveLength(topics);
      expect(importMs).toBeLessThan(buildLimitMs);
      expect(foldedMs).toBeLessThan(buildLimitMs);
      expect(expandedMs).toBeLessThan(buildLimitMs);
    }, 90_000);
  }
});
