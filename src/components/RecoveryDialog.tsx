import { Button } from "../design/primitives";
import { space, typeScale } from "../design/tokens";
import { t } from "../i18n";
import { timeAgo } from "../ui";
import { Dialog } from "./Dialog";

export interface RecoveryDialogProps {
  open: boolean;
  mapTitle: string;
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

/**
 * Offers an abnormal-exit checkpoint without replacing the stable library copy. The user can compare
 * the timestamp and explicitly restore or discard it; dismissing the dialog keeps the checkpoint for
 * a later restart instead of making an irreversible choice on Escape/backdrop click.
 */
export function RecoveryDialog({
  open,
  mapTitle,
  savedAt,
  onRestore,
  onDiscard,
  onClose,
}: RecoveryDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("recovery.title")}
      style={{ width: "min(470px, 92vw)", padding: 22 }}
    >
      <p style={{ ...typeScale.body, margin: 0, color: "var(--ed-ink)" }}>
        {t("recovery.body", { name: mapTitle || t("common.untitled") })}
      </p>
      <p style={{ ...typeScale.label, margin: `${space.lg}px 0 0`, color: "var(--ed-muted)" }}>
        {t("recovery.savedAt", { time: timeAgo(savedAt) })}
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: space.md,
          flexWrap: "wrap",
          marginTop: space.xxl,
        }}
      >
        <Button onClick={onDiscard}>{t("recovery.keepSaved")}</Button>
        <Button
          onClick={onRestore}
          style={{
            background: "var(--ed-accent)",
            borderColor: "var(--ed-accent)",
            color: "#fff",
          }}
        >
          {t("recovery.restore")}
        </Button>
      </div>
    </Dialog>
  );
}
