import { useCallback, useEffect, useRef } from "react";
import type { TopicNode } from "./types";

type Fit = (options: {
  nodes: { id: string }[];
  minZoom: number;
  maxZoom: number;
  padding: number;
  duration: number;
}) => unknown;

/** Fit only the selected, visible topics; never refit in response to our own viewport animation.
 *  Manual navigation wins until the selection changes. Geometry changes are debounced so animated
 *  layouts get one final camera move instead of a new animation on every layout frame. */
export function useAutoZoom(opts: {
  enabled: boolean;
  selectedIds: ReadonlySet<string>;
  nodes: TopicNode[];
  initialized: boolean;
  editing: boolean;
  busy: boolean;
  reducedMotion: boolean;
  fitView: Fit;
  stopMotion?: () => void;
}) {
  const {
    enabled,
    selectedIds,
    nodes,
    initialized,
    editing,
    busy,
    reducedMotion,
    fitView,
    stopMotion,
  } = opts;
  const selection = enabled && selectedIds.size ? JSON.stringify([...selectedIds].sort()) : "";
  const geometry =
    selection &&
    JSON.stringify(
      nodes
        .filter((n) => selectedIds.has(n.id) && !n.hidden)
        .map((n) => [n.id, n.position.x, n.position.y, n.measured?.width, n.measured?.height]),
    );
  const latest = useRef({ selection, nodes, selectedIds, fitView, stopMotion });
  latest.current = { selection, nodes, selectedIds, fitView, stopMotion };
  const movingUntil = useRef(0);
  const manualSelection = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onManualMove = useCallback(() => {
    manualSelection.current = latest.current.selection;
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  // Geometry changes are a trigger; the timer reads the latest live nodes after layout settles.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable geometry signature debounces layout frames.
  useEffect(() => {
    if ((!enabled || editing || busy) && Date.now() < movingUntil.current) {
      movingUntil.current = 0;
      latest.current.stopMotion?.();
    }
    if (!enabled || manualSelection.current !== selection) manualSelection.current = null;
    if (!selection || !initialized || editing || busy || manualSelection.current === selection)
      return;
    timer.current = setTimeout(() => {
      const current = latest.current;
      const targets = current.nodes.filter((n) => current.selectedIds.has(n.id) && !n.hidden);
      if (!targets.length || manualSelection.current === current.selection) return;
      const duration = reducedMotion ? 0 : 320;
      movingUntil.current = Date.now() + duration;
      void current.fitView({
        nodes: targets.map((n) => ({ id: n.id })),
        padding: 0.32,
        minZoom: 0.2,
        maxZoom: 1.25,
        duration,
      });
    }, 180);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [enabled, initialized, editing, busy, reducedMotion, selection, geometry]);
  return onManualMove;
}
