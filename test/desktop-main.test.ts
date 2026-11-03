import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const desktopDir = fileURLToPath(new URL("../desktop/", import.meta.url));
const source = readFileSync(join(desktopDir, "main.cjs"), "utf8");
type Handler = (...args: unknown[]) => Promise<unknown>;

async function shellHarness() {
  const handlers = new Map<string, Handler>();
  const app = Object.assign(new EventEmitter(), {
    setName: vi.fn(),
    setAppUserModelId: vi.fn(),
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    getVersion: () => "0.7.0",
    getPreferredSystemLanguages: () => ["zh-CN"],
    getPath: () => join(dirname(desktopDir), "synthetic-profile"),
    quit: vi.fn(),
  });
  const windows: FakeWindow[] = [];
  class FakeWindow extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), {
      id: 1,
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
    });
    constructor(public options: Record<string, unknown>) {
      super();
      windows.push(this);
    }
    loadFile = vi.fn(async () => {});
    show = vi.fn();
    focus = vi.fn();
    maximize = vi.fn();
    isDestroyed = () => false;
    static getAllWindows() {
      return windows;
    }
  }
  const dialog = {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn(),
  };
  const fs = {
    stat: vi.fn().mockResolvedValue({ isFile: () => true, size: 4, mtimeMs: 100 }),
    readFile: vi.fn().mockResolvedValue(Buffer.from("data")),
    writeFile: vi.fn(),
  };
  const net = { fetch: vi.fn() };
  const rememberWindowState = vi.fn();
  const electron = {
    app,
    BrowserWindow: FakeWindow,
    dialog,
    net,
    shell: { openExternal: vi.fn() },
    ipcMain: { handle: (name: string, handler: Handler) => handlers.set(name, handler) },
    screen: {
      getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }],
      getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
    },
  };
  runInNewContext(source, {
    __dirname: desktopDir,
    process: { argv: ["iThread.exe"] },
    Buffer,
    URL,
    AbortSignal,
    require: (id: string) => {
      if (id === "electron") return electron;
      if (id === "node:fs/promises") return fs;
      if (id === "./cli-bridge.cjs") return { createCliBridgeServer: async () => null };
      if (id === "./sync-transport.cjs")
        return { createSyncTransport: () => ({ closeOwner: vi.fn(), dispose: vi.fn() }) };
      if (id === "./sync-ipc.cjs") return { registerSyncIpc: vi.fn() };
      if (id === "./window-state.cjs")
        return {
          ...require(join(desktopDir, "window-state.cjs")),
          readWindowState: () => ({
            bounds: { x: 50, y: 60, width: 1200, height: 800 },
            maximized: true,
          }),
          rememberWindowState,
        };
      return require(id.startsWith("./") ? join(desktopDir, id) : id);
    },
  });
  await vi.waitFor(() => expect(windows).toHaveLength(1));
  const invoke = (name: string, ...args: unknown[]) => {
    const handler = handlers.get(`ithread:${name}`);
    if (!handler) throw new Error(`Missing handler ${name}`);
    return handler({}, ...args);
  };
  return { windows, invoke, dialog, fs, net, rememberWindowState };
}

describe("Windows main-process wiring", () => {
  it("applies saved geometry/maximize state and retains renderer isolation", async () => {
    const { windows, rememberWindowState } = await shellHarness();
    expect(windows[0].options).toMatchObject({
      x: 50,
      y: 60,
      width: 1200,
      height: 800,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    expect(windows[0].maximize).toHaveBeenCalledOnce();
    expect(rememberWindowState).toHaveBeenCalledOnce();
  });
  it.each(["法学.itmz", "计划.md", "计划.MARKDOWN"])(
    "the native picker returns %s read-only with opaque tokens",
    async (name) => {
      const { invoke, dialog, fs } = await shellHarness();
      dialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: [join(desktopDir, name)],
      });
      const payload = (await invoke("open-file-dialog")) as DesktopOpenFilePayload;
      expect(payload.name).toBe(name);
      expect(payload.writable).toBe(false);
      expect(payload.token).toEqual(expect.any(String));
      expect(payload).not.toHaveProperty("path");
      await expect(invoke("write-bound-file", payload.token, "overwrite")).rejects.toThrow(
        "not writable",
      );
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(dialog.showOpenDialog.mock.calls[0][1].filters[0].extensions).toContain("md");
    },
  );
  it("retains native writable file bindings", async () => {
    const { invoke, dialog, fs } = await shellHarness();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(desktopDir, "test.ithread")],
    });
    const payload = (await invoke("open-file-dialog")) as DesktopOpenFilePayload;
    expect(payload.writable).toBe(true);
    await invoke("write-bound-file", payload.token, "saved");
    expect(fs.writeFile).toHaveBeenCalledWith(join(desktopDir, "test.ithread"), "saved", "utf8");
  });
  it("applies the desktop-only update policy to real IPC responses with a network timeout", async () => {
    const { invoke, net } = await shellHarness();
    net.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: "v99.0.0-android-dev.3", assets: [{ name: "app.apk" }] }],
    });
    expect(await invoke("check-for-updates")).toMatchObject({ status: "unavailable" });
    expect(net.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    net.fetch.mockRejectedValue(new Error("offline"));
    expect(await invoke("check-for-updates")).toMatchObject({ status: "unavailable" });
  });
  it("treats picker cancellation as a no-op", async () => {
    const { invoke, fs } = await shellHarness();
    expect(await invoke("open-file-dialog")).toBeNull();
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});
