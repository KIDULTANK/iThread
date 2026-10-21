import { type Catalogue, registerMessages } from "../i18n/registry";

// Settings-only strings load with the dialog, not on the first-paint path.
export const SETTINGS_EN = {
  "android.exportFailed": "Export failed; your local map is still saved. {error}",
  "sync.historyHelp":
    "Nutstore uses immutable history revisions in the Windows desktop app. Each edit adds cloud storage use. The web app requires a server that permits browser cross-origin access.",
  "sync.desktopRequired":
    "Nutstore sync requires a supported iThread Windows or Android client; this browser or older build cannot connect directly.",
  "sync.androidProvider":
    "The Android preview currently supports only a dedicated Nutstore WebDAV directory.",
  "sync.legacyFormat":
    "This map has a legacy sync file. Use a separate test directory; automatic protocol migration is not supported.",
  "sync.historyLimit":
    "This map reached the experimental history limit (256 revisions / 128 MiB). Sync stopped without removing history. Export a backup before choosing a new directory.",
  "sync.title": "Device sync · experimental",
  "sync.intro":
    "Optional, manual WebDAV sync. No iThread account is needed. Use a dedicated existing directory; real-server compatibility must still be tested. Browser servers must permit CORS.",
  "sync.endpoint": "WebDAV directory URL",
  "sync.configure": "Save directory",
  "sync.username": "WebDAV username",
  "sync.password": "WebDAV password",
  "sync.credentialsHelp":
    "Credentials stay in memory for this settings session. They are not saved or included in exports. Changing the directory clears them.",
  "sync.discover": "Find remote maps",
  "sync.run": "Sync selected maps",
  "sync.selectionHelp":
    "Only checked maps participate. Nothing uploads automatically. Unchecking does not delete data. Keep the same directory on each device.",
  "sync.active": " · editing: deferred",
  "sync.report": "Checked {done}; conflicts {conflicts}; deferred/retry {pending}.",
  "sync.running": "Syncing…",
  "sync.configured": "Directory saved locally. No network request was made.",
  "sync.discovered": "Remote list loaded. Select maps before syncing.",
  "sync.error":
    "Operation failed. Check URL, credentials, CORS and strong ETag support. Local content is kept; successful earlier transfers may already be stored.",
  "sync.conflicts": "Preserved conflicts",
  "sync.conflictsHelp":
    "Both copies are kept for manual review. Sync will not choose a winner automatically.",
  "sync.downloadConflict": "Download both copies (JSON)",
  "settings.intro":
    "General preferences apply across your library and save automatically. Sync requires explicit action. Switching language reloads the interface.",
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
    "Your library, version history and preferences are stored locally. Optional manual sync transfers selected maps to your chosen service.",
  "settings.localData.usage": " About {used} used of {quota} available.",
} as const satisfies Catalogue;

registerMessages("en", SETTINGS_EN);
