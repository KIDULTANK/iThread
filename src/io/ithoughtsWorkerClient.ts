import type { MindMapDoc } from "../model/types";

/** Compressed file size at which ZIP/XML parsing moves off the UI thread. */
export const ITHOUGHTS_WORKER_THRESHOLD = 512 * 1024;

type WorkerResult = { ok: true; doc: MindMapDoc } | { ok: false; error: string };

export interface IthoughtsWorkerLike {
  onmessage: ((event: MessageEvent<WorkerResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: ArrayBuffer, transfer: Transferable[]): void;
  terminate(): void;
}

export type IthoughtsWorkerFactory = () => IthoughtsWorkerLike | null;

export function shouldParseIthoughtsInWorker(byteLength: number): boolean {
  return byteLength >= ITHOUGHTS_WORKER_THRESHOLD;
}

function createBrowserWorker(): IthoughtsWorkerLike | null {
  if (typeof Worker !== "function") return null;
  return new Worker(new URL("./ithoughts.worker.ts", import.meta.url), {
    type: "module",
    name: "ithread-itmz-parser",
  });
}

/**
 * Parse a large iThoughts archive without blocking pointer/keyboard/paint work. Small files and
 * environments without Web Worker support keep the proven synchronous parser as a fallback.
 */
export async function parseIthoughtsBytes(
  buffer: ArrayBuffer,
  workerFactory: IthoughtsWorkerFactory = createBrowserWorker,
): Promise<MindMapDoc> {
  if (!shouldParseIthoughtsInWorker(buffer.byteLength)) {
    const { fromIthoughts } = await import("./ithoughts");
    return fromIthoughts(new Uint8Array(buffer));
  }

  const worker = workerFactory();
  if (!worker) {
    const { fromIthoughts } = await import("./ithoughts");
    return fromIthoughts(new Uint8Array(buffer));
  }

  return new Promise<MindMapDoc>((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("iThoughts import timed out"));
    }, 120_000);
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onmessage = (event) => {
      finish();
      if (event.data.ok) resolve(event.data.doc);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "iThoughts background import failed"));
    };
    // Transfer ownership rather than copying a multi-megabyte archive to the worker.
    worker.postMessage(buffer, [buffer]);
  });
}
