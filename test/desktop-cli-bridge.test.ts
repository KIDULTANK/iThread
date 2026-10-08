import { execFile } from "node:child_process";
// @vitest-environment node
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

interface TestBridge {
  baseUrl: string;
  token: string;
  nextCommand(): Record<string, unknown> | null;
  completeCommand(id: string, payload: unknown): void;
  close(): void;
}

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../scripts/ithread-cli.mjs", import.meta.url));
const { createCliBridgeServer } = require("../desktop/cli-bridge.cjs") as {
  createCliBridgeServer(options: { userDataPath: null; version: string }): Promise<TestBridge>;
};

const bridges: TestBridge[] = [];
afterEach(() => {
  for (const bridge of bridges.splice(0)) bridge.close();
});

async function start(): Promise<TestBridge> {
  const bridge = await createCliBridgeServer({ userDataPath: null, version: "9.8.7" });
  bridges.push(bridge);
  return bridge;
}

describe("desktop CLI loopback bridge", () => {
  it("requires its discovery token and rejects browser-origin requests", async () => {
    const bridge = await start();
    const unauthenticated = await fetch(`${bridge.baseUrl}/__ithread_cli/v1/status`);
    expect(unauthenticated.status).toBe(401);

    const browserOrigin = await fetch(`${bridge.baseUrl}/__ithread_cli/v1/status`, {
      headers: { Authorization: `Bearer ${bridge.token}`, Origin: "https://example.com" },
    });
    expect(browserOrigin.status).toBe(403);
  });

  it("queues a command for the renderer and returns its result exactly once", async () => {
    const bridge = await start();
    const headers = {
      Authorization: `Bearer ${bridge.token}`,
      "Content-Type": "application/json",
    };
    const accepted = await fetch(`${bridge.baseUrl}/__ithread_cli/v1/commands`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "getMap", mapId: "map-1" }),
    });
    expect(accepted.status).toBe(202);
    const { id } = (await accepted.json()) as { id: string };
    expect(bridge.nextCommand()).toMatchObject({
      action: "getMap",
      mapId: "map-1",
      requestId: id,
    });

    bridge.completeCommand(id, { ok: true, result: { title: "Map" } });
    const completed = await fetch(`${bridge.baseUrl}/__ithread_cli/v1/commands/${id}/result`, {
      headers,
    });
    expect(await completed.json()).toEqual({
      status: "complete",
      payload: { ok: true, result: { title: "Map" } },
    });

    const consumed = await fetch(`${bridge.baseUrl}/__ithread_cli/v1/commands/${id}/result`, {
      headers,
    });
    expect(await consumed.json()).toEqual({ status: "pending" });
  });

  it("advertises the production transport and batch capability", async () => {
    const bridge = await start();
    bridge.nextCommand();
    const response = await fetch(`${bridge.baseUrl}/__ithread_cli/v1/status`, {
      headers: { Authorization: `Bearer ${bridge.token}` },
    });
    expect(await response.json()).toMatchObject({
      version: "9.8.7",
      protocolVersion: 1,
      transport: "desktop-loopback",
      appConnected: true,
      capabilities: expect.arrayContaining(["batchTopics", "exportMap"]),
    });
  });

  it("is controlled end-to-end by the shipped CLI with an explicit endpoint and token", async () => {
    const bridge = await start();
    bridge.nextCommand(); // renderer heartbeat
    const cli = execFileAsync(process.execPath, [
      cliPath,
      "maps",
      "--url",
      bridge.baseUrl,
      "--token",
      bridge.token,
    ]);

    let command: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 50 && !command; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      command = bridge.nextCommand();
    }
    expect(command).toMatchObject({ action: "listMaps" });
    bridge.completeCommand(String(command?.requestId), {
      ok: true,
      result: { maps: [{ id: "m1", title: "Map one" }], activeMapId: "m1" },
    });

    const { stdout } = await cli;
    expect(JSON.parse(stdout)).toEqual({
      maps: [{ id: "m1", title: "Map one" }],
      activeMapId: "m1",
    });
  });
});
