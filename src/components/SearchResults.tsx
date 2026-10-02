/** One row of a search-result list. `payload` is handed back verbatim to `onPick` so the caller acts
 *  on its own object (a LibraryHit, a node id, …) without re-deriving it from the row. `mapTitle` is
 *  shown ("— Roadmap") only when present — the across-maps search sets it; in-map Find omits it. */
export interface ResultRow<T> {
  /** Stable list key, also matched against `activeKey` for the current-row highlight. */
  key: string;
  topic: string;
  /** Ancestor breadcrumb, joined with " › " when non-empty. */
  path: string[];
  snippet?: string;
  mapTitle?: string;
  payload: T;
}

// A clickable result list shared by "Search across every map" and the in-map Find "all matches" view.
// Each row shows the topic, optional map, the ancestor breadcrumb (so a bare topic like "Tasks" is
// placeable), and — when the match is in the note — a context snippet. Capped at 50 rows with an
// overflow hint. Presentational + pure (the matching + state live in the caller), so it's unit-testable.
export function SearchResults<T>({
  rows,
  onPick,
  activeKey,
}: {
  rows: ResultRow<T>[];
  onPick: (payload: T) => void;
  activeKey?: string | null;
}) {
  if (rows.length === 0)
    return (
      <p style={{ color: "var(--ed-muted)", fontSize: 13, margin: "12px 2px 0" }}>
        {t("app.noMatches2")}
      </p>
    );
  const faint = (fontSize: number) => ({
    display: "block" as const,
    color: "var(--ed-faint)",
    fontSize,
    marginTop: 1,
  });
  return (
    <ul
      style={{
        listStyle: "none",
        margin: "10px 0 0",
        padding: 0,
        maxHeight: 320,
        overflow: "auto",
      }}
    >
      {rows.slice(0, 50).map((r) => (
        <li key={r.key}>
          <button
            type="button"
            aria-current={r.key === activeKey ? "true" : undefined}
            onClick={() => onPick(r.payload)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "none",
              borderRadius: 6,
              background:
                r.key === activeKey ? "var(--ed-hover, rgba(127,127,127,0.16))" : "transparent",
              padding: "6px 8px",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <span>{r.topic}</span>
            {r.mapTitle && (
              <>
                {" "}
                <span style={{ color: "var(--ed-faint)", fontSize: 12 }}>— {r.mapTitle}</span>
              </>
            )}
            {r.path.length > 0 && <span style={faint(11)}>{r.path.join(" › ")}</span>}
            {r.snippet && (
              <span style={{ ...faint(12), color: "var(--ed-muted)" }}>{r.snippet}</span>
            )}
          </button>
        </li>
      ))}
      {rows.length > 50 && (
        <li style={{ color: "var(--ed-faint)", fontSize: 12, padding: "6px 8px" }}>
          {t("search.moreResults", { n: rows.length - 50 })}
        </li>
      )}
    </ul>
  );
}
import { t } from "../i18n";
