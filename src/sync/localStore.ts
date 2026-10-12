import type { MindMapDoc } from "../model/types";
import {
  MAX_VERSIONS,
  type SyncConflict,
  type SyncRecord,
  getMapDatabase,
} from "../store/mapStore";
import { type RemoteSnapshot, type SyncLocalStore, sameSyncValue } from "./engine";

const key = (workspace: string, id: string) => JSON.stringify([workspace, id]);
const value = (doc: MindMapDoc | undefined) => (doc?.meta?.trashedAt ? null : (doc ?? null));

export async function syncEndpoint(endpoint?: string) {
  const database = await getMapDatabase();
  if (endpoint !== undefined) await database.put("meta", endpoint, "syncEndpoint");
  return (await database.get("meta", "syncEndpoint")) ?? "";
}

/** Observe the actual library inside each transaction: autosave, CLI and restore writes all count,
 * without making the editor depend on a network service or on this lazy module. */
export class IndexedDbSyncLocal implements SyncLocalStore {
  constructor(
    readonly workspace: string,
    private readonly protectedMap: () => string | undefined = () => undefined,
  ) {}
  private guard(id: string) {
    if (this.protectedMap() === id) throw new Error("active-map");
  }
  async select(id: string, enabled: boolean) {
    const database = await getMapDatabase();
    const tx = database.transaction(["maps", "syncStates"], "readwrite");
    const stored = await tx.objectStore("syncStates").get(key(this.workspace, id));
    const doc = value(await tx.objectStore("maps").get(id));
    const record: SyncRecord = stored ?? {
      workspace: this.workspace,
      mapId: id,
      enabled,
      version: 0,
      observed: doc,
      base: null,
      baseEtag: null,
    };
    await tx.objectStore("syncStates").put({ ...record, enabled }, key(this.workspace, id));
    await tx.done;
  }
  async selectedIds() {
    return (await (await getMapDatabase()).getAll("syncStates"))
      .filter((row) => row.workspace === this.workspace && row.enabled)
      .map((row) => row.mapId);
  }
  async read(id: string) {
    this.guard(id);
    const database = await getMapDatabase();
    const tx = database.transaction(["maps", "syncStates", "recovery"], "readwrite");
    const row = await tx.objectStore("syncStates").get(key(this.workspace, id));
    if (!row?.enabled) throw new Error("not-selected");
    if (await tx.objectStore("recovery").get(id)) throw new Error("pending-local-save");
    const current = value(await tx.objectStore("maps").get(id));
    if (!sameSyncValue(current, row.observed)) {
      row.version++;
      row.observed = current;
      await tx.objectStore("syncStates").put(row, key(this.workspace, id));
    }
    await tx.done;
    return { version: row.version, value: current, base: row.base, baseEtag: row.baseEtag };
  }
  async apply(id: string, expectedVersion: number, remote: RemoteSnapshot) {
    this.guard(id);
    const database = await getMapDatabase();
    const tx = database.transaction(["maps", "syncStates", "recovery", "versions"], "readwrite");
    const row = await tx.objectStore("syncStates").get(key(this.workspace, id));
    const current = await tx.objectStore("maps").get(id);
    const draft = await tx.objectStore("recovery").get(id);
    if (
      !row?.enabled ||
      row.version !== expectedVersion ||
      draft ||
      !sameSyncValue(value(current), row.observed)
    ) {
      await tx.done;
      return false;
    }
    const changed = !sameSyncValue(value(current), remote.value);
    if (current && changed) {
      const ts = Date.now();
      const nodes = [current.root, ...(current.floatingTopics ?? [])];
      let nodeCount = 0;
      while (nodes.length) {
        const node = nodes.pop();
        if (node) {
          nodeCount++;
          nodes.push(...(node.children ?? []));
        }
      }
      await tx.objectStore("versions").put({
        id: `${id}:sync:${ts}`,
        mapId: id,
        ts,
        title: current.title,
        nodeCount,
        doc: current,
      });
      const history = await tx.objectStore("versions").index("by-map").getAll(id);
      history.sort((a, b) => b.ts - a.ts);
      for (const old of history.slice(MAX_VERSIONS))
        await tx.objectStore("versions").delete(old.id);
    }
    if (remote.value) {
      await tx.objectStore("maps").put(remote.value, id);
    } else if (current && !current.meta?.trashedAt) {
      // A remote tombstone is recoverable in Trash; keep versions and the original file untouched.
      await tx
        .objectStore("maps")
        .put({ ...current, meta: { ...current.meta, trashedAt: Date.now() } }, id);
    }
    await tx.objectStore("syncStates").put(
      {
        ...row,
        version: row.version + 1,
        observed: remote.value,
        base: remote.value,
        baseEtag: remote.etag,
      },
      key(this.workspace, id),
    );
    await tx.done;
    if (changed && typeof window !== "undefined")
      window.dispatchEvent(new Event("ithread:library-changed"));
    return true;
  }
  async preserveConflict(id: string, _expectedVersion: number, remote: RemoteSnapshot) {
    this.guard(id);
    const database = await getMapDatabase();
    const tx = database.transaction(["maps", "syncStates", "syncConflicts"], "readwrite");
    const row = await tx.objectStore("syncStates").get(key(this.workspace, id));
    if (!row?.enabled) throw new Error("not-selected");
    const conflictKey = JSON.stringify([this.workspace, id, remote.etag]);
    if (!(await tx.objectStore("syncConflicts").get(conflictKey))) {
      const conflict: SyncConflict = {
        workspace: this.workspace,
        mapId: id,
        local: value(await tx.objectStore("maps").get(id)),
        remote,
        savedAt: Date.now(),
      };
      await tx.objectStore("syncConflicts").put(conflict, conflictKey);
    }
    await tx.done;
  }
  async conflicts() {
    return (await (await getMapDatabase()).getAll("syncConflicts")).filter(
      (row) => row.workspace === this.workspace,
    );
  }
}
