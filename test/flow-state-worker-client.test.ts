import { describe, expect, it, vi } from "vitest";
import type { BuildFlowStateArgs } from "../src/mindmap/flow/buildFlowState";
import {
  FLOW_STATE_WORKER_THRESHOLD,
  type FlowStateWorkerLike,
  type FlowStateWorkerResult,
  countVisibleTopics,
  shouldBuildFlowStateInWorker,
  startFlowStateWorkerBuild,
} from "../src/mindmap/flow/flowStateWorkerClient";
import type { MindMapDoc } from "../src/model/types";

function chain(count: number): MindMapDoc {
  const root = { id: "n0", topic: "0", children: [] } as MindMapDoc["root"];
  let cursor = root;
  for (let i = 1; i < count; i += 1) {
    const child = { id: `n${i}`, topic: String(i), children: [] };
    cursor.children.push(child);
    cursor = child;
  }
  return { id: "map", title: "Map", root, schemaVersion: 1 };
}

function args(doc: MindMapDoc): BuildFlowStateArgs {
  return {
    doc,
    palette: ["#123456"],
    numbered: false,
    kind: "right",
    measured: [],
    selectedIds: new Set(),
    selectedEdgeId: null,
    litIds: null,
  };
}

class FakeWorker implements FlowStateWorkerLike {
  onmessage: ((event: MessageEvent<FlowStateWorkerResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

describe("large-map flow-state worker", () => {
  it("counts only visible topics and selects the worker at the threshold", () => {
    const doc = chain(FLOW_STATE_WORKER_THRESHOLD);
    expect(countVisibleTopics(doc)).toBe(FLOW_STATE_WORKER_THRESHOLD);
    expect(shouldBuildFlowStateInWorker(doc)).toBe(true);
    doc.root.children[0].collapsed = true;
    expect(countVisibleTopics(doc)).toBe(2);
    expect(shouldBuildFlowStateInWorker(doc)).toBe(false);
  });

  it("resolves a matching worker result and terminates the one-shot worker", async () => {
    const worker = new FakeWorker();
    const build = startFlowStateWorkerBuild(7, args(chain(2)), () => worker);
    expect(build).not.toBeNull();
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ requestId: 7 }));
    const state = { nodes: [], edges: [] };
    worker.onmessage?.({ data: { requestId: 7, ok: true, state } } as MessageEvent);
    await expect(build?.promise).resolves.toBe(state);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("cancels superseded work and rejects its promise", async () => {
    const worker = new FakeWorker();
    const build = startFlowStateWorkerBuild(8, args(chain(2)), () => worker);
    const rejection = expect(build?.promise).rejects.toThrow("cancelled");
    build?.cancel();
    await rejection;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
