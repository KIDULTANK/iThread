export const PWA_EN = {
  "hint.updateAvailable": "A new version is available.",
  "hint.refreshNow": "Refresh now",
  "hint.offlineReady": "Ready to use offline.",
  "hint.upToDate": "You're on the latest version.",
  "hint.updateDownloading":
    "New version found — the refresh prompt will appear once it finishes downloading.",
  "hint.updateUnavailable": "Update checks aren't available here (no service worker running).",
  "hint.desktopUpdateAvailable": "iThread {version} is available.",
  "hint.openDownloadPage": "Open download page",
  "hint.desktopUpdateUnavailable": "Couldn't check GitHub Releases. Try again when you're online.",
} as const;

export type PwaKey = keyof typeof PWA_EN;
