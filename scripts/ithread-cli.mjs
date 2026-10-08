#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const argv = process.argv.slice(2);
const command = argv.shift() ?? "help";
const options = new Map();
for (let i = 0; i < argv.length; i += 1) {
  const key = argv[i];
  if (!key?.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
  const next = argv[i + 1];
  if (!next || next.startsWith("--")) options.set(key.slice(2), true);
  else {
    options.set(key.slice(2), next);
    i += 1;
  }
}
const value = (name, required = false) => {
  const result = options.get(name);
  if (required && (result === undefined || result === true)) throw new Error(`Missing --${name}`);
  return result === true ? true : result;
};

const help = `iThread CLI (controls the running local app)

  pnpm ithread status
  pnpm ithread maps
  pnpm ithread get [--map ID]
  pnpm ithread open --map ID
  pnpm ithread import --file PATH [--no-open]
  pnpm ithread import --stdin --name generated.md [--no-open]
  pnpm ithread export --file PATH [--map ID] [--format ithread|markdown]
  pnpm ithread create --title TEXT [--root TEXT] [--no-open]
  pnpm ithread batch --file OPERATIONS.json [--map ID] [--dry-run]
  pnpm ithread add --parent NODE_ID --topic TEXT [--map ID] [--index N]
  pnpm ithread update --node NODE_ID --topic TEXT [--map ID]
  pnpm ithread move --node NODE_ID --parent NODE_ID [--map ID] [--index N]
  pnpm ithread delete --node NODE_ID --confirm [--map ID]

The Windows app is discovered automatically. Development preview options:
  --url http://127.0.0.1:4174  --token TOKEN  --timeout MS  --compact  --include-map`;

function endpoint(baseUrl, token = "") {
  return { baseUrl: String(baseUrl).replace(/\/$/, ""), token: String(token || "") };
}

async function discoveryEndpoint() {
  const appData = process.env.APPDATA;
  if (!appData) return null;
  try {
    const discovery = JSON.parse(
      await readFile(join(appData, "iThread", "cli-bridge.json"), "utf8"),
    );
    if (discovery?.running && discovery.baseUrl && discovery.token)
      return endpoint(discovery.baseUrl, discovery.token);
  } catch {
    // The packaged app has not run yet, or its previous discovery record is incomplete.
  }
  return null;
}

async function request(target, route, init = {}) {
  const headers = new Headers(init.headers);
  if (target.token) headers.set("Authorization", `Bearer ${target.token}`);
  const response = await fetch(`${target.baseUrl}${route}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  return body;
}

let connected = null;
let connectedStatus = null;
async function connect() {
  if (connected) return { target: connected, status: connectedStatus };
  const explicitUrl = value("url");
  const candidates = explicitUrl
    ? [endpoint(explicitUrl, value("token") ?? process.env.ITHREAD_CLI_TOKEN)]
    : [await discoveryEndpoint(), endpoint("http://127.0.0.1:4174")].filter(Boolean);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const status = await request(candidate, "/__ithread_cli/v1/status", {
        signal: AbortSignal.timeout(2500),
      });
      connected = candidate;
      connectedStatus = status;
      return { target: candidate, status };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Cannot connect to iThread. Open the Windows app or the local preview first.${
      lastError instanceof Error ? ` (${lastError.message})` : ""
    }`,
  );
}

async function json(route, init) {
  const { target } = await connect();
  return request(target, route, init);
}

async function call(payload) {
  const { status } = await connect();
  if (!status.appConnected)
    throw new Error("iThread is running but its editor is not ready. Wait a moment and try again.");
  const accepted = await json("/__ithread_cli/v1/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const deadline = Date.now() + Number(value("timeout") ?? (command === "import" ? 120000 : 30000));
  while (Date.now() < deadline) {
    const result = await json(`/__ithread_cli/v1/commands/${accepted.id}/result`);
    if (result.status === "complete") {
      if (!result.payload.ok) throw new Error(result.payload.error);
      return result.payload.result;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for iThread command ${accepted.id}`);
}

async function stdinBytes() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main() {
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(help);
    return;
  }
  if (command === "status") {
    const { target, status } = await connect();
    console.log(JSON.stringify({ ...status, endpoint: target.baseUrl }, null, 2));
    return;
  }

  let payload;
  let exportPath = null;
  if (command === "maps") payload = { action: "listMaps" };
  else if (command === "get") payload = { action: "getMap", mapId: value("map") };
  else if (command === "open") payload = { action: "openMap", mapId: value("map", true) };
  else if (command === "import") {
    const fromStdin = value("stdin") === true;
    const fileOption = value("file");
    if (fromStdin === Boolean(fileOption))
      throw new Error("import requires exactly one of --file PATH or --stdin");
    const filePath = fromStdin ? null : String(fileOption);
    const bytes = fromStdin ? await stdinBytes() : await readFile(filePath);
    const fileName = fromStdin ? String(value("name", true)) : basename(filePath);
    payload = {
      action: "importFile",
      fileName,
      fileBase64: bytes.toString("base64"),
      open: !value("no-open"),
    };
  } else if (command === "export") {
    exportPath = String(value("file", true));
    const inferred = [".md", ".markdown"].includes(extname(exportPath).toLowerCase())
      ? "markdown"
      : "ithread";
    payload = {
      action: "exportMap",
      mapId: value("map"),
      format: value("format") ?? inferred,
    };
  } else if (command === "create") {
    payload = {
      action: "createMap",
      title: value("title", true),
      rootTopic: value("root"),
      open: !value("no-open"),
    };
  } else if (command === "batch") {
    const parsed = JSON.parse(await readFile(String(value("file", true)), "utf8"));
    const operations = Array.isArray(parsed) ? parsed : parsed?.operations;
    if (!Array.isArray(operations))
      throw new Error("Batch file must be an operation array or an object with operations");
    payload = {
      action: "batchTopics",
      mapId: value("map"),
      operations,
      dryRun: Boolean(value("dry-run")),
      includeMap: Boolean(value("include-map")),
    };
  } else if (command === "add") {
    payload = {
      action: "addTopic",
      mapId: value("map"),
      parentId: value("parent", true),
      topic: value("topic", true),
      id: value("id"),
      index: value("index") === undefined ? undefined : Number(value("index")),
      includeMap: Boolean(value("include-map")),
    };
  } else if (command === "update") {
    payload = {
      action: "updateTopic",
      mapId: value("map"),
      nodeId: value("node", true),
      topic: value("topic", true),
      includeMap: Boolean(value("include-map")),
    };
  } else if (command === "move") {
    payload = {
      action: "moveTopic",
      mapId: value("map"),
      nodeId: value("node", true),
      parentId: value("parent", true),
      index: value("index") === undefined ? undefined : Number(value("index")),
      includeMap: Boolean(value("include-map")),
    };
  } else if (command === "delete") {
    if (!value("confirm")) throw new Error("delete requires --confirm");
    payload = {
      action: "deleteTopic",
      mapId: value("map"),
      nodeId: value("node", true),
      confirm: true,
      includeMap: Boolean(value("include-map")),
    };
  } else throw new Error(`Unknown command: ${command}\n\n${help}`);

  const result = await call(payload);
  if (exportPath) {
    await writeFile(exportPath, result.contents, "utf8");
    const { contents: _contents, ...summary } = result;
    console.log(JSON.stringify({ ...summary, output: exportPath }, null, value("compact") ? 0 : 2));
    return;
  }
  console.log(JSON.stringify(result, null, value("compact") ? 0 : 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  process.exitCode = 1;
});
