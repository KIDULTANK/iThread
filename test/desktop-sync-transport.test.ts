import { readFileSync } from "node:fs";
// @vitest-environment node
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
type Input = { endpoint: string; username: string; password: string };
type Request = {
  filename: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
};
type Service = {
  connect(owner: number, input: Input): string;
  request(
    owner: number,
    token: string,
    input: Request,
  ): Promise<{ status: number; body: string; headers: Record<string, string> }>;
  close(owner: number, token: string): boolean;
  closeOwner(owner: number): void;
  dispose(): void;
};
const { createSyncTransport, isTrustedSyncSender } = require("../desktop/sync-transport.cjs") as {
  createSyncTransport(options?: { fetchImpl?: typeof fetch; now?: () => number }): Service;
  isTrustedSyncSender(event: unknown, contents: unknown, url: string): boolean;
};
const input: Input = {
  endpoint: "https://dav.jianguoyun.com/dav/测试/",
  username: "test-user",
  password: "synthetic-password",
};
const services: Service[] = [];
function service(
  fetchImpl: typeof fetch = vi.fn(async () => new Response("{}")),
  now?: () => number,
) {
  const instance = createSyncTransport({ fetchImpl, now });
  services.push(instance);
  return instance;
}
afterEach(() => {
  for (const instance of services.splice(0)) instance.dispose();
});
describe("provider-scoped desktop sync transport", () => {
  it("validates the actual main frame and document, not just a file origin", () => {
    const mainFrame = { url: "file:///app/dist/index.html" };
    const contents = { mainFrame };
    expect(
      isTrustedSyncSender({ sender: contents, senderFrame: mainFrame }, contents, mainFrame.url),
    ).toBe(true);
    expect(
      isTrustedSyncSender(
        { sender: contents, senderFrame: { url: mainFrame.url } },
        contents,
        mainFrame.url,
      ),
    ).toBe(false);
    expect(
      isTrustedSyncSender(
        { sender: contents, senderFrame: mainFrame },
        contents,
        "file:///other/index.html",
      ),
    ).toBe(false);
    expect(
      isTrustedSyncSender({ sender: {}, senderFrame: mainFrame }, contents, mainFrame.url),
    ).toBe(false);
    const address = mainFrame.url;
    mainFrame.url += "?map=test#node";
    expect(
      isTrustedSyncSender({ sender: contents, senderFrame: mainFrame }, contents, address),
    ).toBe(true);
  });
  it.each([
    "https://example.com/dav/",
    "http://dav.jianguoyun.com/dav/",
    "https://dav.jianguoyun.com:444/dav/",
    "https://user:pass@dav.jianguoyun.com/dav/",
    "https://dav.jianguoyun.com/dav/?secret=x",
    "https://dav.jianguoyun.com/dav/a%2Fb/",
  ])("rejects endpoint %s", (endpoint) => {
    expect(() => service().connect(1, { ...input, endpoint })).toThrow();
  });
  it("uses an opaque owner-bound session and permits only the chosen directory", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response('{"test":true}', {
          headers: { ETag: "bare", "Set-Cookie": "must-not-cross-IPC" },
        }),
    );
    const native = service(fetcher);
    const token = native.connect(1, input);
    expect(token).not.toContain("synthetic");
    const response = await native.request(1, token, { filename: "map-1.json", method: "GET" });
    expect(response.body).toBe('{"test":true}');
    expect(response.headers).toEqual({ etag: "bare", "content-type": "text/plain;charset=UTF-8" });
    expect(fetcher.mock.calls[0][0].toString()).toBe(
      "https://dav.jianguoyun.com/dav/%E6%B5%8B%E8%AF%95/map-1.json",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
    });
    await expect(
      native.request(2, token, { filename: "map-1.json", method: "GET" }),
    ).rejects.toThrow();
    expect(native.close(2, token)).toBe(false);
    expect(native.close(1, token)).toBe(true);
    await expect(
      native.request(1, token, { filename: "map-1.json", method: "GET" }),
    ).rejects.toThrow();
  });
  it.each([
    "../other.json",
    "%2e%2e/other.json",
    "/outside.json",
    "https://other.test/file.json",
    "folder/file.json",
    "file.json?token=x",
  ])("rejects filename %s", async (filename) => {
    const fetcher = vi.fn<typeof fetch>();
    const native = service(fetcher);
    const token = native.connect(1, input);
    await expect(native.request(1, token, { filename, method: "GET" })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects arbitrary methods, headers and recursive directory reads", async () => {
    const native = service();
    const token = native.connect(1, input);
    const requests: Request[] = [
      { filename: "map-1.json", method: "DELETE" },
      { filename: "", method: "PROPFIND", headers: { Depth: "infinity" } },
      { filename: "map-1.json", method: "GET", headers: { Authorization: "override" } },
    ];
    for (const request of requests)
      await expect(native.request(1, token, request)).rejects.toThrow();
  });
  it("accepts history revision filenames and caps response size", async () => {
    const filename = `map-1--${"a".repeat(64)}.ithread-sync.json`;
    const native = service(
      vi.fn(async () => new Response("{}", { headers: { "Content-Length": "999999999" } })),
    );
    await expect(
      native.request(1, native.connect(1, input), { filename, method: "GET" }),
    ).rejects.toThrow("Sync network request failed");
  });
  it("expires credentials and closes all sessions of a destroyed owner", async () => {
    let time = 0;
    const native = service(undefined, () => time);
    const token = native.connect(1, input);
    time = 11 * 60 * 1000;
    await expect(
      native.request(1, token, { filename: "map-1.json", method: "GET" }),
    ).rejects.toThrow();
    const next = native.connect(1, input);
    native.closeOwner(1);
    await expect(
      native.request(1, next, { filename: "map-1.json", method: "GET" }),
    ).rejects.toThrow();
  });
  it("aborts in-flight requests when the settings session closes", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const native = service(fetcher);
    const token = native.connect(1, input);
    const pending = native.request(1, token, { filename: "map-1.json", method: "GET" });
    native.close(1, token);
    await expect(pending).rejects.toThrow("Sync network request failed");
  });
  it("exposes only the intended IPC methods from the preload", async () => {
    const expose = vi.fn();
    const invoke = vi.fn(async (..._args: unknown[]) => true);
    runInNewContext(readFileSync(new URL("../desktop/preload.cjs", import.meta.url), "utf8"), {
      process: { argv: [] },
      require: () => ({
        contextBridge: { exposeInMainWorld: expose },
        ipcRenderer: { on: vi.fn(), invoke },
      }),
    });
    const bridge = expose.mock.calls[0][1];
    await bridge.syncConnect(input);
    await bridge.syncRequest("opaque", { filename: "", method: "PROPFIND" });
    await bridge.syncDisconnect("opaque");
    expect(invoke.mock.calls.map((call) => call[0])).toEqual([
      "ithread:sync-connect",
      "ithread:sync-request",
      "ithread:sync-disconnect",
    ]);
  });
});
