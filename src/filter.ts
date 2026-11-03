import type { CompletionMode, DueMode, FilterCriteria, MapNode, MindMapDoc } from "./model/types";
import { priorityLabel } from "./priority";
import { progressMap } from "./progress";
import { isDueSoon, isOverdue, todayISO } from "./taskDate";

// Read-only "Power Filter": given criteria (free text + required markers/tags), find which nodes
// match and which should stay lit on the canvas. Lit = matches *plus their ancestors*, so the
// path from the root to each match stays visible while everything else dims. Pure + unit-tested;
// the canvas only reduces opacity (no structural change, nothing deleted), hence "read-only".

// The criteria types themselves live in the model — a saved view persists them into `doc.meta`, so
// they're part of the document schema. Re-exported here so every existing import site is unchanged.
export type { CompletionMode, DueMode, FilterCriteria, RelDir } from "./model/types";

/** Is any criterion set? When false the canvas shows everything (no dimming). */
export function isFilterActive(c: FilterCriteria): boolean {
  return (
    c.text.trim().length > 0 ||
    c.markers.length > 0 ||
    c.tags.length > 0 ||
    (c.due ?? "") !== "" ||
    !!c.priority ||
    (c.completion ?? "") !== "" ||
    !!c.relDir
  );
}

/** A named, reusable Power-Filter preset (persisted app-wide). */
export interface SavedFilter {
  id: string;
  name: string;
  criteria: FilterCriteria;
}

const DUE_LABEL: Record<Exclude<DueMode, "">, string> = {
  dated: "📅 dated",
  overdue: "📅 overdue",
  soon: "📅 due ≤7d",
};

const COMPLETION_LABEL: Record<Exclude<CompletionMode, "">, string> = {
  complete: "✓ done",
  incomplete: "○ not done",
  "in-progress": "◐ in progress",
};

/** A short human label for a saved filter's criteria (for the saved-filters list tooltip). */
export function describeCriteria(c: FilterCriteria): string {
  const parts: string[] = [];
  if (c.text.trim()) parts.push(`"${c.text.trim()}"`);
  if (c.markers.length) parts.push(c.markers.join(" "));
  if (c.tags.length) parts.push(c.tags.map((t) => `#${t}`).join(" "));
  if (c.due) parts.push(DUE_LABEL[c.due]);
  if (c.priority) parts.push(`${priorityLabel(c.priority)} priority`);
  if (c.completion) parts.push(COMPLETION_LABEL[c.completion]);
  if (c.relDir) {
    const dir = c.relDir === "out" ? "→" : c.relDir === "in" ? "←" : "↔";
    parts.push(`${dir} ${c.relType ?? "relationship"}`);
  }
  return parts.join(" · ") || "everything";
}

/** Build `nodeId → { out, in }` sets of relationship types, for the "has relationship" filter. Pure. */
export function relationshipDirIndex(
  doc: MindMapDoc,
): Map<string, { out: Set<string>; in: Set<string> }> {
  const index = new Map<string, { out: Set<string>; in: Set<string> }>();
  const slot = (id: string) => {
    const s = index.get(id) ?? { out: new Set<string>(), in: new Set<string>() };
    index.set(id, s);
    return s;
  };
  for (const l of doc.links ?? []) {
    const type = l.type ?? "relates-to";
    slot(l.from).out.add(type);
    slot(l.to).in.add(type);
  }
  return index;
}

/** Does a node satisfy a "has relationship" constraint given its out/in type sets? */
function relMatches(
  c: FilterCriteria,
  rel: { out: Set<string>; in: Set<string> } | undefined,
): boolean {
  if (!c.relDir) return true; // constraint off
  const hit = (set: Set<string> | undefined) =>
    !!set && (c.relType ? set.has(c.relType) : set.size > 0);
  const out = hit(rel?.out);
  const inc = hit(rel?.in);
  return c.relDir === "out" ? out : c.relDir === "in" ? inc : out || inc;
}

function nodeMatches(
  n: MapNode,
  c: FilterCriteria,
  q: string,
  today: string,
  effectiveProgress: number | undefined,
  rel: { out: Set<string>; in: Set<string> } | undefined,
): boolean {
  // Text matches topic or note, case-insensitive. (The Power Filter has dedicated marker/tag
  // pickers, so its free-text box stays scoped to the prose surfaces.)
  if (q && !`${n.topic} ${n.note ?? ""}`.toLowerCase().includes(q)) return false;
  // Marker / tag constraints are AND across categories, OR within one (any selected marker counts).
  if (c.markers.length && !c.markers.some((m) => n.icons?.includes(m))) return false;
  if (c.tags.length && !c.tags.some((t) => n.tags?.includes(t))) return false;
  // Due-date constraint (uses the node's effective, rolled-up completion to judge "done").
  const due = c.due ?? "";
  if (due === "dated" && !n.task?.due) return false;
  if (due === "overdue" && !isOverdue(n.task?.due, effectiveProgress, today)) return false;
  if (due === "soon" && !isDueSoon(n.task?.due, effectiveProgress, today)) return false;
  if (c.priority && n.task?.priority !== c.priority) return false;
  // Completion uses the node's effective (rolled-up) progress. A node with no task anywhere in its
  // subtree has no completion state (undefined), so it never matches a completion constraint.
  const comp = c.completion ?? "";
  if (comp) {
    if (effectiveProgress === undefined) return false;
    if (comp === "complete" && effectiveProgress < 1) return false;
    if (comp === "incomplete" && effectiveProgress >= 1) return false;
    if (comp === "in-progress" && (effectiveProgress <= 0 || effectiveProgress >= 1)) return false;
  }
  if (!relMatches(c, rel)) return false;
  return true;
}

export interface FilterResult {
  /** Node ids to keep at full opacity (matches + every ancestor on a path to a match). */
  lit: Set<string>;
  /** How many nodes actually matched (ancestors-only nodes don't count). */
  matches: number;
}

// "Focus this branch": the lit set is the node's whole subtree plus its ancestors (the path back
// to the root), so focusing keeps the branch and its route visible while everything else dims.
// Reuses the same lit/dim pipeline as the Power Filter. Empty set if the id isn't found. Pure.
export function focusSet(doc: MindMapDoc, ids: string | readonly string[]): Set<string> {
  const wanted = new Set(typeof ids === "string" ? [ids] : ids);
  const lit = new Set<string>();
  if (!wanted.size) return lit;
  // One iterative traversal of the main and floating trees. On the way down, mark focused
  // descendants; on the way back up, mark their ancestors. No repeated subtree scans for multi-select.
  const stack = [doc.root, ...(doc.floatingTopics ?? [])].map((node) => ({
    node,
    inside: false,
    exit: false,
  }));
  while (stack.length) {
    const item = stack.pop();
    if (!item) break;
    const { node, inside, exit } = item;
    if (exit) {
      if (node.children.some((child) => lit.has(child.id))) lit.add(node.id);
    } else {
      const focused = inside || wanted.has(node.id);
      if (focused) lit.add(node.id);
      stack.push({ node, inside: focused, exit: true });
      for (const child of node.children) stack.push({ node: child, inside: focused, exit: false });
    }
  }
  return lit;
}

/** Build a NEW map containing only the lit nodes — the Power Filter's "extract matches to a new map".
 *  Prunes the central tree (+ floating topics) to lit nodes, keeping ancestors so the structure holds,
 *  and drops cross-links / boundaries / summaries that reference removed nodes. Returns null when the
 *  lit set is empty (nothing to extract). Pure — the caller assigns it a fresh id + stores it. */
export function filterToDoc(
  doc: MindMapDoc,
  lit: ReadonlySet<string>,
  newId: string,
): MindMapDoc | null {
  if (lit.size === 0 || !lit.has(doc.root.id)) return null;
  const title = `${doc.title} (filtered)`;
  const prune = (n: MapNode): MapNode => ({
    ...n,
    children: n.children.filter((c) => lit.has(c.id)).map(prune),
  });
  const both = <T extends { from: string; to: string }>(l: T) => lit.has(l.from) && lit.has(l.to);
  const out: MindMapDoc = structuredClone({
    ...doc,
    id: newId,
    title,
    root: { ...prune(doc.root), topic: title },
    links: (doc.links ?? []).filter(both),
    boundaries: (doc.boundaries ?? [])
      .map((b) => ({ ...b, nodeIds: b.nodeIds.filter((id) => lit.has(id)) }))
      .filter((b) => b.nodeIds.length > 0),
    summaries: (doc.summaries ?? []).filter((s) => s.nodeIds.every((id) => lit.has(id))),
    floatingTopics: (doc.floatingTopics ?? []).filter((f) => lit.has(f.id)).map(prune),
  });
  return out;
}

export function filterResult(
  doc: MindMapDoc,
  c: FilterCriteria,
  // Default to the real today so a caller that omits it still gets correct overdue / due-soon results
  // (an empty string would make every date comparison silently fail). Callers pass it for determinism.
  today = todayISO(),
): FilterResult {
  const q = c.text.trim().toLowerCase();
  // Effective (rolled-up) completion per node, so a "done" parent isn't flagged overdue.
  const prog = new Map(progressMap(doc.root));
  for (const f of doc.floatingTopics ?? []) for (const [k, v] of progressMap(f)) prog.set(k, v);
  // Per-node out/in relationship-type sets, built once, only when the "has relationship" filter is on.
  const rel = c.relDir ? relationshipDirIndex(doc) : undefined;
  const lit = new Set<string>();
  let matches = 0;
  const walk = (n: MapNode, ancestors: string[]): void => {
    if (nodeMatches(n, c, q, today, prog.get(n.id)?.progress, rel?.get(n.id))) {
      matches += 1;
      lit.add(n.id);
      for (const a of ancestors) lit.add(a);
    }
    const next = [...ancestors, n.id];
    for (const child of n.children) walk(child, next);
  };
  walk(doc.root, []);
  for (const f of doc.floatingTopics ?? []) walk(f, []);
  return { lit, matches };
}
