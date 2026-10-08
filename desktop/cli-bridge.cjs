const { randomBytes, randomUUID, timingSafeEqual } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PROTOCOL_VERSION = 1;
const MAX_BODY_BYTES = 180 * 1024 * 1024;
const MAX_QUEUE = 100;
const ENTRY_TTL_MS = 10 * 60 * 1000;
const CAPABILITIES = [
  "listMaps",
  "getMap",
  "openMap",
  "createMap",
  "importFile",
  "exportMap",
  "addTopic",
  "updateTopic",
  "moveTopic",
  "deleteTopic",
  "batchTopics",
];

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (body === undefined) return res.end();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error("Command is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

/** A token-authenticated loopback server for the installed Windows app. The renderer receives
 * commands over IPC, so the bearer token never enters web content. */
async function createCliBridgeServer({ userDataPath = null, version = "0.0.0" } = {}) {
  const token = randomBytes(32).toString("hex");
  const queue = [];
  const results = new Map();
  let lastAppPoll = 0;
  let closed = false;

  const cleanup = () => {
    const cutoff = Date.now() - ENTRY_TTL_MS;
    while (queue[0]?.createdAt < cutoff) queue.shift();
    for (const [id, entry] of results) if (entry.createdAt < cutoff) results.delete(id);
  };
  const nextCommand = () => {
    cleanup();
    lastAppPoll = Date.now();
    const entry = queue.shift();
    return entry?.command ?? null;
  };
  const completeCommand = (id, payload) => {
    if (typeof id !== "string" || !id) throw new Error("Missing command id");
    results.set(id, { payload, createdAt: Date.now() });
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/__ithread_cli/v1/"))
      return send(res, 404, { error: "Not found" });
    if (req.headers.origin) return send(res, 403, { error: "Browser-origin CLI access denied" });
    const supplied = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(supplied, token)) return send(res, 401, { error: "Invalid CLI token" });
    cleanup();
    try {
      if (req.method === "GET" && url.pathname === "/__ithread_cli/v1/status") {
        return send(res, 200, {
          name: "iThread",
          version,
          protocolVersion: PROTOCOL_VERSION,
          transport: "desktop-loopback",
          appConnected: Date.now() - lastAppPoll < 2500,
          queued: queue.length,
          capabilities: CAPABILITIES,
        });
      }
      if (req.method === "POST" && url.pathname === "/__ithread_cli/v1/commands") {
        if (queue.length >= MAX_QUEUE) return send(res, 429, { error: "CLI queue is full" });
        const body = await readJson(req);
        if (!body || typeof body !== "object" || typeof body.action !== "string")
          return send(res, 400, { error: "Missing action" });
        const id = randomUUID();
        queue.push({ command: { ...body, requestId: id }, createdAt: Date.now() });
        return send(res, 202, { id });
      }
      const match = url.pathname.match(/^\/__ithread_cli\/v1\/commands\/([^/]+)\/result$/);
      if (match && req.method === "GET") {
        if (!results.has(match[1])) return send(res, 200, { status: "pending" });
        const payload = results.get(match[1]).payload;
        results.delete(match[1]);
        return send(res, 200, { status: "complete", payload });
      }
      return send(res, 404, { error: "Unknown CLI endpoint" });
    } catch (error) {
      return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("CLI bridge failed to bind");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const discoveryPath = userDataPath ? path.join(userDataPath, "cli-bridge.json") : null;
  if (discoveryPath) {
    mkdirSync(path.dirname(discoveryPath), { recursive: true });
    writeFileSync(
      discoveryPath,
      JSON.stringify({
        running: true,
        name: "iThread",
        version,
        protocolVersion: PROTOCOL_VERSION,
        baseUrl,
        token,
        pid: process.pid,
      }),
      { encoding: "utf8", mode: 0o600 },
    );
  }

  return {
    baseUrl,
    token,
    discoveryPath,
    nextCommand,
    completeCommand,
    close() {
      if (closed) return;
      closed = true;
      server.close();
      if (discoveryPath) {
        writeFileSync(
          discoveryPath,
          JSON.stringify({
            running: false,
            name: "iThread",
            version,
            protocolVersion: PROTOCOL_VERSION,
          }),
          { encoding: "utf8", mode: 0o600 },
        );
      }
    },
  };
}

module.exports = { CAPABILITIES, PROTOCOL_VERSION, createCliBridgeServer };
