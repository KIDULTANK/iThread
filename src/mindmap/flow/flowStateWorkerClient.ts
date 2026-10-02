import type { MapNode, MindMapDoc } from "../../model/types";
import {
  type BuildFlowStateArgs,
  type BuildFlowStateResult,
  buildFlowState,
} from "./buildFlowState";

/** Above this many visible topics, projection + layout moves off the UI thread. */
export const FLOW_STATE_WORKER_THRESHOLD = 600;

export type FlowStateWorkerResult =
  | { requestId: number; ok: true; state: BuildFlowStateResult }
  | { requestId: number; ok: false; error: string };

export interface FlowStateWorkerLike {
  onmessage: ((event: MessageEvent<FlowStateWorkerResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { requestId: number; args: BuildFlowStateArgs }): void;
  terminate(): void;
}

export type FlowStateWorkerFactory = () => FlowStateWorkerLike | null;

export interface FlowStateWorkerBuild {
  promise: Promise<BuildFlowStateResult>;
  cancel(): void;
}

function countVisibleBranch(node: MapNode): number {
  let count = 0;
  const pending = [node];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    count += 1;
    if (!current.collapsed) pending.push(...current.children);
  }
  return count;
}

/** Mirrors project()'s collapse rules without allocating React Flow nodes or edges. */
export function countVisibleTopics(doc: MindMapDoc): number {
  let count = countVisibleBranch(doc.root);
  for (const floating of doc.floatingTopics ?? []) count += countVisibleBranch(floating);
  return count;
}

export function shouldBuildFlowStateInWorker(doc: MindMapDoc): boolean {
  return countVisibleTopics(doc) >= FLOW_STATE_WORKER_THRESHOLD;
}

function createBrowserWorker(): FlowStateWorkerLike | null {
  if (typeof Worker !== "function") return null;
  try {
    return new Worker(new URL("./buildFlowState.worker.ts", import.meta.url), {
      type: "module",
      name: "ithread-map-layout",
    });
  } catch {
    return null;
  }
}

let sharedWorker: FlowStateWorkerLike | null = null;

function acquireSharedWorker(): FlowStateWorkerLike | null {
  sharedWorker ??= createBrowserWorker();
  return sharedWorker;
}

function terminateSharedWorker(worker: FlowStateWorkerLike): void {
  worker.terminate();
  if (sharedWorker === worker) sharedWorker = null;
}

function startBuild(
  requestId: number,
  args: BuildFlowStateArgs,
  worker: FlowStateWorkerLike,
  keepWarm: boolean,
): FlowStateWorkerBuild {
  let settled = false;
  let rejectPromise: ((reason: Error) => void) | null = null;
  const finish = (terminate: boolean) => {
    if (settled) return false;
    settled = true;
    worker.onmessage = null;
    worker.onerror = null;
    if (terminate) {
      if (keepWarm) terminateSharedWorker(worker);
      else worker.terminate();
    }
    return true;
  };
  const promise = new Promise<BuildFlowStateResult>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (event) => {
      const mismatch = event.data.requestId !== requestId;
      if (!finish(mismatch || !keepWarm)) return;
      if (mismatch) {
        reject(new Error("Background layout returned a mismatched request"));
      } else if (event.data.ok) {
        resolve(event.data.state);
      } else {
        if (keepWarm) terminateSharedWorker(worker);
        reject(new Error(event.data.error));
      }
    };
    worker.onerror = (event) => {
      if (!finish(true)) return;
      reject(new Error(event.message || "Background layout failed"));
    };
    try {
      worker.postMessage({ requestId, args });
    } catch (error) {
      finish(true);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return {
    promise,
    cancel() {
      // JavaScript workers cannot interrupt a running synchronous layout. Terminating only the
      // superseded worker avoids a queue of stale maps, while completed builds reuse the warm worker.
      if (!finish(true)) return;
      rejectPromise?.(new Error("Background layout cancelled"));
    },
  };
}

/**
 * Start one isolated background layout. The caller owns freshness: cancelling a superseded build
 * terminates its worker, so a late result can never mutate the current canvas.
 */
export function startFlowStateWorkerBuild(
  requestId: number,
  args: BuildFlowStateArgs,
  workerFactory?: FlowStateWorkerFactory,
): FlowStateWorkerBuild | null {
  // Injected workers remain isolated for deterministic tests and embedders. Browser builds keep a
  // successfully completed worker warm, preserving its layout cache across ordinary edits.
  const keepWarm = workerFactory === undefined;
  const worker = workerFactory ? workerFactory() : acquireSharedWorker();
  if (!worker) return null;
  return startBuild(requestId, args, worker, keepWarm);
}

/** Synchronous fallback used when Workers are unavailable or a background build fails. */
export function buildFlowStateFallback(args: BuildFlowStateArgs): BuildFlowStateResult {
  return buildFlowState(args);
}
