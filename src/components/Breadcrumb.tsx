import { t } from "../i18n";
import { controlStyle } from "../ui";

/** A node on the path from the root to the selected topic. */
export interface Crumb {
  id: string;
  topic: string;
}

/** A thin location bar above the canvas showing the selected topic's path (Root › Branch › …), each
 *  crumb clickable to centre that ancestor — MindManager's breadcrumb. Rendered only when something
 *  deeper than the root is selected (the caller gates on `crumbs.length > 1`). */
export function Breadcrumb({ crumbs, onPick }: { crumbs: Crumb[]; onPick: (id: string) => void }) {
  return (
    <nav
      aria-label={t("breadcrumb.topicPath")}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        padding: "3px 12px",
        background: "var(--ed-card)",
        borderBottom: "1px solid var(--ed-border)",
        fontSize: 12,
        color: "var(--ed-ink2)",
      }}
    >
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            {i > 0 && <span style={{ opacity: 0.5 }}>›</span>}
            <button
              type="button"
              onClick={() => onPick(c.id)}
              title={
                last
                  ? c.topic || t("common.untitled")
                  : t("breadcrumb.goTo", { topic: c.topic || t("common.untitled") })
              }
              aria-current={last ? "true" : undefined}
              style={{
                ...controlStyle,
                border: "none",
                background: "transparent",
                padding: "1px 4px",
                fontSize: 12,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: last ? 700 : 400,
                color: last ? "var(--ed-ink)" : "var(--ed-ink2)",
                cursor: "pointer",
              }}
            >
              {c.topic || "(untitled)"}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
