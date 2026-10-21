// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../android/bootstrap.js", import.meta.url), "utf8");
function boot(native = true) {
  const requests: { id: string; method: string; input: unknown }[] = [];
  const listener = vi.fn();
  const document = {
    documentElement: { dataset: {} },
    visibilityState: "visible",
    addEventListener: listener,
  };
  const bridge = {
    postMessage: vi.fn((raw: string) => requests.push(JSON.parse(raw))),
    onmessage: (_: { data: string }) => {},
  };
  const window: Record<string, unknown> = native ? { IThreadNative: bridge } : {};
  runInNewContext(source, { window, document, crypto, setTimeout, clearTimeout });
  const api = window.iThreadAndroid as NonNullable<Window["iThreadAndroid"]>;
  return { window, document, bridge, api, requests, listener };
}
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Android origin-restricted bootstrap client", () => {
  it("does not expose a bridge outside the native application", () => {
    const result = boot(false);
    expect(result.window.iThreadAndroid).toBeUndefined();
    expect(result.document.documentElement.dataset).toEqual({});
  });
  it("correlates replies and sends sync requests through the native channel", async () => {
    const result = boot();
    const pending = result.api.syncConnect?.({
      endpoint: "https://dav.jianguoyun.com/dav/test/",
      username: "synthetic",
      password: "synthetic",
    });
    expect(result.requests[0].method).toBe("syncConnect");
    result.bridge.onmessage({ data: "malformed" });
    result.bridge.onmessage({ data: JSON.stringify({ id: "other", value: "ignored" }) });
    result.bridge.onmessage({
      data: JSON.stringify({ id: result.requests[0].id, value: "session" }),
    });
    await expect(pending).resolves.toBe("session");
    expect(Object.isFrozen(result.api)).toBe(true);
    expect(result.document.documentElement.dataset).toEqual({ platform: "android" });
  });
  it("propagates native failures without assuming an export succeeded", async () => {
    const result = boot();
    const pending = result.api.saveFile({
      filename: "test.ithread",
      mime: "application/json",
      base64: "e30=",
    });
    const check = expect(pending).rejects.toThrow("native failure");
    result.bridge.onmessage({
      data: JSON.stringify({ id: result.requests[0].id, error: "native failure" }),
    });
    await check;
  });
  it("caps outstanding operations and times out missing responses", async () => {
    vi.useFakeTimers();
    const result = boot();
    const pending = Array.from({ length: 8 }, () => result.api.syncDisconnect?.("synthetic"));
    const settled = Promise.allSettled(pending);
    await expect(result.api.syncDisconnect?.("synthetic")).rejects.toThrow("busy");
    vi.advanceTimersByTime(45000);
    expect((await settled).every((p) => p.status === "rejected")).toBe(true);
  });
  it("requests native session disposal when the app becomes hidden", () => {
    vi.useFakeTimers();
    const result = boot();
    result.document.visibilityState = "hidden";
    result.listener.mock.calls[0][1]();
    expect(result.requests[0].method).toBe("syncCloseAll");
  });
});
