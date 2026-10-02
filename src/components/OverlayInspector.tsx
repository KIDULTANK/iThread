import type { CSSProperties } from "react";
import { t } from "../i18n";
import type { SelectedOverlay } from "../mindmap";
import { InspectorResizer } from "./InspectorResizer";
import { SWATCHES, fieldLabel, seg, segRow } from "./inspectorControls";

// OverlayInspector — the right panel shown when an overlay object (boundary box / summary bracket /
// callout bubble) is selected, in place of the node InfoPanel / EdgeInspector / MapPanel. Edits the
// overlay's label (boundary/summary) or text (callout) and deletes it, via the canvas's overlay
// mutators. Styled via .mm-inspector* + --ed-* tokens so it re-themes with the chrome.

function kindLabel(kind: SelectedOverlay["kind"]): string {
  return t(
    kind === "boundary"
      ? "panel.kind.boundary"
      : kind === "summary"
        ? "panel.kind.summary"
        : "panel.kind.callout",
  );
}

/** A one-line context describing what the overlay covers — mirrors the node inspector's breadcrumb so
 *  every inspector reads the same way (P5). caption is already "N topics" for boundary/summary. */
function overlayContext(kind: SelectedOverlay["kind"], caption: string): string {
  if (kind === "callout")
    return caption ? t("panel.calloutOn", { caption }) : t("panel.kind.callout");
  return t("panel.overlayAround", {
    kind: kindLabel(kind),
    caption: caption || t("count.topics", { n: 0 }),
  });
}

const controlStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--ed-border)",
  background: "var(--ed-card)",
  color: "var(--ed-ink)",
  borderRadius: 7,
  fontFamily: "inherit",
  fontSize: 13,
  padding: "4px 7px",
};

function shapeLabel(shape: "roundRect" | "rect" | "ellipse" | "cloud" | "polygon"): string {
  if (shape === "roundRect") return t("panel.rounded");
  if (shape === "ellipse") return t("toolbar.ellipse");
  return t(`panel.shape.${shape}`);
}

export function OverlayInspector({
  overlay,
  caption,
  onSetLabel,
  onSetColor,
  onSetShape,
  onSetDash,
  onDelete,
  onMinimize,
  width,
  onResize,
}: {
  overlay: SelectedOverlay;
  caption: string;
  onSetLabel: (label: string) => void;
  onSetColor: (color: string) => void;
  onSetShape?: (shape: NonNullable<SelectedOverlay["shape"]>) => void;
  onSetDash?: (dash: NonNullable<SelectedOverlay["dash"]>) => void;
  onDelete: () => void;
  onMinimize?: () => void;
  width?: number;
  onResize?: (next: number) => void;
}) {
  const isCallout = overlay.kind === "callout";
  const labelTitle = isCallout ? t("panel.text") : t("panel.label");
  const current = overlay.color?.toLowerCase();
  return (
    <aside
      className="mm-inspector"
      aria-label={t("panel.overlayInfo")}
      style={width ? { width } : undefined}
    >
      {width && onResize ? <InspectorResizer width={width} onResize={onResize} /> : null}
      <div
        className="mm-inspector-head"
        style={{ display: "flex", alignItems: "flex-start", gap: 8 }}
      >
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 11.5, color: "var(--ed-muted)", marginBottom: 5 }}>
            {kindLabel(overlay.kind)}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={caption}
          >
            {caption || kindLabel(overlay.kind)}
          </div>
          {/* Faint context line under the title, matching the node + edge inspectors (P5). */}
          <div className="mm-inspector-path" title={overlayContext(overlay.kind, caption)}>
            {overlayContext(overlay.kind, caption)}
          </div>
        </div>
        {onMinimize && (
          <button
            type="button"
            className="mm-inspector-min"
            title={t("panel.minimize")}
            aria-label={t("panel.minimizeOverlayInfo")}
            onClick={onMinimize}
          >
            ›
          </button>
        )}
      </div>
      <div className="mm-inspector-body">
        <div style={fieldLabel}>{labelTitle}</div>
        {isCallout ? (
          <textarea
            key={`${overlay.kind}:${overlay.id}`}
            defaultValue={overlay.label}
            rows={3}
            onBlur={(e) => {
              if (e.target.value !== overlay.label) onSetLabel(e.target.value);
            }}
            placeholder={t("panel.calloutText")}
            aria-label={t("panel.calloutText")}
            style={{ ...controlStyle, resize: "vertical" }}
          />
        ) : (
          <input
            key={`${overlay.kind}:${overlay.id}`}
            defaultValue={overlay.label}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => {
              if (e.target.value.trim() !== overlay.label) onSetLabel(e.target.value.trim());
            }}
            placeholder={
              overlay.kind === "boundary" ? t("panel.boundaryLabel") : t("panel.summaryLabel")
            }
            aria-label={t("panel.overlayKindLabel", { kind: kindLabel(overlay.kind) })}
            style={controlStyle}
          />
        )}

        {/* Colour — re-tints the whole object (stroke/fill/label); "" resets to the default accent. */}
        <div style={fieldLabel}>{t("panel.colour")}</div>
        <div style={segRow}>
          {SWATCHES.map((c) => {
            const active = current === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={t("common.colourNamed", { colour: c })}
                aria-pressed={active}
                onClick={() => onSetColor(c)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: c,
                  cursor: "pointer",
                  border: active ? "2px solid var(--ed-ink)" : "1px solid var(--ed-border)",
                  padding: 0,
                }}
              />
            );
          })}
          {/* Custom colour — apply an exact brand/accent hue beyond the preset swatches. */}
          <input
            type="color"
            value={current || "#888888"}
            onChange={(e) => onSetColor(e.target.value)}
            aria-label={t("panel.customColour")}
            title={t("panel.customColour")}
            style={{
              width: 24,
              height: 22,
              padding: 1,
              borderRadius: 6,
              border: "1px solid var(--ed-border)",
              background: "var(--ed-card)",
              cursor: "pointer",
            }}
          />
          <button
            type="button"
            title={t("panel.resetToTheDefaultColour")}
            aria-pressed={!current}
            onClick={() => onSetColor("")}
            style={{
              border: `1px solid ${!current ? "var(--ed-accent)" : "var(--ed-border)"}`,
              background: !current ? "var(--ed-accent-tint)" : "var(--ed-card)",
              color: !current ? "var(--ed-accent)" : "var(--ed-ink)",
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 600,
              padding: "3px 9px",
            }}
          >
            {t("panel.default")}
          </button>
        </div>

        {/* Boundary shape + outline (boundary kind only). */}
        {overlay.kind === "boundary" ? (
          <>
            <div style={fieldLabel}>{t("panel.shape")}</div>
            <div style={segRow}>
              {(["roundRect", "rect", "ellipse", "cloud", "polygon"] as const).map((s) => {
                const active = (overlay.shape ?? "roundRect") === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSetShape?.(s)}
                    style={seg(active)}
                  >
                    {shapeLabel(s)}
                  </button>
                );
              })}
            </div>
            <div style={fieldLabel}>{t("panel.outline")}</div>
            <div style={segRow}>
              {(["solid", "dashed", "dotted"] as const).map((d) => {
                const active = (overlay.dash ?? "solid") === d;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSetDash?.(d)}
                    style={seg(active)}
                  >
                    {t(`panel.${d}`)}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {overlay.deletable ? (
          <button
            type="button"
            onClick={onDelete}
            style={{
              marginTop: 16,
              width: "100%",
              border: "1px solid var(--ed-danger)",
              background: "transparent",
              color: "var(--ed-danger)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 0",
            }}
          >
            {t("panel.deleteKindLower", { kind: kindLabel(overlay.kind).toLowerCase() })}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
