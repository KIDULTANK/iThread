// The tap-out scrim shown behind a mobile bottom sheet (left panels / inspector). Tapping it dismisses
// the sheet. Tiny + presentational so the (otherwise mobile-only) render is unit-testable; the
// styling + show/hide-on-desktop live in mobile.css (.mm-sheet-scrim).
export function MobileSheetScrim({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="mm-sheet-scrim"
      aria-label={t("panel.closePanel")}
      onClick={onClose}
    />
  );
}
import { t } from "../i18n";
