const { randomUUID } = require("node:crypto");

const MAX_BYTES = 64 * 1024 * 1024;
function isTrustedSyncSender(event, contents, documentUrl) {
  if (!contents || event?.sender !== contents || event.senderFrame !== contents.mainFrame)
    return false;
  try {
    const actual = new URL(event.senderFrame.url);
    const expected = new URL(documentUrl);
    return (
      actual.protocol === "file:" &&
      expected.protocol === "file:" &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}
function directory(endpoint) {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "dav.jianguoyun.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith("/dav/")
  )
    throw new Error("Invalid sync endpoint");
  for (const segment of url.pathname.split("/")) {
    if (/[\\/]/.test(decodeURIComponent(segment))) throw new Error("Invalid sync path");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

/** A provider-scoped IPC service, not a general-purpose main-process HTTP proxy. */
function createSyncTransport({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const sessions = new Map();
  let active = 0;
  function close(owner, token) {
    const session = sessions.get(token);
    if (session?.owner !== owner) return false;
    sessions.delete(token);
    session.authorization = "";
    for (const controller of session.controllers) controller.abort();
    return true;
  }
  function sweep() {
    for (const [token, session] of sessions)
      if (session.expires < now()) close(session.owner, token);
  }
  const expiryTimer = setInterval(sweep, 30000);
  expiryTimer.unref?.();
  return {
    dispose() {
      clearInterval(expiryTimer);
      for (const [token, session] of sessions) close(session.owner, token);
    },
    connect(owner, input) {
      sweep();
      if (
        !input ||
        typeof input.endpoint !== "string" ||
        input.endpoint.length > 4096 ||
        typeof input.username !== "string" ||
        input.username.length > 256 ||
        input.username.includes(":") ||
        typeof input.password !== "string" ||
        input.password.length > 2048 ||
        /[\r\n]/.test(input.username + input.password) ||
        sessions.size >= 8
      )
        throw new Error("Invalid sync connection");
      const root = directory(input.endpoint);
      const token = randomUUID();
      sessions.set(token, {
        owner,
        root,
        authorization: `Basic ${Buffer.from(`${input.username}:${input.password}`, "utf8").toString("base64")}`,
        expires: now() + 10 * 60 * 1000,
        controllers: new Set(),
      });
      return token;
    },
    close,
    closeOwner(owner) {
      for (const [token, session] of sessions) if (session.owner === owner) close(owner, token);
    },
    async request(owner, token, input) {
      sweep();
      const session = sessions.get(token);
      if (
        !session ||
        session.owner !== owner ||
        active >= 2 ||
        !input ||
        typeof input.filename !== "string" ||
        !(
          input.filename === "" ||
          /^[a-zA-Z0-9_-]{1,128}(?:--[a-f0-9]{64}\.ithread-sync)?\.json$/.test(input.filename)
        ) ||
        !(input.filename === ""
          ? input.method === "PROPFIND"
          : ["GET", "PUT"].includes(input.method))
      )
        throw new Error("Invalid sync request");
      const headers = { Authorization: session.authorization };
      if (
        input.headers !== undefined &&
        (!input.headers || typeof input.headers !== "object" || Array.isArray(input.headers))
      )
        throw new Error("Invalid sync headers");
      for (const [name, value] of Object.entries(input.headers ?? {})) {
        if (
          !["content-type", "depth", "if-match", "if-none-match"].includes(name.toLowerCase()) ||
          typeof value !== "string" ||
          value.length > 512 ||
          /[\r\n]/.test(value)
        )
          throw new Error("Invalid sync headers");
        if (name.toLowerCase() === "depth" && value !== "1") throw new Error("Invalid sync depth");
        headers[name] = value;
      }
      if (
        input.body !== undefined &&
        (typeof input.body !== "string" || Buffer.byteLength(input.body, "utf8") > MAX_BYTES)
      )
        throw new Error("Invalid sync body");
      if (input.method === "GET" && input.body !== undefined) throw new Error("Invalid sync body");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      session.controllers.add(controller);
      active++;
      try {
        const response = await fetchImpl(new URL(input.filename, session.root), {
          method: input.method,
          headers,
          body: input.body,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });
        const limit = input.method === "PROPFIND" ? 2 * 1024 * 1024 : MAX_BYTES;
        if (Number(response.headers.get("content-length")) > limit) {
          await response.body?.cancel();
          throw new Error("Sync payload too large");
        }
        const chunks = [];
        let size = 0;
        const reader = response.body?.getReader();
        if (reader) {
          try {
            for (;;) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.byteLength;
              if (size > limit) throw new Error("Sync payload too large");
              chunks.push(part.value);
            }
          } catch (error) {
            await reader.cancel().catch(() => {});
            throw error;
          } finally {
            reader.releaseLock();
          }
        }
        const bytes = Buffer.concat(chunks, size);
        return {
          status: response.status,
          headers: Object.fromEntries(
            ["etag", "content-type", "content-length"].flatMap((name) =>
              response.headers.has(name) ? [[name, response.headers.get(name)]] : [],
            ),
          ),
          body: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        };
      } catch {
        throw new Error("Sync network request failed");
      } finally {
        clearTimeout(timer);
        session.controllers.delete(controller);
        active--;
      }
    },
  };
}
module.exports = { createSyncTransport, isTrustedSyncSender };
