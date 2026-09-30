import { describe, expect, it, vi } from "vitest";
import {
  ITHOUGHTS_WORKER_THRESHOLD,
  type IthoughtsWorkerLike,
  parseIthoughtsBytes,
  shouldParseIthoughtsInWorker,
} from "../src/io/ithoughtsWorkerClient";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "worker-doc",
  title: "Background import",
  root: { id: "root", topic: "Background import", children: [] },
};

class FakeWorker implements IthoughtsWorkerLike {
  onmessage: IthoughtsWorkerLike["onmessage"] = null;
  onerror: IthoughtsWorkerLike["onerror"] = null;
  terminate = vi.fn();
  posted: ArrayBuffer | null = null;
  transferred: Transferable[] = [];

  postMessage(message: ArrayBuffer, transfer: Transferable[]): void {
    this.posted = message;
    this.transferred = transfer;
    queueMicrotask(() => this.onmessage?.({ data: { ok: true, doc } } as MessageEvent));
  }
}

describe("iThoughts background parser", () => {
  it("uses a worker only once the compressed archive is large enough to cause visible blocking", () => {
    expect(shouldParseIthoughtsInWorker(ITHOUGHTS_WORKER_THRESHOLD - 1)).toBe(false);
    expect(shouldParseIthoughtsInWorker(ITHOUGHTS_WORKER_THRESHOLD)).toBe(true);
  });

  it("transfers the archive to the worker and terminates it after a successful parse", async () => {
    const worker = new FakeWorker();
    const buffer = new ArrayBuffer(ITHOUGHTS_WORKER_THRESHOLD);
    await expect(parseIthoughtsBytes(buffer, () => worker)).resolves.toEqual(doc);
    expect(worker.posted).toBe(buffer);
    expect(worker.transferred).toEqual([buffer]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("forwards a worker parse error and still terminates the worker", async () => {
    const worker = new FakeWorker();
    worker.postMessage = () =>
      queueMicrotask(() =>
        worker.onmessage?.({ data: { ok: false, error: "broken mapdata.xml" } } as MessageEvent),
      );
    await expect(
      parseIthoughtsBytes(new ArrayBuffer(ITHOUGHTS_WORKER_THRESHOLD), () => worker),
    ).rejects.toThrow("broken mapdata.xml");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
