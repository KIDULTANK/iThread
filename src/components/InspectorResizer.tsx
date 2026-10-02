import { useCallback } from "react";
import { INSPECTOR_MAX, INSPECTOR_MIN } from "../hooks/usePanels";
import { t } from "../i18n";

const clamp = (w: number) => Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, w));

// A drag handle on the inspector's left (canvas-facing) edge. The inspector is docked at the far
// right, so dragging LEFT widens it; the width is clamped and persisted by the caller. Arrow keys
// nudge it (a11y). Hidden on phones via CSS (.mm-inspector-resizer @media).
export function InspectorResizer({
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
      const move = (ev: PointerEvent) => onResize(clamp(startW - (ev.clientX - startX)));
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
      className="mm-inspector-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t("panel.resizeInspector")}
      aria-valuenow={width}
      aria-valuemin={INSPECTOR_MIN}
      aria-valuemax={INSPECTOR_MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onResize(clamp(width + 8));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onResize(clamp(width - 8));
        }
      }}
    />
  );
}
