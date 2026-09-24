import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc } from "../src/io/json";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [{ id: "a", topic: "Alpha", note: "memo", children: [] }],
  },
  links: [{ id: "l1", from: "r", to: "a", label: "rel" }],
  boundaries: [{ id: "b1", nodeIds: ["a"], label: "Group" }],
};

describe("json I/O", () => {
  it("round-trips the full doc losslessly", () => {
    expect(parseDoc(serializeDoc(doc))).toEqual(doc);
  });

  it("rejects non-JSON text", () => {
    expect(() => parseDoc("not json {")).toThrow(/valid JSON/);
  });

  it("rejects JSON that isn't a MindMap doc", () => {
    expect(() => parseDoc('{"hello":"world"}')).toThrow(/iThread/);
    expect(() => parseDoc('{"schemaVersion":1}')).toThrow(/iThread/);
  });

  it("round-trips a typed relationship + the showLinkTypes flag (B3)", () => {
    const typed: MindMapDoc = {
      ...doc,
      links: [{ id: "l1", from: "r", to: "a", label: "rel", type: "depends-on" }],
      meta: { showLinkTypes: true },
    };
    const back = parseDoc(serializeDoc(typed));
    expect(back.links?.[0].type).toBe("depends-on");
    expect(back.meta?.showLinkTypes).toBe(true);
    expect(back).toEqual(typed);
  });
});
