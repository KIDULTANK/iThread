import { t } from "../i18n";
import { EditorIcon } from "./EditorIcons";

// The minimized Topic-info inspector: a thin strip on the right edge that re-expands the panel.
// Mirrors the left IconRail's button styling (.mm-rail-btn) for a symmetric left-rail / right-rail
// feel. Shown when the inspector is collapsed (panels.infoMinimized); styled via .mm-inspector-rail.
export function InspectorRail({ onExpand }: { onExpand: () => void }) {
  return (
    <aside className="mm-inspector-rail" aria-label={t("panel.topicInfoMinimized")}>
      <button
        type="button"
        className="mm-rail-btn"
        title={t("panel.showTopicInfo")}
        aria-label={t("panel.showTopicInfo")}
        onClick={onExpand}
      >
        <EditorIcon name="note" size={19} />
      </button>
    </aside>
  );
}
