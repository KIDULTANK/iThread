import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Bounds = { x: number; y: number; width: number; height: number };
type State = { bounds: Bounds; maximized: boolean };
const require = createRequire(import.meta.url);
const { restoreWindowState } = require("../desktop/window-state.cjs") as {
  restoreWindowState(saved: unknown, areas: Bounds[], primary: Bounds): State;
};
const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const source = readFileSync(new URL("../desktop/window-state.cjs", import.meta.url), "utf8");

function persistence(content = "{}", size = content.length) {
  const exports = {
    exports: {} as {
      readWindowState(path: string): unknown;
      rememberWindowState(window: EventEmitter, path: string, restored: State): void;
    },
  };
  const fs = {
    readFileSync: vi.fn(() => content),
    statSync: vi.fn(() => ({ size })),
    writeFileSync: vi.fn(),
  };
  runInNewContext(source, { module: exports, require: () => fs });
  return { ...exports.exports, fs };
}

describe("desktop window restoration", () => {
  it("centers the default window within the work area, leaving the taskbar free", () => {
    expect(restoreWindowState(null, [primary], primary)).toEqual({
      bounds: { x: 240, y: 70, width: 1440, height: 900 },
      maximized: false,
    });
  });
  it("preserves the previous normal bounds and maximized state", () => {
    const state = { bounds: { x: 80, y: 100, width: 1200, height: 800 }, maximized: true };
    expect(restoreWindowState(state, [primary], primary)).toEqual(state);
  });
  it("keeps windows on a connected monitor with negative coordinates", () => {
    const secondary = { x: -1920, y: 0, width: 1920, height: 1080 };
    const state = { bounds: { x: -1800, y: 60, width: 1100, height: 800 }, maximized: false };
    expect(restoreWindowState(state, [primary, secondary], primary)).toEqual(state);
  });
  it("returns a window from a disconnected monitor to the primary screen", () => {
    const result = restoreWindowState(
      { bounds: { x: 4000, y: 100, width: 1200, height: 800 } },
      [primary],
      primary,
    );
    expect(result.bounds).toEqual({ x: 360, y: 120, width: 1200, height: 800 });
  });
  it("clamps an oversized or partially offscreen window to the remaining work area", () => {
    expect(
      restoreWindowState(
        { bounds: { x: 1800, y: -100, width: 3000, height: 2000 } },
        [primary],
        primary,
      ).bounds,
    ).toEqual(primary);
  });
  it("fits smaller screens instead of making the title bar unreachable", () => {
    const small = { x: 0, y: 0, width: 800, height: 600 };
    expect(restoreWindowState(null, [small], small).bounds).toEqual(small);
  });
  it.each([
    {},
    { bounds: { x: Number.NaN, y: 0, width: 1200, height: 800 } },
    { bounds: { x: 0, y: 0, width: -1, height: 0 } },
    { bounds: { x: "0", y: 0, width: 1200, height: 800 } },
  ])("tolerates invalid preferences: %j", (state) => {
    expect(restoreWindowState(state, [primary], primary).bounds.width).toBe(1440);
  });
});

describe("desktop window preference persistence", () => {
  it("loads a small valid preference record", () => {
    const { readWindowState } = persistence('{"maximized":true}');
    expect(readWindowState("synthetic.json")).toEqual({ maximized: true });
  });
  it("ignores corrupt, oversized or inaccessible preferences", () => {
    expect(persistence("not JSON").readWindowState("synthetic.json")).toBeNull();
    const large = persistence("{}", 9000);
    expect(large.readWindowState("synthetic.json")).toBeNull();
    expect(large.fs.readFileSync).not.toHaveBeenCalled();
    const missing = persistence();
    missing.fs.statSync.mockImplementation(() => {
      throw new Error("missing");
    });
    expect(missing.readWindowState("synthetic.json")).toBeNull();
  });
  it("writes only normal geometry and maximize state on close, never on every resize", () => {
    const { rememberWindowState, fs } = persistence();
    const bounds = { x: 20, y: 40, width: 1200, height: 800 };
    const window = Object.assign(new EventEmitter(), { getNormalBounds: () => bounds });
    rememberWindowState(window, "synthetic.json", { bounds, maximized: false });
    window.emit("maximize");
    window.emit("resize");
    window.emit("move");
    window.emit("minimize");
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    window.emit("close");
    expect(JSON.parse(fs.writeFileSync.mock.calls[0][1] as string)).toEqual({
      bounds,
      maximized: true,
    });
    window.emit("unmaximize");
    window.emit("close");
    expect(JSON.parse(fs.writeFileSync.mock.calls[1][1] as string).maximized).toBe(false);
  });
  it("does not block closing when preferences cannot be written", () => {
    const { rememberWindowState, fs } = persistence();
    const window = Object.assign(new EventEmitter(), { getNormalBounds: () => primary });
    fs.writeFileSync.mockImplementation(() => {
      throw new Error("read only");
    });
    rememberWindowState(window, "synthetic.json", { bounds: primary, maximized: false });
    expect(() => window.emit("close")).not.toThrow();
  });
});
