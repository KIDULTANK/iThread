import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import {
  clearAllData,
  clearRecoveryDraft,
  clearRecoveryDraftThrough,
  createFolder,
  deleteFolder,
  deleteMap,
  emptyTrash,
  findMapReferences,
  getAllMaps,
  getFolders,
  getInbox,
  getLastOpened,
  latestVersionDoc,
  listMaps,
  listRecentFiles,
  listTrashedMaps,
  loadMap,
  loadMapHandle,
  loadRecoveryDraft,
  moveMapToFolder,
  noteRecentFile,
  renameFolder,
  restoreMapFromTrash,
  saveInbox,
  saveMap,
  saveMapHandle,
  saveRecoveryDraft,
  saveVersion,
  setLastOpened,
  softDeleteMap,
} from "../src/store/mapStore";

const docOf = (id: string, title: string): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title,
  root: { id: "r", topic: title, children: [{ id: "c", topic: "child", children: [] }] },
});

// fake-indexeddb gives this file its own fresh database; tests within it share that DB and run in
// source order. The cold-boot assertions below rely on running before anything is written, so they
// come first.
describe("mapStore — cold boot", () => {
  it("getLastOpened returns null before anything has been opened", async () => {
    expect(await getLastOpened()).toBeNull();
  });

  it("getAllMaps returns an empty list on a fresh store", async () => {
    expect(await getAllMaps()).toEqual([]);
  });

  it("latestVersionDoc returns null for a map with no snapshots", async () => {
    expect(await latestVersionDoc("never-saved")).toBeNull();
  });

  it("getInbox returns an empty list before anything is captured", async () => {
    expect(await getInbox()).toEqual([]);
  });
});

describe("mapStore — crash recovery", () => {
  it("keeps an independent normalized draft until the stable save catches up", async () => {
    const draft = docOf("recover-1", "Recovered title");
    await saveRecoveryDraft(draft, 200);
    const loaded = await loadRecoveryDraft("recover-1");
    expect(loaded?.savedAt).toBe(200);
    expect(loaded?.doc.title).toBe("Recovered title");

    await clearRecoveryDraftThrough("recover-1", 199);
    expect(await loadRecoveryDraft("recover-1")).not.toBeNull();
    await clearRecoveryDraftThrough("recover-1", 200);
    expect(await loadRecoveryDraft("recover-1")).toBeNull();
  });

  it("can explicitly discard a recovery draft", async () => {
    await saveRecoveryDraft(docOf("recover-2", "Draft"), 300);
    await clearRecoveryDraft("recover-2");
    expect(await loadRecoveryDraft("recover-2")).toBeNull();
  });
});

describe("mapStore", () => {
  it("saves and loads a map by id", async () => {
    await saveMap(docOf("m1", "First"));
    const back = await loadMap("m1");
    expect(back?.title).toBe("First");
    expect(back?.root.children.map((c) => c.topic)).toEqual(["child"]);
  });

  it("stamps meta.updatedAt on save without mutating the caller's doc", async () => {
    const doc = docOf("m1b", "Stamped");
    await saveMap(doc);
    expect(doc.meta?.updatedAt).toBeUndefined(); // caller's object is untouched
    expect((await loadMap("m1b"))?.meta?.updatedAt).toBeTypeOf("number");
  });

  it("returns null for an unknown id", async () => {
    expect(await loadMap("nope")).toBeNull();
  });

  it("round-trips the quick-capture inbox, newest first", async () => {
    await saveInbox([
      { id: "a", text: "older", ts: 100 },
      { id: "b", text: "newer", ts: 200 },
    ]);
    const back = await getInbox();
    expect(back.map((i) => i.text)).toEqual(["newer", "older"]); // getInbox sorts ts desc
  });

  it("tolerates a non-array inbox payload (returns [])", async () => {
    await saveInbox([{ id: "x", text: "keep", ts: 1 }]);
    // A non-array shape under the same meta key must degrade to empty, not throw.
    await saveInbox(42 as never);
    expect(await getInbox()).toEqual([]);
  });

  it("lists saved maps (sorted by title)", async () => {
    await saveMap(docOf("m2", "Beta"));
    await saveMap(docOf("m3", "Alpha"));
    const ids = (await listMaps()).map((m) => m.id);
    expect(ids).toContain("m2");
    expect(ids).toContain("m3");
  });

  it("deletes a map", async () => {
    await saveMap(docOf("m4", "Doomed"));
    await deleteMap("m4");
    expect(await loadMap("m4")).toBeNull();
  });

  it("remembers the last-opened map", async () => {
    await setLastOpened("m1");
    expect(await getLastOpened()).toBe("m1");
  });
});

describe("mapStore — disk-file handles", () => {
  // A minimal stand-in for a FileSystemFileHandle; only needs to be structured-cloneable for IndexedDB.
  const fakeHandle = (name: string) => ({ kind: "file", name }) as unknown as FileSystemFileHandle;

  it("saves, loads, and re-binds a handle by map id", async () => {
    await saveMapHandle("h1", fakeHandle("plan.mmst"));
    expect((await loadMapHandle("h1"))?.name).toBe("plan.mmst");
  });

  it("returns null for a map with no bound file", async () => {
    expect(await loadMapHandle("never-bound")).toBeNull();
  });

  it("drops the handle when the map is deleted", async () => {
    await saveMap(docOf("h2", "Bound"));
    await saveMapHandle("h2", fakeHandle("bound.mmst"));
    await deleteMap("h2");
    expect(await loadMapHandle("h2")).toBeNull();
  });
});

describe("mapStore — getAllMaps / listMaps", () => {
  it("getAllMaps returns the full docs that were saved", async () => {
    await saveMap(docOf("g1", "Gamma"));
    await saveMap(docOf("g2", "Delta"));
    const all = await getAllMaps();
    const byId = new Map(all.map((d) => [d.id, d]));
    expect(byId.get("g1")?.root.topic).toBe("Gamma"); // full doc, not just a summary
    expect(byId.get("g2")?.root.children).toHaveLength(1);
  });

  it("getAllMaps reflects deletions", async () => {
    await saveMap(docOf("g3", "Temp"));
    expect((await getAllMaps()).some((d) => d.id === "g3")).toBe(true);
    await deleteMap("g3");
    expect((await getAllMaps()).some((d) => d.id === "g3")).toBe(false);
  });

  it("listMaps sorts by title across the whole library", async () => {
    await saveMap(docOf("s-c", "Zeta"));
    await saveMap(docOf("s-a", "Acme"));
    await saveMap(docOf("s-b", "Mid"));
    const list = await listMaps();
    const titles = list.map((m) => m.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });
});

describe("mapStore — findMapReferences", () => {
  it("finds maps that roll-up or map-link to the target, excluding the target + unrelated maps", async () => {
    await saveMap(docOf("ref-target", "Target"));
    await saveMap({
      schemaVersion: 1,
      id: "ref-r1",
      title: "R1 Rollup",
      root: {
        id: "r",
        topic: "R1",
        children: [{ id: "c", topic: "mirror", rollup: "ref-target", children: [] }],
      },
    });
    await saveMap({
      schemaVersion: 1,
      id: "ref-r2",
      title: "R2 Link",
      root: {
        id: "r",
        topic: "R2",
        children: [{ id: "c", topic: "see", hyperlink: "#map=ref-target", children: [] }],
      },
    });
    await saveMap({
      schemaVersion: 1,
      id: "ref-r3",
      title: "R3 Unrelated",
      root: {
        id: "r",
        topic: "R3",
        children: [{ id: "c", topic: "x", rollup: "someone-else", children: [] }],
      },
    });
    const ids = (await findMapReferences("ref-target")).map((r) => r.id);
    expect(ids).toContain("ref-r1");
    expect(ids).toContain("ref-r2");
    expect(ids).not.toContain("ref-r3");
    expect(ids).not.toContain("ref-target"); // never lists the target itself
  });

  it("checks floating topics, not only the central tree", async () => {
    await saveMap({
      schemaVersion: 1,
      id: "ref-float",
      title: "Floats",
      root: { id: "r", topic: "Floats", children: [] },
      floatingTopics: [{ id: "f", topic: "loose", rollup: "ref-target", children: [] }],
    });
    expect((await findMapReferences("ref-target")).some((r) => r.id === "ref-float")).toBe(true);
  });
});

describe("mapStore — latestVersionDoc edge cases", () => {
  it("returns the newest snapshot's doc regardless of save order", async () => {
    // Save out of order: the later timestamp must win even though it was written first.
    await saveVersion(docOf("lv", "Newer"), 5000);
    await saveVersion(docOf("lv", "Older"), 1000);
    expect((await latestVersionDoc("lv"))?.title).toBe("Newer");
  });

  it("does not bleed across maps (each map's latest is its own)", async () => {
    await saveVersion(docOf("lvA", "A-latest"), 2000);
    await saveVersion(docOf("lvB", "B-latest"), 9000);
    expect((await latestVersionDoc("lvA"))?.title).toBe("A-latest");
    expect((await latestVersionDoc("lvB"))?.title).toBe("B-latest");
  });
});

describe("mapStore — concurrency", () => {
  it("handles concurrent saveMap + saveVersion without losing writes", async () => {
    const doc = docOf("cc", "Concurrent");
    // Fire a map save and several version snapshots at once; all must land.
    await Promise.all([
      saveMap(doc),
      saveVersion(docOf("cc", "v1"), 1000),
      saveVersion(docOf("cc", "v2"), 2000),
      saveVersion(docOf("cc", "v3"), 3000),
    ]);
    expect((await loadMap("cc"))?.title).toBe("Concurrent");
    expect((await latestVersionDoc("cc"))?.title).toBe("v3"); // newest snapshot is intact
  });

  it("parallel saveMap calls for distinct ids all persist", async () => {
    await Promise.all([
      saveMap(docOf("p1", "P1")),
      saveMap(docOf("p2", "P2")),
      saveMap(docOf("p3", "P3")),
    ]);
    const ids = (await getAllMaps()).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
  });
});

describe("mapStore — trash (soft-delete)", () => {
  it("soft-deletes to Trash: hidden from the library but not destroyed, and listed in trash", async () => {
    await saveMap(docOf("t1", "Trashed One"));
    await softDeleteMap("t1");
    expect((await listMaps()).some((m) => m.id === "t1")).toBe(false); // hidden from the library
    expect(await loadMap("t1")).not.toBeNull(); // but the record is kept (recoverable)
    expect((await listTrashedMaps()).map((t) => t.id)).toContain("t1");
  });

  it("restores a trashed map back into the library", async () => {
    await saveMap(docOf("t2", "Trashed Two"));
    await softDeleteMap("t2");
    await restoreMapFromTrash("t2");
    expect((await listMaps()).some((m) => m.id === "t2")).toBe(true);
    expect((await listTrashedMaps()).some((t) => t.id === "t2")).toBe(false);
  });

  it("emptyTrash permanently deletes trashed maps but leaves live ones", async () => {
    await saveMap(docOf("t5", "Keep me")); // stays live
    await saveMap(docOf("t6", "Purge me"));
    await softDeleteMap("t6");
    await emptyTrash();
    expect(await loadMap("t6")).toBeNull(); // gone for good
    expect(await loadMap("t5")).not.toBeNull(); // the live map is untouched
    expect(await listTrashedMaps()).toEqual([]);
  });
});

describe("mapStore — recent files (Open Recent)", () => {
  it("notes + lists recently-opened disk files by name", async () => {
    await noteRecentFile("rf1", "alpha.mmst");
    await noteRecentFile("rf2", "beta.mmst");
    const byId = new Map((await listRecentFiles()).map((r) => [r.id, r.name]));
    expect(byId.get("rf1")).toBe("alpha.mmst");
    expect(byId.get("rf2")).toBe("beta.mmst");
  });

  it("re-noting a file refreshes it in place (no duplicate)", async () => {
    await noteRecentFile("rf3", "gamma.mmst");
    await noteRecentFile("rf3", "gamma-renamed.mmst");
    const matches = (await listRecentFiles()).filter((r) => r.id === "rf3");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("gamma-renamed.mmst");
  });

  it("permanently deleting a map drops it from Open Recent", async () => {
    await saveMap(docOf("rf4", "Doomed"));
    await noteRecentFile("rf4", "doomed.mmst");
    await deleteMap("rf4");
    expect((await listRecentFiles()).some((r) => r.id === "rf4")).toBe(false);
  });

  it("respects the requested limit", async () => {
    for (let i = 0; i < 12; i++) await noteRecentFile(`lim${i}`, `f${i}.mmst`);
    expect((await listRecentFiles(5)).length).toBe(5);
  });
});

describe("mapStore — library folders (C2)", () => {
  it("creates, renames, files a map, and orphans maps on delete (never destroys them)", async () => {
    const f = await createFolder("Work");
    expect(f).not.toBeNull();
    if (!f) return;
    expect((await getFolders()).map((x) => x.name)).toContain("Work");

    await saveMap(docOf("fm1", "Filed map"));
    await moveMapToFolder("fm1", f.id);
    expect((await loadMap("fm1"))?.meta?.folderId).toBe(f.id);

    await renameFolder(f.id, "Projects");
    expect((await getFolders()).find((x) => x.id === f.id)?.name).toBe("Projects");

    await deleteFolder(f.id);
    expect((await getFolders()).some((x) => x.id === f.id)).toBe(false);
    // The map survives, orphaned back to the top level.
    expect(await loadMap("fm1")).not.toBeNull();
    expect((await loadMap("fm1"))?.meta?.folderId).toBeUndefined();
  });

  it("rejects a blank folder name", async () => {
    expect(await createFolder("   ")).toBeNull();
  });

  it("listMaps resolves each map's folderName, and treats an orphaned folderId as top-level", async () => {
    const f = await createFolder("Marketing");
    expect(f).not.toBeNull();
    if (!f) return;
    await saveMap(docOf("lm-filed", "Campaign plan"));
    await saveMap(docOf("lm-loose", "Loose map"));
    await moveMapToFolder("lm-filed", f.id);

    const byId = new Map((await listMaps()).map((m) => [m.id, m]));
    // A filed map carries its folder id + resolved name…
    expect(byId.get("lm-filed")?.folderId).toBe(f.id);
    expect(byId.get("lm-filed")?.folderName).toBe("Marketing");
    // …a top-level map carries neither.
    expect(byId.get("lm-loose")?.folderId).toBeUndefined();
    expect(byId.get("lm-loose")?.folderName).toBeUndefined();

    // Delete the folder → the (now-orphaned) map reads as top-level again, no dangling folderName.
    await deleteFolder(f.id);
    const orphaned = (await listMaps()).find((m) => m.id === "lm-filed");
    expect(orphaned?.folderName).toBeUndefined();
    expect(orphaned?.folderId).toBeUndefined();
  });
});

// MUST stay last — it deletes the shared database this file's other tests populate.
describe("mapStore — clearAllData", () => {
  it("wipes the whole library", async () => {
    await saveMap(docOf("wipe-me", "Wipe"));
    expect((await getAllMaps()).length).toBeGreaterThan(0);
    await clearAllData();
    expect(await getAllMaps()).toEqual([]);
  });
});
