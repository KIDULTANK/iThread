import { describe, expect, it } from "vitest";
import { applyDocumentCommand, applyDocumentCommands, createAgentMap } from "../src/agent/commands";

describe("iThread agent document commands", () => {
  it("creates a map and can add then update a topic", () => {
    const map = createAgentMap("Research", "Question");
    const added = applyDocumentCommand(map, {
      action: "addTopic",
      parentId: map.root.id,
      id: "evidence",
      topic: "Evidence",
    });
    expect(map.root.children).toHaveLength(0);
    expect(added.doc.root.children[0]?.topic).toBe("Evidence");
    const updated = applyDocumentCommand(added.doc, {
      action: "updateTopic",
      nodeId: "evidence",
      topic: "Primary evidence",
    });
    expect(updated.doc.root.children[0]?.topic).toBe("Primary evidence");
  });

  it("moves a branch and rejects cycles", () => {
    const map = createAgentMap("Map");
    const withA = applyDocumentCommand(map, {
      action: "addTopic",
      parentId: map.root.id,
      id: "a",
      topic: "A",
    }).doc;
    const withB = applyDocumentCommand(withA, {
      action: "addTopic",
      parentId: map.root.id,
      id: "b",
      topic: "B",
    }).doc;
    const moved = applyDocumentCommand(withB, {
      action: "moveTopic",
      nodeId: "b",
      parentId: "a",
    }).doc;
    expect(moved.root.children.map((node) => node.id)).toEqual(["a"]);
    expect(moved.root.children[0]?.children[0]?.id).toBe("b");
    expect(() =>
      applyDocumentCommand(moved, { action: "moveTopic", nodeId: "a", parentId: "b" }),
    ).toThrow(/own branch/);
  });

  it("requires explicit confirmation and never deletes the central topic", () => {
    const map = createAgentMap("Map");
    const withChild = applyDocumentCommand(map, {
      action: "addTopic",
      parentId: map.root.id,
      id: "child",
      topic: "Child",
    }).doc;
    expect(() =>
      applyDocumentCommand(withChild, {
        action: "deleteTopic",
        nodeId: "child",
        confirm: false,
      } as unknown as Parameters<typeof applyDocumentCommand>[1]),
    ).toThrow(/explicit confirmation/);
    expect(() =>
      applyDocumentCommand(map, { action: "deleteTopic", nodeId: map.root.id, confirm: true }),
    ).toThrow(/central topic/);
  });

  it("applies a generated tree as one atomic batch", () => {
    const map = createAgentMap("Case", "争议焦点");
    const result = applyDocumentCommands(map, [
      { action: "addTopic", parentId: map.root.id, id: "law", topic: "法律依据" },
      { action: "addTopic", parentId: "law", id: "civil-code", topic: "民法典" },
      { action: "addTopic", parentId: map.root.id, id: "facts", topic: "案件事实" },
      { action: "updateTopic", nodeId: "facts", topic: "已查明事实" },
    ]);

    expect(map.root.children).toHaveLength(0);
    expect(result.nodeIds).toEqual(["law", "civil-code", "facts", "facts"]);
    expect(result.doc.root.children.map((node) => node.topic)).toEqual(["法律依据", "已查明事实"]);
    expect(result.doc.root.children[0]?.children[0]?.topic).toBe("民法典");
  });

  it("does not expose a partially applied document when a batch fails", () => {
    const map = createAgentMap("Map");
    expect(() =>
      applyDocumentCommands(map, [
        { action: "addTopic", parentId: map.root.id, id: "first", topic: "First" },
        { action: "addTopic", parentId: "missing", id: "second", topic: "Second" },
      ]),
    ).toThrow(/Parent topic not found/);
    expect(map.root.children).toHaveLength(0);
  });

  it("rejects empty, oversized, and unknown batch plans before they can be saved", () => {
    const map = createAgentMap("Map");
    expect(() => applyDocumentCommands(map, [])).toThrow(/at least one operation/);
    const repeated = Array.from({ length: 10_001 }, () => ({
      action: "addTopic" as const,
      parentId: map.root.id,
      topic: "x",
    }));
    expect(() => applyDocumentCommands(map, repeated)).toThrow(/10,000/);
    expect(() => applyDocumentCommand(map, { action: "unknown" } as never)).toThrow(
      /Unsupported document command/,
    );
  });
});
