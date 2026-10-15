import type { MindMapDoc } from "../model/types";
import { type RemoteSnapshot, sameSyncValue } from "./engine";
import { WebDavRepository, parseSyncDocument } from "./webdav";

const HASH = /^[a-f0-9]{64}$/;
const SUFFIX = ".ithread-sync.json";
const MAX_REVISIONS = 256;
const MAX_HISTORY_BYTES = 128 * 1024 * 1024;
type Revision = {
  protocolVersion: 2;
  mapId: string;
  nonce: string;
  parents: string[];
  deleted: boolean;
  document: MindMapDoc | null;
};
async function digest(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function safeId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid sync map ID");
  return id;
}

/** Immutable, content-addressed revisions. Concurrent writers create separate heads, never replace
 * a shared file. No dependency on a provider's ETag syntax or If-None-Match implementation. */
export class HistoryWebDavRepository extends WebDavRepository {
  override async list() {
    const ids = new Set<string>();
    for (const filename of await this.filenames()) {
      const match = filename.match(/^([a-zA-Z0-9_-]{1,128})--[a-f0-9]{64}\.ithread-sync\.json$/);
      if (match) ids.add(match[1]);
    }
    return [...ids].sort();
  }
  override async read(
    id: string,
  ): Promise<RemoteSnapshot & { revisionCount: number; byteCount: number }> {
    safeId(id);
    const filenames = await this.filenames();
    if (filenames.includes(`${id}.json`)) throw new Error("legacy-sync-format");
    const hashes = filenames
      .filter((name) => name.startsWith(`${id}--`) && name.endsWith(SUFFIX))
      .map((name) => name.slice(id.length + 2, -SUFFIX.length))
      .filter((hash) => HASH.test(hash));
    if (hashes.length > MAX_REVISIONS) throw new Error("sync-history-limit");
    if (!hashes.length) return { etag: null, value: null, revisionCount: 0, byteCount: 0 };
    const records = new Map<string, Revision>();
    let byteCount = 0;
    for (const hash of hashes) {
      const response = await this.send(new URL(`${id}--${hash}${SUFFIX}`, this.root), {
        method: "GET",
      });
      if (response.status !== 200) throw new Error("Incomplete sync history");
      const text = await this.text(response);
      byteCount += new TextEncoder().encode(text).byteLength;
      if (byteCount > MAX_HISTORY_BYTES) throw new Error("sync-history-limit");
      if ((await digest(text)) !== hash) throw new Error("Sync history integrity failure");
      const record = JSON.parse(text) as Revision;
      if (
        record.protocolVersion !== 2 ||
        record.mapId !== id ||
        typeof record.nonce !== "string" ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(record.nonce) ||
        !Array.isArray(record.parents) ||
        record.parents.length > MAX_REVISIONS ||
        new Set(record.parents).size !== record.parents.length ||
        !record.parents.every(
          (parent) => typeof parent === "string" && HASH.test(parent) && parent !== hash,
        ) ||
        typeof record.deleted !== "boolean" ||
        (record.deleted && record.document !== null)
      )
        throw new Error("Invalid sync revision");
      if (!record.deleted) parseSyncDocument(record.document, id);
      records.set(hash, record);
    }
    const parents = new Set([...records.values()].flatMap((record) => record.parents));
    if ([...parents].some((parent) => !records.has(parent)))
      throw new Error("Incomplete sync history");
    const heads = [...records.keys()].filter((hash) => !parents.has(hash)).sort();
    const reachable = new Set<string>();
    const pending = [...heads];
    while (pending.length) {
      const hash = pending.pop();
      if (hash && !reachable.has(hash)) {
        reachable.add(hash);
        pending.push(...(records.get(hash)?.parents ?? []));
      }
    }
    if (!heads.length || reachable.size !== records.size)
      throw new Error("Invalid sync history graph");
    const snapshots = heads.map((hash) => ({
      etag: `j2:${hash}`,
      value: records.get(hash)?.document ?? null,
    }));
    return {
      etag: `j2:${heads.join(",")}`,
      value: snapshots[0].value,
      ancestors: [...records.keys()].map((hash) => `j2:${hash}`),
      ...(heads.length > 1 ? { conflicts: snapshots } : {}),
      revisionCount: records.size,
      byteCount,
    };
  }
  override async write(
    id: string,
    expectedEtag: string | null,
    value: MindMapDoc | null,
  ): Promise<RemoteSnapshot | null> {
    safeId(id);
    if (value) parseSyncDocument(value, id);
    const current = await this.read(id);
    if (current.etag !== expectedEtag) return null;
    if (current.revisionCount >= MAX_REVISIONS) throw new Error("sync-history-limit");
    const record: Revision = {
      protocolVersion: 2,
      mapId: id,
      nonce: crypto.randomUUID(),
      parents: current.etag ? current.etag.slice(3).split(",") : [],
      deleted: value === null,
      document: value,
    };
    const body = JSON.stringify(record);
    const bytes = new TextEncoder().encode(body).byteLength;
    if (bytes > 64 * 1024 * 1024 || bytes + current.byteCount > MAX_HISTORY_BYTES)
      throw new Error("sync-history-limit");
    const hash = await digest(body);
    const response = await this.send(new URL(`${id}--${hash}${SUFFIX}`, this.root), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (![200, 201, 204].includes(response.status)) throw new Error("Sync revision upload failed");
    const accepted = await this.read(id);
    // A concurrent fork is kept remotely and handled as a conflict on the next pass.
    return !accepted.conflicts &&
      accepted.etag === `j2:${hash}` &&
      sameSyncValue(accepted.value, value)
      ? accepted
      : null;
  }
}
