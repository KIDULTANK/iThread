import type { CSSProperties } from "react";
import { t } from "../i18n";
import { useInstallPrompt } from "../pwa/useInstallPrompt";

// A self-gating install affordance (O2): renders the in-app "Install iThread" button when the
// browser has offered installation, an "Add to Home Screen" hint on iOS Safari, or nothing at all
// (already installed / dismissed / unsupported). Self-styled (inline) so it works in both the Start
// screen (--st-* theme) and the editor About dialog (--ed-* theme) without a shared stylesheet.

const ACCENT = "#1b8a5e";

const wrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  lineHeight: 1.4,
};
const btn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  borderRadius: 8,
  background: ACCENT,
  color: "#fff",
  fontWeight: 600,
  padding: "7px 12px",
  cursor: "pointer",
};
const dismiss: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "currentColor",
  opacity: 0.6,
  fontSize: 17,
  lineHeight: 1,
  cursor: "pointer",
  borderRadius: 6,
  padding: "2px 6px",
};

export function InstallButton({ className }: { className?: string }) {
  const state = useInstallPrompt();
  if (state.kind === "none") return null;

  if (state.kind === "ios-hint") {
    return (
      <div className={className} style={wrap} role="note">
        <span>{t("install.iosHint")}</span>
        <button
          type="button"
          style={dismiss}
          aria-label={t("install.dismissHint")}
          onClick={state.dismiss}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className={className} style={wrap}>
      <button type="button" style={btn} onClick={() => void state.promptInstall()}>
        ⤓ {t("install.action")}
      </button>
      <button
        type="button"
        style={dismiss}
        aria-label={t("install.dismissPrompt")}
        onClick={state.dismiss}
      >
        ×
      </button>
    </div>
  );
}
