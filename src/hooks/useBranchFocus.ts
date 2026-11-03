import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { focusSet } from "../filter";
import type { MindMapDoc } from "../model/types";

export type FocusMode = "off" | "follow" | "locked";
type Target = { id: string; topic: string };

const NO_TARGETS: readonly string[] = [];

export function useBranchFocus(doc: MindMapDoc, selectedIds: readonly string[]) {
  const [state, setState] = useState<{ mapId: string; mode: FocusMode; ids: string[] }>({
    mapId: doc.id,
    mode: "off",
    ids: [],
  });
  const mode = state.mapId === doc.id ? state.mode : "off";
  const roots = mode === "follow" ? selectedIds : mode === "locked" ? state.ids : NO_TARGETS;
  const lit = useMemo(() => (roots.length ? focusSet(doc, roots) : null), [doc, roots]);
  // A focus is local to its map, and deleting every locked target exits it.
  useEffect(() => {
    if (state.mapId !== doc.id || (mode === "locked" && lit?.size === 0))
      setState({ mapId: doc.id, mode: "off", ids: [] });
  }, [doc.id, state.mapId, mode, lit]);
  const setMode = useCallback(
    (next: FocusMode) => {
      setState({
        mapId: doc.id,
        mode: next === "locked" && !selectedIds.length ? "follow" : next,
        ids: next === "locked" ? [...selectedIds] : [],
      });
    },
    [doc.id, selectedIds],
  );
  // Keep the existing guided walk / fixed-branch callers on the same spotlight pipeline.
  const setFocus: Dispatch<SetStateAction<Target | null>> = useCallback(
    (value) => {
      setState((previous) => {
        const id = previous.mapId === doc.id ? previous.ids[0] : undefined;
        const old = id ? { id, topic: "" } : null;
        const target = typeof value === "function" ? value(old) : value;
        return { mapId: doc.id, mode: target ? "locked" : "off", ids: target ? [target.id] : [] };
      });
    },
    [doc.id],
  );
  return { mode, setMode, setFocus, litIds: lit?.size ? lit : null };
}
