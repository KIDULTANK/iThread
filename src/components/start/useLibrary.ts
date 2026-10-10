import { useEffect, useState } from "react";
import { type Folder, getAllMaps, getFolders, listTrashedMaps } from "../../store/mapStore";
import type { MapEntry } from "./MapCard";
import { branchSpokes, docNodeCount } from "./nodeStats";

// Load the whole library as MapEntry[] (id, title, node count, last-edited, sheet group). Re-runs
// when `rev` changes (bumped after a delete/rename/duplicate). One read serves Home/All maps/Recent.

export function useLibrary(rev: number): MapEntry[] {
  const [entries, setEntries] = useState<MapEntry[]>([]);
  // `rev` isn't read inside the effect — it's the explicit re-fetch trigger (bumped after a
  // delete/rename/duplicate), so it belongs in the deps despite biome's heuristic.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rev is the re-fetch signal, by design
  useEffect(() => {
    let alive = true;
    getAllMaps()
      .then((docs) => {
        if (!alive) return;
        setEntries(
          docs
            .filter((d) => !d.meta?.trashedAt) // trashed maps live in the Trash view, not the library
            .map((d) => ({
              id: d.id,
              title: d.title,
              nodeCount: docNodeCount(d),
              updatedAt: d.meta?.updatedAt,
              branches: branchSpokes(d),
              previewRoot: {
                id: d.root.id,
                topic: d.root.topic,
                children: d.root.children.slice(0, 4).map((child) => ({
                  id: child.id,
                  topic: child.topic,
                  children: child.children.slice(0, 2).map((leaf) => ({
                    id: leaf.id,
                    topic: leaf.topic,
                    children: [],
                  })),
                })),
              },
              pinned: d.meta?.pinned ?? false,
              folderId: d.meta?.folderId,
            })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rev]);
  return entries;
}

/** The library folders (C2), re-fetched when `rev` bumps. */
export function useFolders(rev: number): Folder[] {
  const [folders, setFolders] = useState<Folder[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rev is the re-fetch signal, by design
  useEffect(() => {
    let alive = true;
    getFolders()
      .then((f) => {
        if (alive) setFolders(f);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rev]);
  return folders;
}

/** One map in the Trash (soft-deleted), for the Trash view. */
export interface TrashEntry {
  id: string;
  title: string;
  trashedAt: number;
}

/** The Trash contents (soft-deleted maps), re-fetched when `rev` bumps. */
export function useTrashMaps(rev: number): TrashEntry[] {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rev is the re-fetch signal, by design
  useEffect(() => {
    let alive = true;
    listTrashedMaps()
      .then((rows) => {
        if (alive) setEntries(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rev]);
  return entries;
}
