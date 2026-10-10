import { type Catalogue, registerMessages } from "../i18n/registry";

// Settings-only strings load with the dialog, not on the first-paint path.
export const SETTINGS_EN = {
  "settings.intro":
    "Preferences apply across your library. Changes are saved automatically; switching language reloads the interface.",
  "settings.interaction": "Keyboard & canvas",
  "settings.altHelp": "Hold Alt for shortcuts",
  "settings.altDelay": "Alt hold delay",
  "settings.delay.fast": "Quick · 350 ms",
  "settings.delay.normal": "Standard · 550 ms",
  "settings.delay.slow": "Long · 800 ms",
  "settings.wheelMode": "Mouse wheel",
  "settings.wheel.pan": "Pan canvas",
  "settings.wheel.zoom": "Zoom canvas",
  "settings.panSpeed": "Scroll pan speed",
  "settings.speed.slow": "Gentle",
  "settings.speed.normal": "Standard",
  "settings.speed.fast": "Fast",
  "settings.interaction.help":
    "These controls take effect immediately. In pan mode, Ctrl + wheel zooms. While the shortcut sheet is visible, arrow keys only turn pages.",
  "settings.interaction.reset": "Reset keyboard & canvas defaults",
  "settings.appearance": "Appearance",
  "settings.appTheme": "App theme",
  "settings.reduceMotion": "Reduce motion",
  "settings.highContrast": "High contrast",
  "settings.toggle.system": "System",
  "settings.toggle.on": "On",
  "settings.toggle.off": "Off",
  "settings.gettingStarted.action": "Show the getting-started tips again",
  "settings.prefsFile": "Preferences file",
  "settings.prefsFile.export": "Export preferences…",
  "settings.prefsFile.import": "Import preferences…",
  "settings.localData": "Local data",
  "settings.localData.clearRecents": "Clear command history",
  "settings.localData.clearBranchClipboard": "Clear branch clipboard",
  "settings.localData.clearAll": "Clear all local data…",
  "settings.language": "Language",
  "settings.language.chinese": "简体中文",
  "settings.language.english": "English",
  "settings.appTheme.help":
    "App theme colours the chrome (toolbar, panels, dialogs). The canvas theme (which colours the topics) lives in the Map panel, alongside layout and the rest of the map's look — a dark canvas always darkens the chrome too.",
  "settings.reduceMotion.help":
    "Reduce motion makes canvas zoom/fit and the guided walk instant, and drops chrome transitions. System follows your device's reduced-motion setting.",
  "settings.highContrast.help":
    "High contrast strengthens chrome borders, dividers and text, and adds bolder focus rings. System follows your device's contrast / forced-colors setting.",
  "settings.localData.body":
    "Everything — your maps, version history and preferences — is stored only in this browser.",
  "settings.localData.usage": " About {used} used of {quota} available.",
} as const satisfies Catalogue;

registerMessages("en", SETTINGS_EN);
