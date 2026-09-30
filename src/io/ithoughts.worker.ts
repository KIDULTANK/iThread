import { fromIthoughts } from "./ithoughts";

interface WorkerScope {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage(message: unknown): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  try {
    scope.postMessage({ ok: true, doc: fromIthoughts(new Uint8Array(event.data)) });
  } catch (error) {
    scope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
