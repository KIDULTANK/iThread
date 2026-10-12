import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { MindMapDoc } from "../model/types";
import { type RemoteSnapshot, type SyncRepository, sameSyncValue } from "./engine";

const MAX_BYTES = 64 * 1024 * 1024;
const safeId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid sync map ID");
  return id;
};
function strongEtag(response: Response): string {
  const etag = response.headers.get("ETag");
  if (!etag || !/^"[^"\r\n]*"$/.test(etag)) throw new Error("Sync requires a strong ETag");
  return etag;
}
function parseDocument(value: unknown, id: string): MindMapDoc {
  if (!value || typeof value !== "object") throw new Error("Invalid sync document");
  const doc = value as MindMapDoc;
  if (doc.schemaVersion !== 1 || doc.id !== id || typeof doc.title !== "string")
    throw new Error("Unsupported sync document");
  if (doc.floatingTopics !== undefined && !Array.isArray(doc.floatingTopics))
    throw new Error("Invalid floating topics");
  if (
    doc.meta !== undefined &&
    (!doc.meta || typeof doc.meta !== "object" || Array.isArray(doc.meta))
  )
    throw new Error("Invalid sync metadata");
  const stack = [doc.root, ...(doc.floatingTopics ?? [])];
  const ids = new Set<string>();
  while (stack.length) {
    const node = stack.pop();
    if (
      !node ||
      typeof node.id !== "string" ||
      typeof node.topic !== "string" ||
      !Array.isArray(node.children) ||
      ids.has(node.id)
    )
      throw new Error("Invalid sync topic tree");
    ids.add(node.id);
    if (ids.size > 100_000) throw new Error("Sync topic limit exceeded");
    for (const child of node.children) stack.push(child);
  }
  return doc;
}

/** Transport only. Credentials are supplied by a platform-owned request function, not stored here.
 * The chosen remote directory must already exist and be dedicated to this sync library. */
export class WebDavRepository implements SyncRepository {
  private readonly root: URL;
  constructor(
    endpoint: string,
    private readonly request: typeof fetch = fetch,
  ) {
    this.root = new URL(endpoint);
    if (
      this.root.username ||
      this.root.password ||
      this.root.search ||
      this.root.hash ||
      !(
        this.root.protocol === "https:" ||
        (this.root.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(this.root.hostname))
      )
    )
      throw new Error("Sync endpoint requires HTTPS without embedded credentials");
    if (!this.root.pathname.endsWith("/")) this.root.pathname += "/";
  }
  private url(id: string) {
    return new URL(`${safeId(id)}.json`, this.root);
  }
  private async send(url: URL, init: RequestInit) {
    const response = await this.request(url, {
      ...init,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok && ![404, 412].includes(response.status))
      throw new Error(`Sync HTTP ${response.status}`);
    return response;
  }
  private async text(response: Response, limit = MAX_BYTES) {
    if (Number(response.headers.get("Content-Length")) > limit)
      throw new Error("Sync payload too large");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing sync response body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > limit) throw new Error("Sync payload too large");
        chunks.push(chunk.value);
      }
    } catch (err) {
      await reader.cancel().catch(() => {});
      throw err;
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  async list(): Promise<string[]> {
    const response = await this.send(this.root, {
      method: "PROPFIND",
      headers: { Depth: "1", "Content-Type": "application/xml" },
      body: '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
    });
    if (response.status !== 207) throw new Error("Invalid WebDAV directory response");
    const xml = await this.text(response, 2 * 1024 * 1024);
    if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true)
      throw new Error("Invalid WebDAV XML");
    const data = new XMLParser({ removeNSPrefix: true, processEntities: false }).parse(xml);
    const responses = data?.multistatus?.response;
    if (!responses) throw new Error("Missing WebDAV listing");
    const result = new Set<string>();
    for (const entry of Array.isArray(responses) ? responses : [responses]) {
      if (typeof entry.href !== "string") continue;
      const url = new URL(entry.href, this.root);
      if (
        url.origin !== this.root.origin ||
        !url.pathname.startsWith(this.root.pathname) ||
        url.search ||
        url.hash
      )
        continue;
      const match = url.pathname
        .slice(this.root.pathname.length)
        .match(/^([a-zA-Z0-9_-]{1,128})\.json$/);
      if (match) result.add(match[1]);
    }
    return [...result].sort();
  }
  async read(id: string): Promise<RemoteSnapshot> {
    const response = await this.send(this.url(id), { method: "GET" });
    if (response.status === 404) return { value: null, etag: null };
    if (response.status !== 200) throw new Error("Invalid sync read response");
    const payload = JSON.parse(await this.text(response));
    if (
      payload.protocolVersion !== 1 ||
      payload.mapId !== id ||
      typeof payload.deleted !== "boolean"
    )
      throw new Error("Unsupported sync protocol");
    if (payload.deleted && payload.document !== null) throw new Error("Invalid sync tombstone");
    return {
      etag: strongEtag(response),
      value: payload.deleted ? null : parseDocument(payload.document, id),
    };
  }
  async write(
    id: string,
    expectedEtag: string | null,
    value: MindMapDoc | null,
  ): Promise<RemoteSnapshot | null> {
    if (value) parseDocument(value, id);
    if (expectedEtag !== null && !/^"[^"\r\n]*"$/.test(expectedEtag))
      throw new Error("Invalid sync ETag");
    const body = JSON.stringify({
      protocolVersion: 1,
      mapId: id,
      deleted: value === null,
      document: value,
    });
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES)
      throw new Error("Sync payload too large");
    const response = await this.send(this.url(id), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(expectedEtag === null ? { "If-None-Match": "*" } : { "If-Match": expectedEtag }),
      },
      body,
    });
    if (response.status === 412) return null;
    if (![200, 201, 204].includes(response.status)) throw new Error("Invalid sync write response");
    // Some WebDAV servers omit ETag on PUT. Re-read; never acknowledge a different concurrent edit.
    const accepted = await this.read(id);
    return sameSyncValue(accepted.value, value) ? accepted : null;
  }
}
