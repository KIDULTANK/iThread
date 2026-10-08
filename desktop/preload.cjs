const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Set();
const pendingFiles = [];

ipcRenderer.on("ithread:open-file", (_event, payload) => {
  if (listeners.size === 0) pendingFiles.push(payload);
  else for (const listener of listeners) listener(payload);
});

contextBridge.exposeInMainWorld("iThreadDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("ithread:check-for-updates"),
  openReleasePage: (url) => ipcRenderer.invoke("ithread:open-release-page", url),
  openFileDialog: () => ipcRenderer.invoke("ithread:open-file-dialog"),
  saveFileDialog: (suggestedName, contents) =>
    ipcRenderer.invoke("ithread:save-file-dialog", suggestedName, contents),
  readBoundFile: (token) => ipcRenderer.invoke("ithread:read-bound-file", token),
  writeBoundFile: (token, contents) =>
    ipcRenderer.invoke("ithread:write-bound-file", token, contents),
  cliNextCommand: () => ipcRenderer.invoke("ithread:cli-next-command"),
  cliPostResult: (id, payload) => ipcRenderer.invoke("ithread:cli-post-result", id, payload),
  onOpenFile: (listener) => {
    listeners.add(listener);
    for (const payload of pendingFiles.splice(0)) listener(payload);
    return () => listeners.delete(listener);
  },
});
