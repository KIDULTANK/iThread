const { app, BrowserWindow, dialog, ipcMain, net, shell } = require("electron");
const { readFile, stat, writeFile } = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { createCliBridgeServer } = require("./cli-bridge.cjs");

const APP_ID = "com.ithread.desktop";
const APP_ORIGIN = "file://";
const RELEASES_URL = "https://github.com/KIDULTANK/iThread/releases";
const RELEASES_API = "https://api.github.com/repos/KIDULTANK/iThread/releases?per_page=20";
const SUPPORTED_EXTENSIONS = new Set([".ithread", ".mmst", ".itmz"]);
const MAX_OPEN_BYTES = 128 * 1024 * 1024;

app.setName("iThread");
app.setAppUserModelId(APP_ID);

let mainWindow = null;
let pendingOpenPath = null;
let cliBridgeServer = null;
const boundFiles = new Map();

function requestedFile(argv) {
  return argv.find((arg) => SUPPORTED_EXTENSIONS.has(path.extname(arg).toLowerCase())) ?? null;
}

function semver(value) {
  const match = String(value).match(/v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const a = semver(left);
  const b = semver(right);
  if (!a || !b) return 0;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

async function sendOpenFile(filePath) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingOpenPath = filePath;
    return;
  }
  try {
    const payload = await bindFile(filePath);
    if (!payload) return;
    mainWindow.webContents.send("ithread:open-file", payload);
  } catch {
    // A stale shortcut or missing file must not prevent the application from opening normally.
  }
}

async function bindFile(filePath) {
  try {
    const extension = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension) && ![".json", ".mmap", ".mmp"].includes(extension)) {
      return null;
    }
    const info = await stat(filePath);
    if (!info.isFile() || info.size > MAX_OPEN_BYTES) return null;
    const bytes = await readFile(filePath);
    const token = randomUUID();
    boundFiles.set(token, filePath);
    return {
      name: path.basename(filePath),
      bytes,
      token,
      lastModified: info.mtimeMs,
      writable: [".ithread", ".mmst", ".json"].includes(extension),
    };
  } catch {
    return null;
  }
}

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
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  mainWindow = window;

  window.once("ready-to-show", () => {
    window.show();
    window.focus();
  });
  window.webContents.once("did-finish-load", () => {
    if (!pendingOpenPath) return;
    const filePath = pendingOpenPath;
    pendingOpenPath = null;
    void sendOpenFile(filePath);
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
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

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  pendingOpenPath = requestedFile(process.argv.slice(1));
  app.on("second-instance", (_event, argv) => {
    const filePath = requestedFile(argv.slice(1));
    if (filePath) void sendOpenFile(filePath);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    void sendOpenFile(filePath);
  });

  app.whenReady().then(async () => {
    app.on("web-contents-created", (_event, contents) => {
      contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
      });
    });

    ipcMain.handle("ithread:check-for-updates", async () => {
      try {
        const response = await net.fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "iThread-Desktop" },
        });
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const releases = await response.json();
        if (!Array.isArray(releases)) throw new Error("Unexpected GitHub response");
        const available = releases
          .filter((release) => !release.draft && semver(release.tag_name))
          .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0];
        if (!available)
          return { status: "unavailable", currentVersion: app.getVersion(), url: RELEASES_URL };
        const currentVersion = app.getVersion();
        const latestVersion = String(available.tag_name).replace(/^v/i, "");
        return {
          status: compareVersions(latestVersion, currentVersion) > 0 ? "available" : "up-to-date",
          currentVersion,
          latestVersion,
          url: available.html_url || RELEASES_URL,
        };
      } catch {
        return { status: "unavailable", currentVersion: app.getVersion(), url: RELEASES_URL };
      }
    });
    ipcMain.handle("ithread:open-release-page", async (_event, url) => {
      const target = typeof url === "string" ? url : RELEASES_URL;
      const parsed = new URL(target);
      if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") return false;
      if (!parsed.pathname.startsWith("/KIDULTANK/iThread/releases")) return false;
      await shell.openExternal(parsed.toString());
      return true;
    });
    ipcMain.handle("ithread:open-file-dialog", async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [
          { name: "iThread maps", extensions: ["ithread", "mmst", "json"] },
          { name: "iThoughts maps", extensions: ["itmz"] },
          { name: "MindManager maps", extensions: ["mmap", "mmp"] },
        ],
      });
      return result.canceled || !result.filePaths[0] ? null : bindFile(result.filePaths[0]);
    });
    ipcMain.handle("ithread:save-file-dialog", async (_event, suggestedName, contents) => {
      if (typeof contents !== "string" || Buffer.byteLength(contents, "utf8") > MAX_OPEN_BYTES) {
        throw new Error("Invalid file contents");
      }
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: typeof suggestedName === "string" ? suggestedName : "map.ithread",
        filters: [{ name: "iThread map", extensions: ["ithread"] }],
      });
      if (result.canceled || !result.filePath) return null;
      const filePath = path.extname(result.filePath)
        ? result.filePath
        : `${result.filePath}.ithread`;
      await writeFile(filePath, contents, "utf8");
      return bindFile(filePath);
    });
    ipcMain.handle("ithread:read-bound-file", async (_event, token) => {
      const filePath = boundFiles.get(token);
      if (!filePath) throw new Error("This file is no longer bound to iThread");
      const info = await stat(filePath);
      if (!info.isFile() || info.size > MAX_OPEN_BYTES) throw new Error("File is too large");
      return {
        name: path.basename(filePath),
        bytes: await readFile(filePath),
        lastModified: info.mtimeMs,
      };
    });
    ipcMain.handle("ithread:write-bound-file", async (_event, token, contents) => {
      const filePath = boundFiles.get(token);
      if (
        !filePath ||
        ![".ithread", ".mmst", ".json"].includes(path.extname(filePath).toLowerCase())
      ) {
        throw new Error("This file is not writable from iThread");
      }
      if (typeof contents !== "string" || Buffer.byteLength(contents, "utf8") > MAX_OPEN_BYTES) {
        throw new Error("Invalid file contents");
      }
      await writeFile(filePath, contents, "utf8");
      return true;
    });
    try {
      cliBridgeServer = await createCliBridgeServer({
        userDataPath: app.getPath("userData"),
        version: app.getVersion(),
      });
    } catch {
      // CLI automation is optional. A loopback-port failure must never stop the editor opening.
      cliBridgeServer = null;
    }
    ipcMain.handle("ithread:cli-next-command", () => cliBridgeServer?.nextCommand() ?? null);
    ipcMain.handle("ithread:cli-post-result", (_event, id, payload) => {
      if (!cliBridgeServer) throw new Error("CLI bridge is unavailable");
      cliBridgeServer.completeCommand(id, payload);
      return true;
    });

    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
  app.on("before-quit", () => {
    cliBridgeServer?.close();
  });
}
