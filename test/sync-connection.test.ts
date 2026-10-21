// @vitest-environment jsdom
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectSyncRepository } from "../src/sync/connection";

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "iThreadDesktop", { configurable: true, value: undefined });
  Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: undefined });
});
describe("sync connection selection", () => {
  it("uses the Android native bridge with the Windows-compatible immutable history protocol", async () => {
    const bridge = {
      syncConnect: vi.fn(async () => "android-session"),
      syncRequest: vi.fn(async () => ({
        status: 207,
        headers: {},
        body: '<d:multistatus xmlns:d="DAV:"/>',
      })),
      syncDisconnect: vi.fn(async () => true),
    };
    Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: bridge });
    const connection = await connectSyncRepository(
      "https://dav.jianguoyun.com/dav/test/",
      "synthetic",
      "synthetic",
    );
    expect(await connection.repository.list()).toEqual([]);
    expect(bridge.syncRequest).toHaveBeenCalledWith(
      "android-session",
      expect.objectContaining({ method: "PROPFIND" }),
    );
    await connection.close();
    expect(bridge.syncDisconnect).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported Android providers before sending credentials", async () => {
    Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: {} });
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      connectSyncRepository("https://example.test/maps/", "synthetic", "synthetic"),
    ).rejects.toThrow("android-provider-unsupported");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("stops Nutstore in the browser before sending credentials over a cross-origin request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      connectSyncRepository("https://dav.jianguoyun.com/dav/test/", "test", "synthetic"),
    ).rejects.toThrow("desktop-required");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retains ordinary browser transport for other providers and supports cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    const connection = await connectSyncRepository(
      "https://example.test/maps/",
      "test",
      "synthetic",
    );
    expect(await connection.repository.read("map-1")).toEqual({ value: null, etag: null });
    const signal = fetcher.mock.calls[0][1]?.signal;
    await connection.close();
    expect(signal?.aborted).toBe(true);
  });
  it("uses the native bridge with the same history repository used by real-service probes", async () => {
    const require = createRequire(import.meta.url);
    const { createSyncTransport } = require("../desktop/sync-transport.cjs");
    const native = createSyncTransport({
      fetchImpl: vi.fn(
        async () => new Response('<d:multistatus xmlns:d="DAV:"/>', { status: 207 }),
      ),
    });
    const bridge = {
      syncConnect: vi.fn(async (input) => native.connect(7, input)),
      syncRequest: vi.fn(async (token, input) => native.request(7, token, input)),
      syncDisconnect: vi.fn(async (token) => native.close(7, token)),
    };
    Object.defineProperty(window, "iThreadDesktop", { configurable: true, value: bridge });
    try {
      const connection = await connectSyncRepository(
        "https://dav.jianguoyun.com/dav/test/",
        "test",
        "synthetic",
      );
      expect(await connection.repository.list()).toEqual([]);
      await connection.close();
      await connection.close();
      expect(bridge.syncDisconnect).toHaveBeenCalledTimes(1);
      await expect(connection.repository.list()).rejects.toThrow("cancelled");
    } finally {
      native.dispose();
    }
  });
});
