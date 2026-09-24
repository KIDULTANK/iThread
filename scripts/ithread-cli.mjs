#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

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
const base = String(options.get("url") ?? "http://127.0.0.1:4174").replace(/\/$/, "");
const value = (name, required = false) => {
  const result = options.get(name);
  if (required && (result === undefined || result === true)) throw new Error(`Missing --${name}`);
  return result === true ? true : result;
};

const help = `iThread CLI (controls the currently running local app)

  pnpm ithread status
  pnpm ithread maps
  pnpm ithread get [--map ID]
  pnpm ithread import --file PATH [--no-open]
  pnpm ithread create --title TEXT [--root TEXT] [--no-open]
  pnpm ithread add --parent NODE_ID --topic TEXT [--map ID] [--index N]
  pnpm ithread update --node NODE_ID --topic TEXT [--map ID]
  pnpm ithread move --node NODE_ID --parent NODE_ID [--map ID] [--index N]
  pnpm ithread delete --node NODE_ID --confirm [--map ID]

Options: --url http://127.0.0.1:4174  --compact`;

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  return body;
}

async function call(payload) {
  const status = await json("/__ithread_cli/v1/status");
  if (!status.appConnected)
    throw new Error(`iThread is not connected. Open ${base} in a browser first.`);
  const accepted = await json("/__ithread_cli/v1/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const deadline = Date.now() + Number(value("timeout") ?? (command === "import" ? 120000 : 15000));
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

let payload;
if (command === "help" || command === "--help" || command === "-h") {
  console.log(help);
  process.exit(0);
} else if (command === "status") {
  console.log(JSON.stringify(await json("/__ithread_cli/v1/status"), null, 2));
  process.exit(0);
} else if (command === "maps") payload = { action: "listMaps" };
else if (command === "get") payload = { action: "getMap", mapId: value("map") };
else if (command === "import") {
  const filePath = String(value("file", true));
  const bytes = await readFile(filePath);
  payload = {
    action: "importFile",
    fileName: basename(filePath),
    fileBase64: bytes.toString("base64"),
    open: !value("no-open"),
  };
} else if (command === "create")
  payload = {
    action: "createMap",
    title: value("title", true),
    rootTopic: value("root"),
    open: !value("no-open"),
  };
else if (command === "add")
  payload = {
    action: "addTopic",
    mapId: value("map"),
    parentId: value("parent", true),
    topic: value("topic", true),
    id: value("id"),
    index: value("index") === undefined ? undefined : Number(value("index")),
  };
else if (command === "update")
  payload = {
    action: "updateTopic",
    mapId: value("map"),
    nodeId: value("node", true),
    topic: value("topic", true),
  };
else if (command === "move")
  payload = {
    action: "moveTopic",
    mapId: value("map"),
    nodeId: value("node", true),
    parentId: value("parent", true),
    index: value("index") === undefined ? undefined : Number(value("index")),
  };
else if (command === "delete") {
  if (!value("confirm")) throw new Error("delete requires --confirm");
  payload = {
    action: "deleteTopic",
    mapId: value("map"),
    nodeId: value("node", true),
    confirm: true,
  };
} else throw new Error(`Unknown command: ${command}\n\n${help}`);

const result = await call(payload);
console.log(JSON.stringify(result, null, value("compact") ? 0 : 2));
