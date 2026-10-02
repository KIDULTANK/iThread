import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { EditorIcon } from "./EditorIcons";

// dataTransfer MIME tag identifying a document-tab drag. Carrying the source index on the drag (vs a
// shared ref) means tabs only accept tab drags — not a link/text drop — and there's no stale index
// left over from an aborted drag.
const TAB_DND = "application/x-mm-tab";

export interface DocTab {
  id: string;
  title: string;
}

interface DocumentTabsProps {
  docs: DocTab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  /** Drag a tab to a new index. When omitted, tabs aren't draggable. */
  onReorder?: (from: number, to: number) => void;
}

/**
 * The open-document tab strip: one tab per open map, the active one underlined in the accent colour.
 * Pure + prop-driven — the open set, persistence, and load/switch logic live in App + the
 * useOpenDocuments registry. Middle-click or the × closes a tab; the + opens a new map.
 */
export function DocumentTabs({
  docs,
  activeId,
  onActivate,
  onClose,
  onNew,
  onReorder,
}: DocumentTabsProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  // Keep the active tab visible when the strip overflows (e.g. switching maps via ⌘K). Optional-call
  // for jsdom, which doesn't implement scrollIntoView.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when the active doc changes
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  }, [activeId]);
  return (
    <div className="mm-doctabs" role="tablist" aria-label={t("tabs.openDocuments")}>
      <div className="mm-doctabs-scroll">
        {docs.map((d, i) => {
          const active = d.id === activeId;
          const label = d.title || t("panel.untitledMap");
          return (
            <div
              key={d.id}
              ref={active ? activeRef : undefined}
              className="mm-doctab"
              data-active={active || undefined}
              draggable={onReorder ? true : undefined}
              onDragStart={
                onReorder
                  ? (e) => {
                      e.dataTransfer.setData(TAB_DND, String(i));
                      e.dataTransfer.effectAllowed = "move";
                    }
                  : undefined
              }
              onDragOver={
                onReorder
                  ? (e) => {
                      // Accept ONLY a tab drag (not a link/text drop the canvas also handles).
                      if (e.dataTransfer.types.includes(TAB_DND)) e.preventDefault();
                    }
                  : undefined
              }
              onDrop={
                onReorder
                  ? (e) => {
                      const raw = e.dataTransfer.getData(TAB_DND);
                      if (raw === "") return; // not a tab drag → ignore
                      e.preventDefault();
                      const from = Number(raw);
                      if (Number.isInteger(from)) onReorder(from, i);
                    }
                  : undefined
              }
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="mm-doctab-main"
                title={label}
                onClick={() => onActivate(d.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onClose(d.id);
                  }
                }}
              >
                {label}
              </button>
              <button
                type="button"
                className="mm-doctab-x"
                aria-label={t("common.closeNamed", { name: label })}
                onClick={() => onClose(d.id)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mm-doctab-new"
        aria-label={t("tabs.newDocument")}
        title={t("tabs.newDocument")}
        onClick={onNew}
      >
        <EditorIcon name="plus" size={16} />
      </button>
    </div>
  );
}
