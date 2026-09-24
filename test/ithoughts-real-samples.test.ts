import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fromIthoughts } from "../src/io/ithoughts";
import type { MapNode } from "../src/model/types";

const samples = [
  {
    file: "法理学.itmz",
    topics: 3017,
    links: 0,
    folded: 1033,
    images: 0,
    floating: 1,
  },
  {
    file: "法制史.itmz",
    topics: 3273,
    links: 0,
    folded: 1144,
    images: 0,
    floating: 1,
  },
  {
    file: "民法 .itmz",
    topics: 11859,
    links: 0,
    folded: 4007,
    images: 0,
    floating: 1,
  },
  {
    file: "宪法.itmz",
    topics: 2367,
    links: 0,
    folded: 719,
    images: 1,
    floating: 1,
  },
  {
    file: "刑法.itmz",
    topics: 10873,
    links: 1,
    folded: 4684,
    images: 9,
    floating: 0,
  },
];

function countNodes(node: MapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function countMatching(node: MapNode, predicate: (node: MapNode) => boolean): number {
  return (
    Number(predicate(node)) +
    node.children.reduce((sum, child) => sum + countMatching(child, predicate), 0)
  );
}

// The private sample corpus is never committed. Point ITHOUGHTS_SAMPLE_DIR at a local folder to run
// these regression checks; CI skips the suite while the synthetic importer tests still run normally.
const sampleDir = process.env.ITHOUGHTS_SAMPLE_DIR ?? "";
const describeSamples = sampleDir ? describe : describe.skip;

describeSamples("real iThoughts samples", () => {
  for (const sample of samples) {
    it(`imports every topic and relationship from ${sample.file}`, () => {
      const doc = fromIthoughts(new Uint8Array(readFileSync(join(sampleDir, sample.file))));
      const parsedTopics =
        countNodes(doc.root) +
        (doc.floatingTopics ?? []).reduce((sum, node) => sum + countNodes(node), 0);

      expect(parsedTopics).toBe(sample.topics);
      expect(doc.links?.length ?? 0).toBe(sample.links);
      const roots = [doc.root, ...(doc.floatingTopics ?? [])];
      expect(
        roots.reduce(
          (sum, node) => sum + countMatching(node, (item) => item.collapsed === true),
          0,
        ),
      ).toBe(sample.folded);
      expect(
        roots.reduce((sum, node) => sum + countMatching(node, (item) => item.image != null), 0),
      ).toBe(sample.images);
      expect(doc.floatingTopics?.length ?? 0).toBe(sample.floating);
      expect(doc.root.topic.trim().length).toBeGreaterThan(0);
    });
  }
});
