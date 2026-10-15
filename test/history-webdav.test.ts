import { createHash } from "node:crypto";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import { type LocalSnapshot, type RemoteSnapshot, syncMap } from "../src/sync/engine";
import { HistoryWebDavRepository } from "../src/sync/historyWebdav";
import { WebDavRepository } from "../src/sync/webdav";

const root = "https://dav.example.test/dav/我的坚果云/iThread-test/";
const doc = (title = "Test"): MindMapDoc => ({
  schemaVersion: 1,
  id: "map-1",
  title,
  root: { id: "root", topic: title, children: [] },
});
function service() {
  const files = new Map<string, string>();
  let afterPut: (() => Promise<void>) | undefined;
  const request = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const filename = url.pathname.split("/").pop() ?? "";
    if (init?.method === "PROPFIND") {
      const path = new URL(root).pathname.replace(/%[0-9A-F]{2}/g, (part) => part.toLowerCase());
      return new Response(
        `<d:multistatus xmlns:d="DAV:">${[...files.keys()].map((name) => `<d:response><d:href>${path}${name}</d:href></d:response>`).join("")}</d:multistatus>`,
        { status: 207 },
      );
    }
    if (init?.method === "PUT") {
      files.set(filename, String(init.body));
      await afterPut?.();
      return new Response(null, { status: 201 });
    }
    return files.has(filename)
      ? new Response(files.get(filename), { headers: { ETag: "unquoted-provider-value" } })
      : new Response(null, { status: 404 });
  });
  return {
    files,
    request,
    repo: new HistoryWebDavRepository(root, request),
    afterPut(fn: () => Promise<void>) {
      afterPut = fn;
    },
  };
}
class Device {
  state: LocalSnapshot;
  conflicts: RemoteSnapshot[] = [];
  constructor(value: MindMapDoc | null = null) {
    this.state = { value, base: null, version: 0 };
  }
  edit(value: MindMapDoc | null) {
    this.state.value = value;
    this.state.version++;
  }
  async read() {
    return structuredClone(this.state);
  }
  async apply(_id: string, version: number, remote: RemoteSnapshot) {
    if (version !== this.state.version) return false;
    this.state = {
      version: version + 1,
      value: structuredClone(remote.value),
      base: structuredClone(remote.value),
      baseEtag: remote.etag,
    };
    return true;
  }
  async preserveConflict(_id: string, _version: number, remote: RemoteSnapshot) {
    this.conflicts.push(remote);
  }
}
describe("immutable WebDAV history", () => {
  it.each([
    { protocolVersion: 3 },
    { mapId: "other" },
    { nonce: "short" },
    { nonce: 1 },
    { parents: "invalid" },
    { parents: ["invalid"] },
    { parents: ["a".repeat(64), "a".repeat(64)] },
    { parents: Array.from({ length: 257 }, (_, n) => n.toString(16).padStart(64, "0")) },
    { deleted: "true" },
    { deleted: true, document: doc() },
    { document: null },
  ])("rejects invalid content-addressed envelope %j", async (patch) => {
    const { repo, files } = service();
    const body = JSON.stringify({
      protocolVersion: 2,
      mapId: "map-1",
      nonce: "synthetic-long-nonce",
      parents: [],
      deleted: false,
      document: doc(),
      ...patch,
    });
    const hash = createHash("sha256").update(body).digest("hex");
    files.set(`map-1--${hash}.ithread-sync.json`, body);
    await expect(repo.read("map-1")).rejects.toThrow();
  });
  it("discovers equivalent Chinese path encodings and tolerates providers without strong ETags", async () => {
    const { repo, files } = service();
    const created = await repo.write("map-1", null, doc());
    expect(created?.etag).toMatch(/^j2:[a-f0-9]{64}$/);
    expect(await repo.list()).toEqual(["map-1"]);
    const next = await repo.write("map-1", created?.etag ?? null, doc("Edited"));
    expect(next?.value?.title).toBe("Edited");
    expect(files.size).toBe(2);
    expect(await repo.write("map-1", created?.etag ?? null, doc("Stale"))).toBeNull();
    expect(files.size).toBe(2);
  });
  it("preserves both concurrent first creations even when the server ignores conditional creates", async () => {
    const { repo, files, afterPut } = service();
    let arrived = 0;
    let release: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    afterPut(async () => {
      if (++arrived === 2) release?.();
      await barrier;
    });
    const results = await Promise.all([
      repo.write("map-1", null, doc("A")),
      repo.write("map-1", null, doc("B")),
    ]);
    expect(results).toEqual([null, null]);
    expect(files.size).toBe(2);
    const remote = await repo.read("map-1");
    expect(remote.conflicts?.map((copy) => copy.value?.title).sort()).toEqual(["A", "B"]);
    const local = new Device(doc("Local"));
    expect(await syncMap("map-1", local, repo)).toBe("conflict");
    expect(local.state.value?.title).toBe("Local");
    expect(local.conflicts).toHaveLength(2);
  });
  it("transfers offline edits and versioned deletion between independent simulated devices", async () => {
    const { repo, files, request } = service();
    const a = new Device(doc());
    const b = new Device();
    expect(await syncMap("map-1", a, repo)).toBe("push");
    expect(await syncMap("map-1", b, repo)).toBe("pull");
    b.edit(doc("Tablet edit"));
    expect(await syncMap("map-1", b, repo)).toBe("push");
    expect(await syncMap("map-1", a, repo)).toBe("pull");
    expect(a.state.value?.title).toBe("Tablet edit");
    b.edit(null);
    expect(await syncMap("map-1", b, repo)).toBe("push");
    expect(await syncMap("map-1", a, repo)).toBe("pull");
    expect(a.state.value).toBeNull();
    expect(files.size).toBe(3);
    expect(request.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
  it("keeps both divergent offline edits", async () => {
    const { repo } = service();
    const a = new Device(doc());
    const b = new Device();
    await syncMap("map-1", a, repo);
    await syncMap("map-1", b, repo);
    a.edit(doc("A"));
    b.edit(doc("B"));
    await syncMap("map-1", a, repo);
    expect(await syncMap("map-1", b, repo)).toBe("conflict");
    expect(b.state.value?.title).toBe("B");
    expect(b.conflicts[0].value?.title).toBe("A");
  });
  it("detects modified content under an immutable filename", async () => {
    const { repo, files } = service();
    await repo.write("map-1", null, doc());
    const filename = [...files.keys()][0];
    files.set(filename, `${files.get(filename)} `);
    await expect(repo.read("map-1")).rejects.toThrow("integrity");
  });
  it("rejects missing history parents without modifying local content", async () => {
    const { repo, files } = service();
    const a = new Device(doc());
    await syncMap("map-1", a, repo);
    a.edit(doc("Next"));
    await syncMap("map-1", a, repo);
    files.delete([...files.keys()][0]);
    await expect(syncMap("map-1", a, repo)).rejects.toThrow("Incomplete");
    expect(a.state.value?.title).toBe("Next");
  });
  it("does not silently accept an unrelated restored server history", async () => {
    const { repo, files } = service();
    const a = new Device(doc());
    await syncMap("map-1", a, repo);
    files.clear();
    await repo.write("map-1", null, doc("Unrelated restore"));
    expect(await syncMap("map-1", a, repo)).toBe("conflict");
    expect(a.state.value?.title).toBe("Test");
  });
  it("keeps legacy files untouched and requires explicit migration", async () => {
    const { repo, files } = service();
    files.set("map-1.json", "legacy data");
    await expect(repo.write("map-1", null, doc())).rejects.toThrow("legacy-sync-format");
    expect(files.get("map-1.json")).toBe("legacy data");
  });
  it("caps history size before downloading an unbounded number of revisions", async () => {
    const { repo, files, request } = service();
    for (let n = 0; n < 257; n++)
      files.set(`map-1--${n.toString(16).padStart(64, "0")}.ithread-sync.json`, "unused");
    await expect(repo.read("map-1")).rejects.toThrow("sync-history-limit");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("also fixes encoded paths for the original protocol without accepting escaped subdirectories", async () => {
    const { request, files } = service();
    files.set("map-1.json", "data");
    files.set("escape%2Fchild.json", "data");
    expect(await new WebDavRepository(root, request).list()).toEqual(["map-1"]);
  });
});
