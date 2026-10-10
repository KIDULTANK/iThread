import { t } from "../../i18n/registry";
import "./messages";
import type { MapNode } from "../../model/types";
import { timeAgo } from "../../ui";
import { MiniMap } from "./MiniMap";

// A saved-map card: thumbnail + title + meta (node count · last edited) + a hover kebab with
// Open / Rename / Duplicate / Export / Delete. The parent wires the actions to the store.

export interface MapEntry {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt?: number;
  /** Real branch colours (one per root child) → a structure-bearing thumbnail; absent for a bare root. */
  branches?: string[];
  /** Bounded two-level projection for a useful library thumbnail. */
  previewRoot?: MapNode;
  /** Pinned to the top of the library lists (curated, recency-independent). */
  pinned?: boolean;
  /** The library folder this map is filed under (C2); absent = top level. */
  folderId?: string;
}

// `label` is a getter: a plain `label: t("…")` here resolves ONCE at import and never follows a later
// `setLocale`. `key` (the action's identity, also the React key) stays a plain literal.
const KEBAB: { key: string; label: string }[] = [
  {
    key: "open",
    get label() {
      return t("start.open");
    },
  },
  {
    key: "rename",
    get label() {
      return t("common.rename");
    },
  },
  {
    key: "duplicate",
    get label() {
      return t("start.duplicate");
    },
  },
  {
    key: "move",
    get label() {
      return t("start.moveToFolder");
    },
  },
  {
    key: "export",
    get label() {
      return t("start.export");
    },
  },
  {
    key: "delete",
    get label() {
      return t("common.delete");
    },
  },
];

export function MapCard({
  entry,
  onAction,
}: {
  entry: MapEntry;
  onAction: (action: string, entry: MapEntry) => void;
}) {
  const meta = [t("count.nodes", { n: entry.nodeCount })];
  if (entry.updatedAt) meta.push(timeAgo(entry.updatedAt));
  // Pin/unpin leads the kebab so a curated map can be kept at (or released from) the top of the lists.
  const kebabItems = [
    { key: "pin", label: entry.pinned ? t("start.unpin") : t("start.pinToTop") },
    ...KEBAB,
  ];
  return (
    <div className="st-card st-card-hover st-tile">
      <button
        type="button"
        className="st-thumb st-thumb-btn"
        onClick={() => onAction("open", entry)}
        title={t("common.openNamed", { name: entry.title })}
      >
        <MiniMap seed={entry.id} branches={entry.branches} root={entry.previewRoot} />
      </button>
      <div className="st-tile-body">
        <div className="st-row">
          <div className="st-card-title">
            {entry.pinned ? (
              <span aria-hidden="true" title={t("start.pinned")} style={{ marginRight: 5 }}>
                ★
              </span>
            ) : null}
            {entry.title || t("common.untitled")}
          </div>
          <details className="st-kebab">
            <summary aria-label={t("start.mapActions")}>⋯</summary>
            <div className="st-kebab-menu">
              {kebabItems.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    onAction(k.key, entry);
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </details>
        </div>
        <div className="st-card-meta">{meta.join(" · ")}</div>
      </div>
    </div>
  );
}
