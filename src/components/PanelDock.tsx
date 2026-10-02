import { type ReactNode, useEffect, useRef } from "react";
import { t } from "../i18n";
import { DockResizer } from "./DockResizer";

// The left dock — the read-mostly side panels share ONE tabbed column instead of stacking as N 250px
// columns that could crush the canvas. One panel shows at a time; the tab strip switches between the
// open ones and each tab carries a × to close that panel. Presentational: App builds the entries (open
// panels, in order) + owns the active-tab state; this just renders the tabs + the active body.

export interface DockEntry {
  key: string;
  label: string;
  onClose: () => void;
  node: ReactNode;
}

const TAB_BTN = {
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  padding: 0,
} as const;

export function PanelDock({
  entries,
  active,
  onActivate,
  width,
  onResize,
}: {
  entries: DockEntry[];
  /** The active tab's key; falls back to the last entry when it doesn't match an open panel. */
  active: string | null;
  onActivate: (key: string) => void;
  /** Persisted dock width (px); when set with onResize, a drag handle on the right edge resizes it. */
  width?: number;
  onResize?: (next: number) => void;
}) {
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const activeEntry = entries.find((e) => e.key === active) ?? entries[entries.length - 1];
  // Keep the active tab visible when the strip overflows (e.g. switching panels via ⌘K). Optional-call
  // for jsdom, which doesn't implement scrollIntoView.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when the active tab changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  }, [activeEntry?.key]);
  if (entries.length === 0 || !activeEntry) return null;
  return (
    <div className="mm-dock" style={width ? { width } : undefined}>
      <div className="mm-dock-tabs" role="tablist" aria-label={t("panel.sidePanels")}>
        {entries.map((e) => (
          <span
            key={e.key}
            className="mm-dock-tab"
            data-active={activeEntry.key === e.key || undefined}
          >
            <button
              type="button"
              ref={activeEntry.key === e.key ? activeTabRef : undefined}
              role="tab"
              aria-selected={activeEntry.key === e.key}
              onClick={() => onActivate(e.key)}
              style={TAB_BTN}
            >
              {e.label}
            </button>
            <button
              type="button"
              className="mm-dock-tab-close"
              aria-label={t("common.closeNamed", { name: e.label })}
              onClick={e.onClose}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mm-dock-body">{activeEntry.node}</div>
      {width && onResize ? <DockResizer width={width} onResize={onResize} /> : null}
    </div>
  );
}
