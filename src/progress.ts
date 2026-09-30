import type { MapNode } from "./model/types";

// Task progress + roll-up (pure). A node is a "task" when it carries `task.progress` (0..1).
// A parent with task descendants shows a *rolled-up* completion: the flat average over every
// leaf task in its subtree (so it reads as "% of all tasks complete"), plus a done/total count.
// A node with no task descendants falls back to its own `task.progress` if set. Non-task nodes
// are simply absent from the map. Unit-tested; the canvas badge, Info panel, and outline all
// build on this.

export interface ProgressInfo {
  /** Rolled-up completion, 0..1. */
  progress: number;
  /** Leaf tasks at 100% within this subtree. */
  done: number;
  /** Total leaf tasks within this subtree (1 for a single leaf task). */
  total: number;
  /** True when rolled up from descendants (read-only) vs set directly on this node. */
  derived: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Editor operations preserve unchanged node objects. Cache each subtree's roll-up summary by object
// identity so expanding one branch only recomputes its ancestor path, not every hidden topic in a
// 10,000-node map. WeakMap keeps removed documents/subtrees collectible.
const progressSummaryCache = new WeakMap<MapNode, ProgressInfo | null>();

export function cachedNodeProgress(node: MapNode): ProgressInfo | undefined {
  if (progressSummaryCache.has(node)) return progressSummaryCache.get(node) ?? undefined;
  const childInfos = node.children
    .map(cachedNodeProgress)
    .filter((x): x is ProgressInfo => x !== undefined);
  let info: ProgressInfo | undefined;
  if (childInfos.length > 0) {
    const total = childInfos.reduce((sum, child) => sum + child.total, 0);
    const done = childInfos.reduce((sum, child) => sum + child.done, 0);
    const progress = childInfos.reduce((sum, child) => sum + child.progress * child.total, 0);
    info = { progress: total > 0 ? progress / total : 0, done, total, derived: true };
  } else if (node.task?.progress !== undefined) {
    const progress = clamp01(node.task.progress);
    info = { progress, done: progress >= 1 ? 1 : 0, total: 1, derived: false };
  }
  progressSummaryCache.set(node, info ?? null);
  return info;
}

/** Compute task-progress info for every task-bearing node in a tree, keyed by node id. Pure. */
export function progressMap(root: MapNode): Map<string, ProgressInfo> {
  const map = new Map<string, ProgressInfo>();
  const visit = (node: MapNode): ProgressInfo | undefined => {
    const childInfos = node.children.map(visit).filter((x): x is ProgressInfo => x !== undefined);
    if (childInfos.length > 0) {
      // Roll up: weight each child by its leaf-task count so the result is a flat average
      // over all leaf tasks in the subtree (childInfo.progress * childInfo.total = that
      // child's summed leaf progress).
      const total = childInfos.reduce((s, c) => s + c.total, 0);
      const done = childInfos.reduce((s, c) => s + c.done, 0);
      const sum = childInfos.reduce((s, c) => s + c.progress * c.total, 0);
      const info: ProgressInfo = {
        progress: total > 0 ? sum / total : 0,
        done,
        total,
        derived: true,
      };
      map.set(node.id, info);
      return info;
    }
    // Leaf (or a parent with no task descendants): use its own progress if set.
    const own = node.task?.progress;
    if (own === undefined) return undefined;
    const p = clamp01(own);
    const info: ProgressInfo = { progress: p, done: p >= 1 ? 1 : 0, total: 1, derived: false };
    map.set(node.id, info);
    return info;
  };
  visit(root);
  return map;
}

/** Progress info for a single node, rolled up from its own subtree. Pure. */
export function nodeProgress(node: MapNode): ProgressInfo | undefined {
  return cachedNodeProgress(node);
}

/** Does this node have any task-bearing descendant? (Then its progress is derived/read-only.) Pure. */
export function hasTaskDescendants(node: MapNode): boolean {
  return node.children.some((c) => c.task?.progress !== undefined || hasTaskDescendants(c));
}

/** Round a 0..1 fraction to a whole-percent integer (0..100). */
export function toPercent(fraction: number): number {
  return Math.round(clamp01(fraction) * 100);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * SVG path `d` for a pie wedge filling `fraction` of a circle, clockwise from 12 o'clock.
 * Returns "" for fraction ≤ 0 (nothing to fill) or ≥ 1 (the caller draws a full circle instead).
 * Pure + shared by the on-canvas pie (ProgressPie) and the SVG exporter, so they match. Pure.
 */
export function piePath(cx: number, cy: number, r: number, fraction: number): string {
  const f = clamp01(fraction);
  if (f <= 0 || f >= 1) return "";
  const angle = f * 2 * Math.PI;
  const ex = round2(cx + r * Math.sin(angle));
  const ey = round2(cy - r * Math.cos(angle));
  const large = f > 0.5 ? 1 : 0;
  return `M ${round2(cx)} ${round2(cy - r)} A ${round2(r)} ${round2(r)} 0 ${large} 1 ${ex} ${ey} L ${round2(cx)} ${round2(cy)} Z`;
}

/** The quarter-step task levels a click on the pie cycles through. */
const LEVELS = [0, 0.25, 0.5, 0.75, 1];

/** iThoughts-style progress shortcut: P increments and Shift+P decrements across
 * not-a-task ↔ 0% ↔ 25% ↔ 50% ↔ 75% ↔ 100%. */
export function stepTaskProgress(
  current: number | undefined,
  direction: "up" | "down",
): number | undefined {
  const states: (number | undefined)[] = [undefined, ...LEVELS];
  if (current === undefined) return direction === "up" ? 0 : 1;
  const normalised = LEVELS.reduce((best, level) =>
    Math.abs(level - current) < Math.abs(best - current) ? level : best,
  );
  const index = states.indexOf(normalised);
  if (direction === "up") return states[(index + 1) % states.length];
  return states[(index - 1 + states.length) % states.length];
}

/** The next quarter-step level after `cur`, looping 100% → 0%. Pure (drives click-to-cycle). */
export function nextProgressLevel(cur: number): number {
  return LEVELS.find((l) => l > clamp01(cur) + 0.001) ?? 0;
}

/** The next state for the topic task checkbox, a three-way cycle: not-a-task (undefined) → to-do (0)
 *  → done (1) → not-a-task. Any partial value jumps to done. Pure (drives the quick task toggle). */
export function cycleTaskProgress(current: number | undefined): number | undefined {
  if (current === undefined) return 0;
  if (current >= 1) return undefined;
  return 1;
}

/** SVG path `d` for a tick sized to a circle of radius `r` at (cx,cy) — the ✓ shown at 100%. Pure. */
export function checkPath(cx: number, cy: number, r: number): string {
  const p = (x: number, y: number) => `${round2(x)} ${round2(y)}`;
  return `M ${p(cx - 0.42 * r, cy + 0.04 * r)} L ${p(cx - 0.12 * r, cy + 0.34 * r)} L ${p(cx + 0.46 * r, cy - 0.36 * r)}`;
}
