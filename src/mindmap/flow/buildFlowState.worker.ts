import { type BuildFlowStateArgs, buildFlowState } from "./buildFlowState";
import type { FlowStateWorkerResult } from "./flowStateWorkerClient";

interface WorkerRequest {
  requestId: number;
  args: BuildFlowStateArgs;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: FlowStateWorkerResult): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { requestId, args } = event.data;
  try {
    scope.postMessage({ requestId, ok: true, state: buildFlowState(args) });
  } catch (error) {
    scope.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
