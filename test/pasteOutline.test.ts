import { describe, expect, it } from "vitest";
import { parseMdShorthand, parseOutline } from "../src/io/pasteOutline";
import type { MapNode } from "../src/model/types";

// Compare structure (topic + children) without caring about generated ids.
type Shape = { topic: string; children: Shape[] };
const shape = (nodes: MapNode[]): Shape[] =>
  nodes.map((n) => ({ topic: n.topic, children: shape(n.children) }));
const leaf = (topic: string): Shape => ({ topic, children: [] });

describe("parseOutline", () => {
  it("nests an indented bullet list (mixed -/* markers)", () => {
    expect(shape(parseOutline("- A\n  - B\n  * C\n- D"))).toEqual([
      { topic: "A", children: [leaf("B"), leaf("C")] },
      leaf("D"),
    ]);
  });

  it("uses heading levels for depth", () => {
    expect(shape(parseOutline("# A\n## B\n## C\n### D"))).toEqual([
      { topic: "A", children: [leaf("B"), { topic: "C", children: [leaf("D")] }] },
    ]);
  });

  it("strips numbered markers and treats tabs as indentation", () => {
    expect(shape(parseOutline("1. A\n\t2. B\n3. C"))).toEqual([
      { topic: "A", children: [leaf("B")] },
      leaf("C"),
    ]);
  });

  it("nests bullets under the nearest heading and ignores blank lines", () => {
    expect(shape(parseOutline("# Root\n\n- one\n- two\n  - sub\n"))).toEqual([
      { topic: "Root", children: [leaf("one"), { topic: "two", children: [leaf("sub")] }] },
    ]);
  });

  it("handles plain indented lines (no markers) and empty input", () => {
    expect(shape(parseOutline("A\n  B\n  C"))).toEqual([
      { topic: "A", children: [leaf("B"), leaf("C")] },
    ]);
    expect(parseOutline("   \n\n")).toEqual([]);
  });

  it("generates unique ids", () => {
    const collectIds = (ns: MapNode[]): string[] =>
      ns.flatMap((n) => [n.id, ...collectIds(n.children)]);
    const ids = collectIds(parseOutline("- A\n  - B\n- C"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applies markdown shorthand: checkbox → task, whole-line link → hyperlink, emphasis stripped", () => {
    const nodes = parseOutline(
      "- [ ] Todo item\n- [x] Done item\n- [Docs](https://x.test/d)\n- **Bold** and `code`",
    );
    expect(nodes.map((n) => n.topic)).toEqual(["Todo item", "Done item", "Docs", "Bold and code"]);
    expect(nodes[0].task?.progress).toBe(0);
    expect(nodes[1].task?.progress).toBe(1);
    expect(nodes[2].hyperlink).toBe("https://x.test/d");
    expect(nodes[2].task).toBeUndefined();
  });
});

describe("parseMdShorthand", () => {
  it("parses tasks, links, and emphasis; rejects unsafe link schemes", () => {
    expect(parseMdShorthand("[x] Ship it")).toEqual({
      topic: "Ship it",
      task: { progress: 1 },
      hyperlink: undefined,
    });
    expect(parseMdShorthand("[Site](https://x.test)")).toMatchObject({
      topic: "Site",
      hyperlink: "https://x.test",
    });
    // A javascript: URL is not a recognised safe scheme → left as literal topic text, no hyperlink.
    expect(parseMdShorthand("[x](javascript:alert(1))")).toMatchObject({ hyperlink: undefined });
    expect(parseMdShorthand("plain topic")).toEqual({
      topic: "plain topic",
      task: undefined,
      hyperlink: undefined,
    });
    expect(parseMdShorthand("**粗体** ==高亮== __下划线__")).toMatchObject({
      topic: "粗体 高亮 下划线",
      topicRich: "<strong>粗体</strong> <mark>高亮</mark> <u>下划线</u>",
    });
  });
});
