import { t } from "../../i18n/registry";
import "./messages";
import type { MindMapDoc } from "../../model/types";
import { MiniMap } from "./MiniMap";
import { branchLabels, branchSpokes, docNodeCount } from "./nodeStats";

// A template card: thumbnail + name + COMPUTED node count + branch-preview pills (the first 3 root
// children + "+N"). Everything is derived from the real `build()`-ed doc, so adding a template to
// templates.ts surfaces a correct card with zero extra work.

export function TemplateCard({
  name,
  description,
  doc,
  seed,
  onOpen,
}: {
  name: string;
  /** One-line use-case shown under the node count (O6). */
  description?: string;
  doc: MindMapDoc;
  seed: string;
  onOpen: () => void;
}) {
  const count = docNodeCount(doc);
  const branches = branchLabels(doc);
  const shown = branches.slice(0, 3);
  const extra = branches.length - shown.length;
  return (
    <button
      type="button"
      className="st-card st-card-hover st-tile"
      onClick={onOpen}
      title={t("common.openNamed", { name })}
    >
      <div className="st-thumb">
        <MiniMap seed={seed} branches={branchSpokes(doc)} root={doc.root} />
      </div>
      <div className="st-tile-body">
        <div className="st-card-title">{name}</div>
        <div className="st-card-meta">{t("count.nodes", { n: count })}</div>
        {description ? <div className="st-card-desc">{description}</div> : null}
        <div className="st-pills">
          {shown.map((b) => (
            <span key={b} className="st-tag">
              {b}
            </span>
          ))}
          {extra > 0 ? <span className="st-tag">+{extra}</span> : null}
        </div>
      </div>
    </button>
  );
}
