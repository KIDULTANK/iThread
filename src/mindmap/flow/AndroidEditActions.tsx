import { createPortal } from "react-dom";
import { t } from "../../i18n/registry";

/** Outside the transformed/virtualized canvas, so the controls stay finger-sized above the IME. */
export function AndroidEditActions({
  composing,
  onDone,
  onCancel,
}: {
  composing: boolean;
  onDone(): void;
  onCancel(): void;
}) {
  return createPortal(
    <div
      className="mm-android-edit-actions"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        disabled={composing}
        onClick={(event) => {
          event.stopPropagation();
          onCancel();
        }}
      >
        {t("common.cancel")}
      </button>
      <button
        type="button"
        className="mm-android-edit-done"
        disabled={composing}
        onClick={(event) => {
          event.stopPropagation();
          onDone();
        }}
      >
        {t("panel.done")}
      </button>
    </div>,
    document.body,
  );
}
