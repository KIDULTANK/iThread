import { describe, expect, it } from "vitest";
import { analyzeIthoughtsCompatibility } from "../src/io/ithoughtsCompatibility";
import type { MindMapDoc } from "../src/model/types";

const base = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "m",
  title: "Map",
  root: { id: "r", topic: "Root", children: [] },
});

describe("iThoughts compatibility report", () => {
  it("reports a plain hierarchy as fully representable", () => {
    const report = analyzeIthoughtsCompatibility(base());
    expect(report.topics).toBe(1);
    expect(report.issueItems).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("counts the content that the writer preserves", () => {
    const doc = base();
    doc.root.note = "note";
    doc.root.hyperlink = "https://example.com";
    doc.root.task = { progress: 0.5, priority: 2 };
    doc.root.image = { url: "data:image/png;base64,AA==" };
    doc.floatingTopics = [{ id: "f", topic: "Float", children: [] }];
    doc.links = [{ id: "l", from: "r", to: "f", label: "related" }];
    const report = analyzeIthoughtsCompatibility(doc);
    expect(report).toMatchObject({
      topics: 2,
      notes: 1,
      primaryLinks: 1,
      embeddedAssets: 1,
      taskProgress: 1,
      floatingTopics: 1,
      relationships: 1,
      issueItems: 0,
    });
  });

  it("names and counts features that need attention", () => {
    const doc = base();
    doc.root.topicRich = "<strong>Root</strong>";
    doc.root.icons = ["⭐"];
    doc.root.tags = ["law"];
    doc.root.hyperlinks = ["https://two.example"];
    doc.root.callouts = [{ id: "c", text: "why", dx: 1, dy: 1 }];
    doc.root.task = { due: "2026-10-02", resources: ["Zack"] };
    doc.root.attachments = [
      { name: "a.pdf", dataUrl: "data:application/pdf;base64,AA==", size: 1 },
      { name: "b.pdf", dataUrl: "data:application/pdf;base64,AA==", size: 1 },
    ];
    doc.boundaries = [{ id: "b", nodeIds: ["r"] }];
    const report = analyzeIthoughtsCompatibility(doc);
    expect(Object.fromEntries(report.issues.map((i) => [i.code, i.count]))).toMatchObject({
      richTextConverted: 1,
      markersAndTags: 2,
      extraHyperlinks: 1,
      extraAssets: 1,
      callouts: 1,
      taskDetails: 2,
      mapObjects: 1,
    });
  });
});
