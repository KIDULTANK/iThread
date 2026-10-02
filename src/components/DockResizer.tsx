import { useCallback } from "react";
import { DOCK_MAX, DOCK_MIN } from "../hooks/usePanels";
import { t } from "../i18n";

const clamp = (w: number) => Math.min(DOCK_MAX, Math.max(DOCK_MIN, w));

// A drag handle on the left dock's right (canvas-facing) edge. The dock is docked at the far left, so
// dragging RIGHT widens it (mirror of InspectorResizer, which widens on a LEFT drag). The width is
// clamped + persisted by the caller; arrow keys nudge it (a11y).
export function DockResizer({
  width,
  onResize,
}: {
  width: number;
  onResize: (next: number) => void;
}) {
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const move = (ev: PointerEvent) => onResize(clamp(startW + (ev.clientX - startX)));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [width, onResize],
  );
  return (
    <div
      className="mm-dock-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t("panel.resizeSidePanels")}
      aria-valuenow={width}
      aria-valuemin={DOCK_MIN}
      aria-valuemax={DOCK_MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onResize(clamp(width + 8));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onResize(clamp(width - 8));
        }
      }}
    />
  );
}
