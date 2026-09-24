import { useEffect, useRef, useState } from "react";
import { Button } from "../design/primitives";
import { type Locale, getLocale, setLocale, t } from "../i18n";
import type { Appearance } from "../useAppearance";
import type { ContrastPref } from "../useHighContrast";
import type { MotionPref } from "../useReducedMotion";
import { Dialog } from "./Dialog";

// Settings / Preferences — the one place to see and reset the bits of app state that otherwise live
// invisibly in ~a dozen localStorage keys + the IndexedDB library. Local-first means everything lives
// in this one origin's storage, so a "what's stored / clear it" surface is part of being trustworthy.
// Presentational: every action is a prop App wires to the real handler (theme, first-run flag, recents,
// branch clipboard, full wipe). The storage estimate is read here (best-effort) since it's read-only.

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** App chrome appearance — System / Light / Dark (independent of the canvas theme). */
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  /** Motion preference — System (follow the OS) / Reduced / Full. */
  motionPref: MotionPref;
  setMotionPref: (p: MotionPref) => void;
  /** High-contrast preference — System (follow the OS) / High / Normal. */
  contrastPref: ContrastPref;
  setContrastPref: (p: ContrastPref) => void;
  /** Re-show the first-run "3 things to try" card. */
  onReShowGettingStarted: () => void;
  /** Clear the ⌘K most-recently-used list. */
  onClearRecents: () => void;
  /** Clear the cross-map branch clipboard. */
  onClearBranchClipboard: () => void;
  /** Download the portable preferences as a .json file. */
  onExportSettings: () => void;
  /** Read a preferences .json and apply it (App confirms, reports, and reloads). */
  onImportSettings: (file: File) => void;
  /** Wipe the whole local library + preferences (App confirms + reloads). */
  onClearAllData: () => void;
}

const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      <div className="mm-map-section-title">{title}</div>
      {children}
    </div>
  );
}

export function applyLocaleChoice(locale: Locale, reload = () => window.location.reload()): void {
  setLocale(locale);
  reload();
}

export function SettingsDialog({
  open,
  onClose,
  appearance,
  setAppearance,
  motionPref,
  setMotionPref,
  contrastPref,
  setContrastPref,
  onReShowGettingStarted,
  onClearRecents,
  onClearBranchClipboard,
  onExportSettings,
  onImportSettings,
  onClearAllData,
}: SettingsDialogProps) {
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const settingsFileRef = useRef<HTMLInputElement>(null);

  // Read the local storage estimate when the dialog opens (best-effort — not in every browser/jsdom).
  useEffect(() => {
    if (!open) return;
    let live = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (live && typeof e.usage === "number" && typeof e.quota === "number")
          setStorage({ usage: e.usage, quota: e.quota });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("settings.title")}
      style={{
        width: "min(440px, 92vw)",
        padding: 20,
        color: "var(--ed-ink)",
        background: "var(--ed-card)",
        boxShadow: "var(--ed-shadow-pop)",
      }}
    >
      <Section title={t("settings.appearance")}>
        <label className="mm-map-field">
          <span>{t("settings.language")}</span>
          <select
            className="mm-map-control"
            value={getLocale()}
            onChange={(e) => applyLocaleChoice(e.target.value as Locale)}
            aria-label={t("settings.language")}
          >
            <option value="zh-CN">{t("settings.language.chinese")}</option>
            <option value="en">{t("settings.language.english")}</option>
          </select>
        </label>
        <label className="mm-map-field">
          <span>{t("settings.appTheme")}</span>
          <select
            className="mm-map-control"
            value={appearance}
            onChange={(e) => setAppearance(e.target.value as Appearance)}
            aria-label={t("settings.appTheme")}
          >
            <option value="system">{t("settings.toggle.system")}</option>
            <option value="light">{t("common.light")}</option>
            <option value="dark">{t("common.dark")}</option>
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ed-muted)" }}>
          {t("settings.appTheme.help")}
        </p>
        <label className="mm-map-field">
          <span>{t("settings.reduceMotion")}</span>
          <select
            className="mm-map-control"
            value={motionPref}
            onChange={(e) => setMotionPref(e.target.value as MotionPref)}
            aria-label={t("settings.reduceMotion")}
          >
            <option value="system">{t("settings.toggle.system")}</option>
            <option value="reduced">{t("settings.toggle.on")}</option>
            <option value="full">{t("settings.toggle.off")}</option>
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ed-muted)" }}>
          {t("settings.reduceMotion.help")}
        </p>
        <label className="mm-map-field">
          <span>{t("settings.highContrast")}</span>
          <select
            className="mm-map-control"
            value={contrastPref}
            onChange={(e) => setContrastPref(e.target.value as ContrastPref)}
            aria-label={t("settings.highContrast")}
          >
            <option value="system">{t("settings.toggle.system")}</option>
            <option value="high">{t("settings.toggle.on")}</option>
            <option value="normal">{t("settings.toggle.off")}</option>
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ed-muted)" }}>
          {t("settings.highContrast.help")}
        </p>
      </Section>

      <Section title={t("settings.gettingStarted")}>
        <Button onClick={onReShowGettingStarted} style={{ alignSelf: "flex-start" }}>
          {t("settings.gettingStarted.action")}
        </Button>
      </Section>

      <Section title={t("settings.prefsFile")}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ed-muted)", lineHeight: 1.5 }}>
          {t("settings.prefsFile.body")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Button onClick={onExportSettings}>{t("settings.prefsFile.export")}</Button>
          <Button onClick={() => settingsFileRef.current?.click()}>
            {t("settings.prefsFile.import")}
          </Button>
          <input
            ref={settingsFileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // let the same file be picked again after a failed import
              if (f) onImportSettings(f);
            }}
            style={{ display: "none" }}
          />
        </div>
      </Section>

      <Section title={t("settings.localData")}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ed-muted)", lineHeight: 1.5 }}>
          {t("settings.localData.body")}
          {storage
            ? t("settings.localData.usage", {
                used: fmtBytes(storage.usage),
                quota: fmtBytes(storage.quota),
              })
            : ""}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Button onClick={onClearRecents}>{t("settings.localData.clearRecents")}</Button>
          <Button onClick={onClearBranchClipboard}>
            {t("settings.localData.clearBranchClipboard")}
          </Button>
        </div>
        <Button
          onClick={onClearAllData}
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            color: "var(--ed-danger)",
            border: "1px solid var(--ed-danger)",
          }}
        >
          {t("settings.localData.clearAll")}
        </Button>
      </Section>
    </Dialog>
  );
}
