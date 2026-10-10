import { type ChangeEvent, useRef } from "react";
import { t } from "../i18n";
import { EditorIcon } from "./EditorIcons";

// IconRail — the 56px left rail of the redesigned editor. Brand mark returns to the Start screen;
// the utility buttons are wired to real actions only (no decorative tool-mode buttons that would do
// nothing — the canvas's select/pan are React Flow built-ins). Styled via .mm-rail* in editor.css.

export interface IconRailProps {
  onHome: () => void;
  onImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onPaste: () => void;
  onShortcuts: () => void;
  onSettings: () => void;
  /** Re-show the first-run "getting started" tips (also in Settings + ⌘K). */
  onGettingStarted: () => void;
  /** Open the ⌘K command palette — a visible trigger so it's reachable without the hotkey (item 19,
   *  matters most on touch, where there's no keyboard). */
  onCommandPalette: () => void;
}

function RailBtn({
  icon,
  label,
  onClick,
}: {
  icon: Parameters<typeof EditorIcon>[0]["name"];
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mm-rail-btn"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <EditorIcon name={icon} size={19} />
    </button>
  );
}

export function IconRail({
  onHome,
  onImage,
  onPaste,
  onShortcuts,
  onSettings,
  onGettingStarted,
  onCommandPalette,
}: IconRailProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="mm-rail">
      <button
        type="button"
        className="mm-rail-btn"
        title={t("panel.backToStartNewMaps")}
        aria-label={t("panel.backToStart")}
        onClick={onHome}
        style={{ width: 40, height: 40, marginBottom: 4 }}
      >
        <EditorIcon name="home" size={20} />
      </button>
      <span className="mm-rail-sep" />
      {/* A real <button> (not a <label> wrapping a hidden input, which isn't keyboard-operable) that
          opens the hidden file picker — so the image control is reachable + activatable by keyboard
          (Enter/Space, native to a button) like every other rail action (a11y SC 2.1.1). */}
      <button
        type="button"
        className="mm-rail-btn"
        title={t("panel.insertImageOnTheSelected")}
        aria-label={t("panel.insertImage")}
        onClick={() => imageInputRef.current?.click()}
      >
        <EditorIcon name="image" size={19} />
      </button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={onImage}
        style={{ display: "none" }}
      />
      <RailBtn icon="paste" label={t("cmd.paste-topics")} onClick={onPaste} />
      <RailBtn icon="search" label={t("panel.commandPaletteCtrlK")} onClick={onCommandPalette} />
      <div className="mm-rail-spacer">
        <RailBtn icon="star" label={t("panel.gettingStartedTips")} onClick={onGettingStarted} />
        <RailBtn icon="settings" label={t("settings.title")} onClick={onSettings} />
        <RailBtn icon="help" label={t("cmd.shortcuts")} onClick={onShortcuts} />
      </div>
    </aside>
  );
}
