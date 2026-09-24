import { t } from "../../i18n/registry";
import "./messages";
import { NodeToolbar, Position } from "@xyflow/react";
import { EditorIcon, type EditorIconName } from "../../components/EditorIcons";
import { colors } from "../../design/tokens";
import type { MindMapDoc } from "../../model/types";
import { findAnyNode } from "./ops";

/** One button in the inline node popover (the on-selection quick-action toolbar). Renders an
 *  EditorIcon, or a text `glyph` (emoji) for actions with no icon in the set (e.g. priority ⚑). */
function PopBtn({
  icon,
  glyph,
  label,
  active,
  danger,
  onClick,
}: {
  icon?: EditorIconName;
  glyph?: string;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mm-pop-btn nodrag nopan"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        border: "none",
        background: active ? colors.accentTint : "transparent",
        cursor: "pointer",
        color: danger ? "#b23b3a" : active ? colors.accent : colors.muted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: glyph ? 15 : undefined,
        lineHeight: 1,
      }}
    >
      {glyph ?? (icon ? <EditorIcon name={icon} size={16} /> : null)}
    </button>
  );
}

/** Inline contextual popover — quick actions above the selected node: Collapse / expand (when the node
 *  has children) and "More…", which opens the full right-click menu at the node so Rename / Delete / Add
 *  callout / roll-up etc. are all one click away without right-clicking (C6 — friendlier on trackpad +
 *  touch). Node-tracked via React Flow's NodeToolbar so it stays put through pan/zoom; hidden while the
 *  node is being inline-edited. Canvas-only (never exported). */
export function NodePopover({
  selectedId,
  editingId,
  doc,
  onToggleCollapse,
  onOpenNote,
  onCyclePriority,
  onStartLink,
  onMore,
}: {
  selectedId: string | null;
  editingId: string | null;
  doc: MindMapDoc;
  onToggleCollapse: (id: string) => void;
  onOpenNote: (id: string) => void;
  onCyclePriority: (id: string) => void;
  onStartLink: (id: string) => void;
  onMore: (id: string) => void;
}) {
  if (!selectedId || editingId === selectedId) return null;
  const sid = selectedId;
  const sel = findAnyNode(doc, sid);
  const hasKids = (sel?.children?.length ?? 0) > 0;
  const hasNote = !!sel?.note?.trim();
  const hasPriority = !!sel?.task?.priority;
  return (
    <NodeToolbar nodeId={sid} isVisible position={Position.Top} offset={10}>
      {/* The transient contextual action bar (UI-3): the high-value per-node edits surface here on
          selection — note / priority / link — replacing the hover pill that used to pop in over the
          node. Branch creation plus Rename / Delete / markers remain in the right-click menu.
          Node-tracked via NodeToolbar so it stays put through pan/zoom. */}
      <div
        className="nodrag nopan"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 11,
          padding: 4,
          // Themed elevation so the action bar's shadow follows light/dark (was a fixed light shadow).
          boxShadow: "var(--ed-shadow-pop, 0 10px 30px rgba(40,30,16,0.18))",
        }}
      >
        <PopBtn
          icon="note"
          label={hasNote ? t("canvas.openNote") : t("canvas.menu.addNote")}
          active={hasNote}
          onClick={() => onOpenNote(sid)}
        />
        <PopBtn
          glyph="⚑"
          label={hasPriority ? t("canvas.cyclePriority") : t("canvas.addPriority")}
          active={hasPriority}
          onClick={() => onCyclePriority(sid)}
        />
        <PopBtn icon="link" label={t("canvas.menu.linkTo")} onClick={() => onStartLink(sid)} />
        {hasKids ? (
          <PopBtn
            icon="minus"
            label={t("canvas.menu.collapseExpand")}
            onClick={() => onToggleCollapse(sid)}
          />
        ) : null}
        <PopBtn icon="dots" label={t("canvas.moreActions")} onClick={() => onMore(sid)} />
      </div>
    </NodeToolbar>
  );
}
