import { describe, expect, it } from "vitest";
import { applyDocumentCommand, createAgentMap } from "../src/agent/commands";

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
});
