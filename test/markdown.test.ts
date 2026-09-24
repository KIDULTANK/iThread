// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fromMarkdown, toMarkdown } from "../src/io/markdown";
import type { MapNode, MindMapDoc } from "../src/model/types";

const node = (id: string, topic: string, children: MapNode[] = []): MapNode => ({
  id,
  topic,
  children,
});

const sample: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: node("r", "Plan", [
    node("a", "Strategy", [node("a1", "Grow EU"), node("a2", "Cut costs")]),
    node("b", "People"),
  ]),
};

// Compare topic-tree shape, ignoring ids (fromMarkdown mints fresh ones).
function shape(n: MapNode): { topic: string; children: unknown[] } {
  return { topic: n.topic, children: n.children.map(shape) };
}

describe("markdown io", () => {
  it("serialises to an H1 root + nested bullets", () => {
    expect(toMarkdown(sample)).toBe(
      ["# Plan", "- Strategy", "  - Grow EU", "  - Cut costs", "- People", ""].join("\n"),
    );
  });

  it("round-trips the topic tree", () => {
    expect(shape(fromMarkdown(toMarkdown(sample)).root)).toEqual(shape(sample.root));
  });

  it("bakes outline numbers into each topic when a numbers map is given", () => {
    const numbers = new Map([
      ["a", "1"],
      ["a1", "1.1"],
      ["a2", "1.2"],
      ["b", "2"],
    ]);
    expect(toMarkdown(sample, numbers)).toBe(
      ["# Plan", "- 1 Strategy", "  - 1.1 Grow EU", "  - 1.2 Cut costs", "- 2 People", ""].join(
        "\n",
      ),
    );
  });

  it("reads the H1 as the root title", () => {
    const doc = fromMarkdown("# My Map\n- one\n- two\n");
    expect(doc.title).toBe("My Map");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["one", "two"]);
  });

  it("restores inline topic formatting and preserves it on Markdown export", () => {
    const doc = fromMarkdown("# **法理学**\n- ==重点==与__下划线__\n  - *斜体*及~~删除线~~\n");
    expect(doc.root).toMatchObject({ topic: "法理学", topicRich: "<strong>法理学</strong>" });
    expect(doc.root.children[0]).toMatchObject({
      topic: "重点与下划线",
      topicRich: "<mark>重点</mark>与<u>下划线</u>",
    });
    expect(toMarkdown(doc)).toBe("# **法理学**\n- ==重点==与__下划线__\n  - *斜体*及~~删除线~~\n");
  });

  it("nests by indentation and tolerates tabs and *", () => {
    const doc = fromMarkdown("# Root\n* a\n\ta1\n* b");
    // "\ta1" is not a bullet line — ignored; a and b are top-level.
    expect(doc.root.children.map((c) => c.topic)).toEqual(["a", "b"]);
  });

  it("defaults the title when no heading is present", () => {
    const doc = fromMarkdown("- lonely");
    expect(doc.title).toBe("Untitled map");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["lonely"]);
  });

  it("keeps the default title for an empty heading", () => {
    // "#   " matches the heading regex but yields an empty title — it must fall
    // back to the default rather than blanking the root.
    const doc = fromMarkdown("#   \n- x");
    expect(doc.title).toBe("Untitled map");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["x"]);
  });

  it("builds hierarchy from multi-level headings, with bullets under the current heading", () => {
    // # root, ## sections, bullets nested below them (the real Markdown/Markmap shape).
    const doc = fromMarkdown("# Root\n## Branch A\n- Leaf 1\n- Leaf 2\n## Branch B\n### Deep\n- x");
    expect(doc.title).toBe("Root");
    expect(shape(doc.root)).toEqual({
      topic: "Root",
      children: [
        {
          topic: "Branch A",
          children: [
            { topic: "Leaf 1", children: [] },
            { topic: "Leaf 2", children: [] },
          ],
        },
        {
          topic: "Branch B",
          children: [{ topic: "Deep", children: [{ topic: "x", children: [] }] }],
        },
      ],
    });
  });

  it("attaches headings under the root when there is no H1", () => {
    const doc = fromMarkdown("## A\n## B\n- b1");
    expect(doc.title).toBe("Untitled map");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["A", "B"]);
    expect(doc.root.children[1].children.map((c) => c.topic)).toEqual(["b1"]);
  });

  it("collapses newlines in a topic to a single space so the bullet line stays intact", () => {
    // A multi-line topic must not split into a broken bullet + an orphaned line that re-import drops.
    const multiline: MindMapDoc = {
      schemaVersion: 1,
      id: "d",
      title: "T",
      root: node("r", "Root\nwith break", [node("a", "Help\n\nPlease  now")]),
    };
    const md = toMarkdown(multiline);
    expect(md).toBe(["# Root with break", "- Help Please now", ""].join("\n"));
    // And it round-trips cleanly (no content lost on re-import).
    expect(shape(fromMarkdown(md).root)).toEqual({
      topic: "Root with break",
      children: [{ topic: "Help Please now", children: [] }],
    });
  });

  it("attaches an over-indented bullet (no shallower parent) to the root", () => {
    // A first bullet indented past level 1 has no parent on the stack; it should
    // anchor to the root rather than crash.
    const doc = fromMarkdown("# Root\n      - orphan");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["orphan"]);
  });
});
