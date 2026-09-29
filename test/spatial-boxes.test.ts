import { describe, expect, it } from "vitest";
import { indexBoxes } from "../src/mindmap/flow/spatialBoxes";

describe("indexBoxes", () => {
  const boxes = [
    { id: "left", box: { cx: -120, cy: 0, w: 40, h: 40 } },
    { id: "centre", box: { cx: 0, cy: 0, w: 80, h: 60 } },
    { id: "wide", box: { cx: 280, cy: 0, w: 300, h: 30 } },
  ];

  it("returns only boxes intersecting a query, including across negative and multiple cells", () => {
    const index = indexBoxes(boxes, 64);
    expect(index.query(-200, -30, 50, 30).map((item) => item.id)).toEqual(["left", "centre"]);
    expect(index.query(400, -20, 450, 20).map((item) => item.id)).toEqual(["wide"]);
    expect(index.query(600, 600, 700, 700)).toEqual([]);
  });

  it("deduplicates a large box registered in several grid cells", () => {
    const index = indexBoxes(boxes, 32);
    expect(index.query(100, -100, 500, 100).filter((item) => item.id === "wide")).toHaveLength(1);
  });
});
