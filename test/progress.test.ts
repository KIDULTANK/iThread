import { describe, expect, it } from "vitest";
import type { MapNode } from "../src/model/types";
import {
  checkPath,
  cycleTaskProgress,
  hasTaskDescendants,
  nextProgressLevel,
  nodeProgress,
  piePath,
  progressMap,
  stepTaskProgress,
  toPercent,
} from "../src/progress";

// A node helper that defaults children to [].
const n = (id: string, over: Partial<MapNode> = {}): MapNode => ({
  id,
  topic: id,
  children: [],
  ...over,
});

// Root
// ├─ A (parent, no own progress)
// │   ├─ A1  task 100%
// │   └─ A2  task 0%
// ├─ B  task 50%   (leaf task)
// └─ C  (parent, no task descendants, no own progress)
//     └─ C1 (plain, no task)
const tree: MapNode = n("root", {
  children: [
    n("A", {
      children: [n("A1", { task: { progress: 1 } }), n("A2", { task: { progress: 0 } })],
    }),
    n("B", { task: { progress: 0.5 } }),
    n("C", { children: [n("C1")] }),
  ],
});

describe("progressMap", () => {
  const map = progressMap(tree);

  it("reports a leaf task by its own progress (done/total = 1)", () => {
    expect(map.get("A1")).toEqual({ progress: 1, done: 1, total: 1, derived: false });
    expect(map.get("A2")).toEqual({ progress: 0, done: 0, total: 1, derived: false });
    expect(map.get("B")).toEqual({ progress: 0.5, done: 0, total: 1, derived: false });
  });

  it("rolls a parent up as the flat average over its leaf tasks (derived)", () => {
    // A = mean(100%, 0%) = 50%, 1 of 2 done
    expect(map.get("A")).toEqual({ progress: 0.5, done: 1, total: 2, derived: true });
    // root = mean over leaf tasks A1(100), A2(0), B(50) = 50%, 1 of 3 done
    expect(map.get("root")).toEqual({ progress: 0.5, done: 1, total: 3, derived: true });
  });

  it("omits nodes that aren't tasks and have no task descendants", () => {
    expect(map.has("C")).toBe(false);
    expect(map.has("C1")).toBe(false);
  });

  it("weights by leaf count, not by immediate children", () => {
    // One branch with two leaves at 100%, one lone leaf at 0% → 2/3, not 1/2.
    const t = n("r", {
      children: [
        n("big", {
          children: [n("x", { task: { progress: 1 } }), n("y", { task: { progress: 1 } })],
        }),
        n("small", { task: { progress: 0 } }),
      ],
    });
    const m = progressMap(t);
    expect(m.get("r")).toEqual({ progress: 2 / 3, done: 2, total: 3, derived: true });
  });

  it("clamps out-of-range progress into 0..1", () => {
    const m = progressMap(n("r", { task: { progress: 1.7 } }));
    expect(m.get("r")?.progress).toBe(1);
  });

  it("prefers a parent's own progress only when it has no task descendants", () => {
    const own = progressMap(n("r", { task: { progress: 0.4 }, children: [n("c")] }));
    expect(own.get("r")).toEqual({ progress: 0.4, done: 0, total: 1, derived: false });
  });
});

describe("nodeProgress", () => {
  it("returns the rolled-up info for a single node", () => {
    expect(nodeProgress(tree)?.derived).toBe(true);
    expect(nodeProgress(n("solo", { task: { progress: 0.25 } }))).toEqual({
      progress: 0.25,
      done: 0,
      total: 1,
      derived: false,
    });
    expect(nodeProgress(n("plain"))).toBeUndefined();
  });
});

describe("hasTaskDescendants", () => {
  it("is true when any descendant is a task", () => {
    expect(hasTaskDescendants(tree)).toBe(true);
    expect(hasTaskDescendants(n("A", { children: [n("A1", { task: { progress: 1 } })] }))).toBe(
      true,
    );
  });
  it("is false for a leaf or a subtree with no tasks", () => {
    expect(hasTaskDescendants(n("B", { task: { progress: 0.5 } }))).toBe(false); // own task ≠ descendant
    expect(hasTaskDescendants(n("C", { children: [n("C1")] }))).toBe(false);
  });
});

describe("toPercent", () => {
  it("rounds a 0..1 fraction to a whole percent and clamps", () => {
    expect(toPercent(0.5)).toBe(50);
    expect(toPercent(2 / 3)).toBe(67);
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(9)).toBe(100);
  });
});

describe("piePath", () => {
  it("returns an empty string for nothing (≤0) or a full circle (≥1)", () => {
    expect(piePath(8, 8, 8, 0)).toBe("");
    expect(piePath(8, 8, 8, 1)).toBe("");
    expect(piePath(8, 8, 8, -0.5)).toBe("");
    expect(piePath(8, 8, 8, 2)).toBe("");
  });

  it("draws a quarter wedge clockwise from 12 o'clock (small-arc flag)", () => {
    // 25% → from top (8,0) to 3 o'clock (16,8), small arc, then back to centre.
    expect(piePath(8, 8, 8, 0.25)).toBe("M 8 0 A 8 8 0 0 1 16 8 L 8 8 Z");
  });

  it("uses the large-arc flag past the halfway mark", () => {
    expect(piePath(8, 8, 8, 0.75)).toContain("A 8 8 0 1 1");
  });
});

describe("nextProgressLevel", () => {
  it("steps through the quarters and loops 100% → 0%", () => {
    expect(nextProgressLevel(0)).toBe(0.25);
    expect(nextProgressLevel(0.25)).toBe(0.5);
    expect(nextProgressLevel(0.5)).toBe(0.75);
    expect(nextProgressLevel(0.75)).toBe(1);
    expect(nextProgressLevel(1)).toBe(0); // wrap
  });

  it("rounds an off-grid value up to the next quarter", () => {
    expect(nextProgressLevel(0.1)).toBe(0.25);
    expect(nextProgressLevel(0.6)).toBe(0.75);
  });
});

describe("cycleTaskProgress", () => {
  it("cycles not-a-task → to-do → done → not-a-task", () => {
    expect(cycleTaskProgress(undefined)).toBe(0);
    expect(cycleTaskProgress(0)).toBe(1);
    expect(cycleTaskProgress(1)).toBeUndefined();
  });

  it("jumps any partial value straight to done", () => {
    expect(cycleTaskProgress(0.5)).toBe(1);
    expect(cycleTaskProgress(0.25)).toBe(1);
  });
});

describe("stepTaskProgress", () => {
  it("increments like iThoughts P", () => {
    expect(stepTaskProgress(undefined, "up")).toBe(0);
    expect(stepTaskProgress(0, "up")).toBe(0.25);
    expect(stepTaskProgress(0.25, "up")).toBe(0.5);
    expect(stepTaskProgress(0.5, "up")).toBe(0.75);
    expect(stepTaskProgress(0.75, "up")).toBe(1);
    expect(stepTaskProgress(1, "up")).toBeUndefined();
  });

  it("decrements like iThoughts Shift+P", () => {
    expect(stepTaskProgress(undefined, "down")).toBe(1);
    expect(stepTaskProgress(1, "down")).toBe(0.75);
    expect(stepTaskProgress(0.75, "down")).toBe(0.5);
    expect(stepTaskProgress(0.5, "down")).toBe(0.25);
    expect(stepTaskProgress(0.25, "down")).toBe(0);
    expect(stepTaskProgress(0, "down")).toBeUndefined();
  });
});

describe("checkPath", () => {
  it("returns a 3-point tick path (two segments)", () => {
    const d = checkPath(8, 8, 8);
    expect(d.startsWith("M ")).toBe(true);
    expect((d.match(/L /g) ?? []).length).toBe(2);
  });
});
