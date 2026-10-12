// @vitest-environment node
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import {
  clearAllData,
  getMapDatabase,
  listVersions,
  loadMap,
  loadVersion,
  saveMap,
  saveRecoveryDraft,
  softDeleteMap,
} from "../src/store/mapStore";
import { IndexedDbSyncLocal, syncEndpoint } from "../src/sync/localStore";

const doc = (title = "Original"): MindMapDoc => ({
  schemaVersion: 1,
  id: "map-1",
  title,
  root: { id: "root", topic: title, children: [] },
});
const endpoint = "https://example.test/maps/";
beforeEach(async () => {
  await clearAllData();
});
describe("persistent opt-in sync adapter", () => {
  it("upgrades an existing version-6 library without replacing its maps", async () => {
    const old = await openDB("mindmap-studio", 6, {
      upgrade(database) {
        database.createObjectStore("maps");
      },
    });
    await old.put("maps", doc("Existing library"), "map-1");
    old.close();
    const current = await getMapDatabase();
    expect(current.version).toBe(7);
    expect(current.objectStoreNames.contains("syncStates")).toBe(true);
    expect((await loadMap("map-1"))?.title).toBe("Existing library");
    expect(await new IndexedDbSyncLocal(endpoint).selectedIds()).toEqual([]);
  });
  it("does not select a library automatically and persists choices and base across adapters", async () => {
    await saveMap(doc());
    const store = new IndexedDbSyncLocal(endpoint);
    expect(await store.selectedIds()).toEqual([]);
    await store.select("map-1", true);
    const snapshot = await store.read("map-1");
    await store.apply("map-1", snapshot.version, { value: snapshot.value, etag: '"one"' });
    const reopened = new IndexedDbSyncLocal(endpoint);
    expect(await reopened.selectedIds()).toEqual(["map-1"]);
    expect((await reopened.read("map-1")).base?.title).toBe("Original");
    expect(await new IndexedDbSyncLocal("https://other.test/maps/").selectedIds()).toEqual([]);
    await reopened.select("map-1", false);
    expect((await loadMap("map-1"))?.title).toBe("Original");
  });
  it("rejects a stale reply after normal autosave or CLI writes", async () => {
    await saveMap(doc());
    const store = new IndexedDbSyncLocal(endpoint);
    await store.select("map-1", true);
    const snapshot = await store.read("map-1");
    await saveMap(doc("New local edit"));
    expect(
      await store.apply("map-1", snapshot.version, { value: doc("Remote"), etag: '"two"' }),
    ).toBe(false);
    expect((await loadMap("map-1"))?.title).toBe("New local edit");
    expect((await store.read("map-1")).version).toBeGreaterThan(snapshot.version);
  });
  it("atomically backs up replaced content in version history", async () => {
    await saveMap(doc());
    const store = new IndexedDbSyncLocal(endpoint);
    await store.select("map-1", true);
    const snapshot = await store.read("map-1");
    expect(
      await store.apply("map-1", snapshot.version, { value: doc("Remote"), etag: '"two"' }),
    ).toBe(true);
    const history = await listVersions("map-1");
    expect(history).toHaveLength(1);
    expect((await loadVersion(history[0].id))?.title).toBe("Original");
    expect((await loadMap("map-1"))?.title).toBe("Remote");
  });
  it("keeps remote tombstones recoverable in Trash and observes local trash", async () => {
    await saveMap(doc());
    const store = new IndexedDbSyncLocal(endpoint);
    await store.select("map-1", true);
    const snapshot = await store.read("map-1");
    await store.apply("map-1", snapshot.version, { value: null, etag: '"deleted"' });
    expect((await loadMap("map-1"))?.meta?.trashedAt).toBeGreaterThan(0);
    expect((await store.read("map-1")).value).toBeNull();
    await saveMap(doc());
    await softDeleteMap("map-1");
    expect((await store.read("map-1")).value).toBeNull();
  });
  it("blocks active editors and unsaved recovery drafts", async () => {
    await saveMap(doc());
    const store = new IndexedDbSyncLocal(endpoint);
    await store.select("map-1", true);
    await expect(new IndexedDbSyncLocal(endpoint, () => "map-1").read("map-1")).rejects.toThrow(
      "active-map",
    );
    const snapshot = await store.read("map-1");
    await saveRecoveryDraft(doc("Draft"));
    await expect(store.read("map-1")).rejects.toThrow("pending-local-save");
    expect(
      await store.apply("map-1", snapshot.version, { value: doc("Remote"), etag: '"two"' }),
    ).toBe(false);
  });
  it("stores both conflict copies durably and deduplicates the same remote version", async () => {
    await saveMap(doc());
    const store = new IndexedDbSyncLocal(endpoint);
    await store.select("map-1", true);
    const remote = { value: doc("Remote"), etag: '"two"' };
    await store.preserveConflict("map-1", 0, remote);
    await store.preserveConflict("map-1", 0, remote);
    const conflicts = await new IndexedDbSyncLocal(endpoint).conflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].local?.title).toBe("Original");
    expect(conflicts[0].remote.value?.title).toBe("Remote");
    expect((await loadMap("map-1"))?.title).toBe("Original");
  });
  it("discovers a selected remote-only map without affecting other maps", async () => {
    await saveMap({ ...doc(), id: "private-map" });
    const store = new IndexedDbSyncLocal(endpoint);
    await store.select("map-1", true);
    const snapshot = await store.read("map-1");
    expect(snapshot.value).toBeNull();
    await store.apply("map-1", snapshot.version, { value: doc("Imported"), etag: '"one"' });
    expect((await loadMap("map-1"))?.title).toBe("Imported");
    expect((await loadMap("private-map"))?.title).toBe("Original");
  });
  it("stores only the directory URL, not credentials", async () => {
    expect(await syncEndpoint()).toBe("");
    await syncEndpoint(endpoint);
    expect(await syncEndpoint()).toBe(endpoint);
    expect(await (await getMapDatabase()).getAll("meta")).toEqual([endpoint]);
  });
});
