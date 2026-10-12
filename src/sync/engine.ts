import type { MindMapDoc } from "../model/types";

/** null is an explicit tombstone, never a request to permanently erase data. */
type Value = MindMapDoc | null;
export interface RemoteSnapshot {
  etag: string | null;
  value: Value;
}
export interface SyncRepository {
  list(): Promise<string[]>;
  read(id: string): Promise<RemoteSnapshot>;
  /** Return null if another device won the conditional write. */
  write(id: string, expectedEtag: string | null, value: Value): Promise<RemoteSnapshot | null>;
}
export interface LocalSnapshot {
  baseEtag?: string | null;
  version: number;
  value: Value;
  base: Value;
}
export interface SyncLocalStore {
  read(id: string): Promise<LocalSnapshot>;
  /** Atomically compare local version; false leaves a newer local edit intact and pending. */
  apply(id: string, expectedVersion: number, remote: RemoteSnapshot): Promise<boolean>;
  /** Persist both versions BEFORE considering a conflict handled. Must be idempotent by remote ETag. */
  preserveConflict(id: string, expectedVersion: number, remote: RemoteSnapshot): Promise<void>;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => [key, canonical(v)]),
  );
}
export function sameSyncValue(a: Value, b: Value): boolean {
  // Local autosave stamps updatedAt on every save; it is not an edit to map content.
  const content = (v: Value) => {
    if (!v) return null;
    const copy = { ...v, meta: { ...v.meta } };
    copy.meta.updatedAt = undefined;
    return canonical(copy);
  };
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}

export function planSync(local: Value, base: Value, remote: Value) {
  if (sameSyncValue(local, remote)) return "ack";
  if (sameSyncValue(local, base)) return "pull";
  if (sameSyncValue(remote, base)) return "push";
  return "conflict";
}

/** One map per operation: offline errors leave the local store untouched. No last-writer-wins. */
export async function syncMap(id: string, local: SyncLocalStore, repository: SyncRepository) {
  const snapshot = await local.read(id);
  const remote = await repository.read(id);
  // Physical absence after a previous sync is not a confirmed deletion. Only a versioned tombstone
  // may propagate deletion; a missing/restored server must never wipe the local library.
  if (remote.etag === null && (snapshot.base !== null || snapshot.baseEtag)) {
    await local.preserveConflict(id, snapshot.version, remote);
    return "conflict";
  }
  const plan = planSync(snapshot.value, snapshot.base, remote.value);
  if (plan === "conflict") {
    await local.preserveConflict(id, snapshot.version, remote);
    return "conflict";
  }
  let accepted = remote;
  if (plan === "push") {
    const written = await repository.write(id, remote.etag, snapshot.value);
    if (!written) return "retry";
    accepted = written;
  }
  if (!(await local.apply(id, snapshot.version, accepted))) return "retry";
  return plan;
}
