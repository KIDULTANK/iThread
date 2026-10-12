// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import {
  type LocalSnapshot,
  type RemoteSnapshot,
  type SyncLocalStore,
  planSync,
  sameSyncValue,
  syncMap,
} from "../src/sync/engine";
import { WebDavRepository } from "../src/sync/webdav";

const doc = (topic = "Original"): MindMapDoc => ({
  schemaVersion: 1,
  id: "map-1",
  title: topic,
  root: { id: "root", topic, children: [] },
});
class Device implements SyncLocalStore {
  state: LocalSnapshot;
  conflicts = new Map<string, RemoteSnapshot>();
  constructor(value: MindMapDoc | null = null) {
    this.state = { value, base: null, version: 0 };
  }
  edit(value: MindMapDoc | null) {
    this.state = { ...this.state, value, version: this.state.version + 1 };
  }
  async read() {
    return structuredClone(this.state);
  }
  async apply(_id: string, version: number, remote: RemoteSnapshot) {
    if (this.state.version !== version) return false;
    this.state = {
      value: structuredClone(remote.value),
      base: structuredClone(remote.value),
      version: version + 1,
    };
    return true;
  }
  async preserveConflict(id: string, _version: number, remote: RemoteSnapshot) {
    this.conflicts.set(`${id}:${remote.etag}`, structuredClone(remote));
  }
}
function server() {
  const files = new Map<string, { body: string; etag: string }>();
  let revision = 0;
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const key = String(url);
    if (init?.method === "PROPFIND")
      return new Response(
        `<d:multistatus xmlns:d="DAV:">${[...files.keys()].map((href) => `<d:response><d:href>${href}</d:href></d:response>`).join("")}</d:multistatus>`,
        { status: 207 },
      );
    if (init?.method === "PUT") {
      const current = files.get(key);
      const headers = new Headers(init.headers);
      if (current ? headers.get("If-Match") !== current.etag : headers.get("If-None-Match") !== "*")
        return new Response(null, { status: 412 });
      files.set(key, { body: String(init.body), etag: `"${++revision}"` });
      return new Response(null, { status: current ? 204 : 201 });
    }
    const file = files.get(key);
    return file
      ? new Response(file.body, { headers: { ETag: file.etag } })
      : new Response(null, { status: 404 });
  });
  return {
    files,
    fetcher,
    repo: new WebDavRepository("https://dav.example.test/ithread/", fetcher),
  };
}

describe("single-person multi-device sync", () => {
  it("creates on A, discovers and downloads on B, then transfers an offline edit back", async () => {
    const { repo } = server();
    const a = new Device(doc());
    const b = new Device();
    expect(await syncMap("map-1", a, repo)).toBe("push");
    expect(await repo.list()).toEqual(["map-1"]);
    expect(await syncMap("map-1", b, repo)).toBe("pull");
    b.edit(doc("Tablet edit"));
    expect(await syncMap("map-1", b, repo)).toBe("push");
    expect(await syncMap("map-1", a, repo)).toBe("pull");
    expect(a.state.value?.title).toBe("Tablet edit");
  });
  it("keeps both divergent edits without overwriting either, and deduplicates conflicts", async () => {
    const { repo } = server();
    const a = new Device(doc());
    const b = new Device();
    await syncMap("map-1", a, repo);
    await syncMap("map-1", b, repo);
    a.edit(doc("Windows edit"));
    b.edit(doc("iPad edit"));
    await syncMap("map-1", a, repo);
    expect(await syncMap("map-1", b, repo)).toBe("conflict");
    await syncMap("map-1", b, repo);
    expect(b.state.value?.title).toBe("iPad edit");
    expect(b.conflicts.size).toBe(1);
    expect([...b.conflicts.values()][0].value?.title).toBe("Windows edit");
    expect((await repo.read("map-1")).value?.title).toBe("Windows edit");
  });
  it("keeps pending content after an offline failure and retries successfully", async () => {
    const { repo, fetcher } = server();
    const a = new Device(doc());
    fetcher.mockRejectedValueOnce(new Error("offline"));
    await expect(syncMap("map-1", a, repo)).rejects.toThrow("offline");
    expect(a.state.base).toBeNull();
    expect(a.state.value).toEqual(doc());
    expect(await syncMap("map-1", a, repo)).toBe("push");
  });
  it("recovers a successful upload whose acknowledgement was lost", async () => {
    const { repo, fetcher } = server();
    const a = new Device(doc());
    const original = fetcher.getMockImplementation();
    if (!original) throw new Error("Missing test transport");
    let loseReply = true;
    fetcher.mockImplementation(async (url, init) => {
      const response = await original(url, init);
      if (init?.method === "PUT" && loseReply) {
        loseReply = false;
        throw new Error("reply lost");
      }
      return response;
    });
    await expect(syncMap("map-1", a, repo)).rejects.toThrow("reply lost");
    expect(await syncMap("map-1", a, repo)).toBe("ack");
    expect(a.state.base).toEqual(doc());
  });
  it("does not overwrite an edit made locally while upload is in flight", async () => {
    const { repo, fetcher } = server();
    const a = new Device(doc());
    const original = fetcher.getMockImplementation();
    if (!original) throw new Error("Missing test transport");
    fetcher.mockImplementation(async (url, init) => {
      if (init?.method === "PUT") a.edit(doc("Newer local edit"));
      return original(url, init);
    });
    expect(await syncMap("map-1", a, repo)).toBe("retry");
    expect(a.state.value?.title).toBe("Newer local edit");
    expect(a.state.base).toBeNull();
  });
  it("propagates an explicit tombstone, but not physically missing remote files", async () => {
    const { repo, files } = server();
    const a = new Device(doc());
    const b = new Device();
    await syncMap("map-1", a, repo);
    await syncMap("map-1", b, repo);
    files.clear();
    expect(await syncMap("map-1", b, repo)).toBe("conflict");
    expect(b.state.value).toEqual(doc());
    await repo.write("map-1", null, doc());
    a.edit(null);
    await syncMap("map-1", a, repo);
    expect(await syncMap("map-1", b, repo)).toBe("pull");
    expect(b.state.value).toBeNull();
  });
  it("treats deletion versus an offline edit as conflict", () => {
    expect(planSync(doc("Edited"), doc(), null)).toBe("conflict");
    expect(planSync(null, doc(), doc("Edited"))).toBe("conflict");
  });
  it("ignores autosave timestamps and object-key order but detects real content edits", () => {
    expect(
      sameSyncValue({ ...doc(), meta: { updatedAt: 1 } }, { ...doc(), meta: { updatedAt: 9 } }),
    ).toBe(true);
    expect(sameSyncValue(doc(), doc("Edited"))).toBe(false);
  });
});

describe("WebDAV safety", () => {
  it("retries a remote write race, then preserves the competing version as a conflict", async () => {
    const { repo, fetcher, files } = server();
    const a = new Device(doc());
    const original = fetcher.getMockImplementation();
    if (!original) throw new Error("Missing test transport");
    fetcher.mockImplementation(async (url, init) => {
      if (init?.method === "PUT" && !files.size) {
        files.set(String(url), {
          body: JSON.stringify({
            protocolVersion: 1,
            mapId: "map-1",
            deleted: false,
            document: doc("Other device"),
          }),
          etag: '"racer"',
        });
      }
      return original(url, init);
    });
    expect(await syncMap("map-1", a, repo)).toBe("retry");
    expect(a.state.base).toBeNull();
    expect(await syncMap("map-1", a, repo)).toBe("conflict");
    expect(a.state.value).toEqual(doc());
    expect([...a.conflicts.values()][0].value?.title).toBe("Other device");
  });
  it("does not acknowledge a different edit observed after a successful PUT", async () => {
    const { repo, fetcher, files } = server();
    const original = fetcher.getMockImplementation();
    if (!original) throw new Error("Missing test transport");
    fetcher.mockImplementation(async (url, init) => {
      const response = await original(url, init);
      if (init?.method === "PUT")
        files.set(String(url), {
          body: JSON.stringify({
            protocolVersion: 1,
            mapId: "map-1",
            deleted: false,
            document: doc("Later edit"),
          }),
          etag: '"later"',
        });
      return response;
    });
    expect(await repo.write("map-1", null, doc())).toBeNull();
  });
  it("refuses stale ETags and unguarded creation over an existing map", async () => {
    const { repo } = server();
    const first = await repo.write("map-1", null, doc());
    if (!first) throw new Error("Missing first revision");
    await repo.write("map-1", first.etag, doc("Other device"));
    expect(await repo.write("map-1", first.etag, doc("Stale"))).toBeNull();
    expect(await repo.write("map-1", null, doc("Overwrite"))).toBeNull();
    expect((await repo.read("map-1")).value?.title).toBe("Other device");
  });
  it.each([
    "http://example.com/",
    "https://user:pass@example.com/",
    "https://example.com/?token=secret",
  ])("rejects unsafe endpoint %s", (endpoint) => {
    expect(() => new WebDavRepository(endpoint)).toThrow();
  });
  it.each(["../other", "a/b", "a?token=x"])("rejects path traversal ID %s", async (id) => {
    const { repo, fetcher } = server();
    await expect(repo.read(id)).rejects.toThrow("Invalid sync map ID");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects weak ETags and malformed map data without applying it locally", async () => {
    const { repo, fetcher } = server();
    const a = new Device();
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ protocolVersion: 1, mapId: "map-1", deleted: false, document: doc() }),
        { headers: { ETag: 'W/"weak"' } },
      ),
    );
    await expect(syncMap("map-1", a, repo)).rejects.toThrow("strong ETag");
    expect(a.state.version).toBe(0);
    fetcher.mockResolvedValueOnce(
      new Response('{"protocolVersion":99}', { headers: { ETag: '"valid"' } }),
    );
    await expect(syncMap("map-1", a, repo)).rejects.toThrow("Unsupported sync protocol");
  });
  it("rejects unauthorized responses and oversized responses", async () => {
    const { repo, fetcher } = server();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(repo.read("map-1")).rejects.toThrow("Sync HTTP 401");
    fetcher.mockResolvedValueOnce(
      new Response("{}", { headers: { "Content-Length": "999999999" } }),
    );
    await expect(repo.read("map-1")).rejects.toThrow("too large");
  });
  it("rejects unsafe XML and ignores listing entries outside the chosen directory", async () => {
    const { repo, fetcher } = server();
    fetcher.mockResolvedValueOnce(new Response("<!DOCTYPE x><x/>", { status: 207 }));
    await expect(repo.list()).rejects.toThrow("Invalid WebDAV XML");
    fetcher.mockResolvedValueOnce(
      new Response(
        '<d:multistatus xmlns:d="DAV:"><d:response><d:href>https://attacker.test/map-1.json</d:href></d:response><d:response><d:href>/ithread/map-1.json</d:href></d:response><d:response><d:href>/other/map-2.json</d:href></d:response></d:multistatus>',
        { status: 207 },
      ),
    );
    expect(await repo.list()).toEqual(["map-1"]);
  });
});
