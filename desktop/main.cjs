const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const APP_ID = "com.ithread.desktop";
const APP_ORIGIN = "file://";

app.setName("iThread");
app.setAppUserModelId(APP_ID);

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "iThread",
    backgroundColor: "#faf9f5",
    icon: path.join(__dirname, "..", "public", "apple-touch-icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    window.focus();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_ORIGIN)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(APP_ORIGIN)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  app.on("web-contents-created", (_event, contents) => {
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
