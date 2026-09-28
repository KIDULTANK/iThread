import { useCallback, useEffect, useRef } from "react";
import type { MindMapDoc, SavedView } from "./model/types";

// Saved views — bookmark a perspective on a map (viewport + drill target + active Power Filter) and
// jump back to it.
//
// These live on the DOCUMENT (`doc.meta.savedViews`), not in localStorage. A view captures a viewport
// and a drilled-in topic id, both meaningless outside their own map, so storing them per-browser meant
// they didn't survive a `.json`/`.ithread` export, didn't reach a second machine, and vanished with a
// cleared library. Maps carried from the old `mindmap-views:<id>` key are migrated once, on open.
//
// The array ops stay pure (unit-tested); `setSavedViews` is the doc transform, applied through the
// same canvas `apply()` path as every other map-meta change so it lands in undo + autosave.

export type { SavedView } from "./model/types";

/** The old per-map localStorage key, kept only so existing views can be migrated off it. */
const legacyKey = (mapId: string) => `mindmap-views:${mapId}`;

/** Add a view, replacing any existing one with the same name (case-sensitive). Pure. */
export function addView(list: readonly SavedView[], view: SavedView): SavedView[] {
  return [...list.filter((v) => v.name !== view.name), view];
}

/** Remove the view with `id`. Pure. */
export function removeView(list: readonly SavedView[], id: string): SavedView[] {
  return list.filter((v) => v.id !== id);
}

/** The doc with `list` as its saved views. An empty list drops the key entirely, so a map that never
 *  had views doesn't gain an empty array in its exported JSON. Pure. */
export function setSavedViews(doc: MindMapDoc, list: readonly SavedView[]): MindMapDoc {
  return { ...doc, meta: { ...doc.meta, savedViews: list.length > 0 ? [...list] : undefined } };
}

/** Views left behind in localStorage for `mapId` by the pre-migration build (empty when there are
 *  none, or when storage is unavailable). Exported for the migration test. */
export function readLegacyViews(mapId: string): SavedView[] {
  try {
    const raw = JSON.parse(localStorage.getItem(legacyKey(mapId)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Drop the legacy key once its views have been folded into the doc. Best-effort. */
export function clearLegacyViews(mapId: string): void {
  try {
    localStorage.removeItem(legacyKey(mapId));
  } catch {
    // best-effort — a stale key is harmless, the migration is guarded by name
  }
}

/** Merge legacy views into the doc's own, keeping the doc's version of any same-named view. Pure. */
export function mergeLegacyViews(doc: MindMapDoc, legacy: readonly SavedView[]): MindMapDoc {
  const current = doc.meta?.savedViews ?? [];
  const names = new Set(current.map((v) => v.name));
  const incoming = legacy.filter((v) => v?.name && !names.has(v.name));
  if (incoming.length === 0) return doc;
  return setSavedViews(doc, [...current, ...incoming]);
}

export interface UseSavedViews {
  list: SavedView[];
  /** Add a captured view under `name` (no-op for a blank name). */
  add: (name: string, view: Omit<SavedView, "id" | "name">) => void;
  remove: (id: string) => void;
}

/**
 * Saved views for the live doc.
 *
 * `apply` is the caller's doc-mutation path (the canvas `setSavedViews`), so adding or removing a
 * view is undoable and autosaved like any other map change. On first open of a map that still has
 * localStorage views, they're merged in once and the legacy key is dropped.
 */
export function useSavedViews(doc: MindMapDoc, apply: (list: SavedView[]) => void): UseSavedViews {
  const list = doc.meta?.savedViews ?? [];
  const migrated = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: migrate once per map, on id change only
  useEffect(() => {
    if (migrated.current === doc.id) return;
    migrated.current = doc.id;
    const legacy = readLegacyViews(doc.id);
    if (legacy.length === 0) return;
    const merged = mergeLegacyViews(doc, legacy).meta?.savedViews ?? [];
    if (merged.length !== list.length) apply(merged);
    clearLegacyViews(doc.id);
  }, [doc.id]);

  const add = useCallback(
    (name: string, view: Omit<SavedView, "id" | "name">) => {
      const n = name.trim();
      if (!n) return;
      apply(addView(list, { id: crypto.randomUUID(), name: n, ...view }));
    },
    [list, apply],
  );
  const remove = useCallback((id: string) => apply(removeView(list, id)), [list, apply]);

  return { list, add, remove };
}
