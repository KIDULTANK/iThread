// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentMap } from "../src/agent/commands";
import { useCliBridge } from "../src/agent/useCliBridge";
import type { MindMapDoc } from "../src/model/types";

function desktopBridge(command: Record<string, unknown>) {
  return {
    checkForUpdates: vi.fn(),
    openReleasePage: vi.fn(),
    openFileDialog: vi.fn(),
    saveFileDialog: vi.fn(),
    readBoundFile: vi.fn(),
    writeBoundFile: vi.fn(),
    onOpenFile: vi.fn(),
    cliNextCommand: vi.fn().mockResolvedValueOnce(command).mockResolvedValue(null),
    cliPostResult: vi.fn().mockResolvedValue(true),
  } satisfies IThreadDesktopBridge;
}

function Harness({
  doc,
  replaceActive,
  refreshMaps,
}: {
  doc: MindMapDoc;
  replaceActive: (next: MindMapDoc) => boolean;
  refreshMaps: () => Promise<void>;
}) {
  const activeDoc = useRef(doc);
  useCliBridge({ activeDoc, openDoc: vi.fn(), replaceActive, refreshMaps });
  return null;
}

afterEach(() => {
  Reflect.deleteProperty(window, "iThreadDesktop");
  vi.restoreAllMocks();
});

describe("useCliBridge desktop transport", () => {
  it("applies one atomic batch and posts a compact result over IPC", async () => {
    const doc = createAgentMap("CLI map", "Root");
    const bridge = desktopBridge({
      requestId: "request-1",
      action: "batchTopics",
      mapId: doc.id,
      includeMap: false,
      operations: [
        { action: "addTopic", parentId: doc.root.id, id: "a", topic: "A" },
        { action: "addTopic", parentId: "a", id: "a1", topic: "A1" },
      ],
    });
    Object.defineProperty(window, "iThreadDesktop", { configurable: true, value: bridge });
    const replaceActive = vi.fn().mockReturnValue(true);
    const refreshMaps = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <Harness doc={doc} replaceActive={replaceActive} refreshMaps={refreshMaps} />,
    );

    await waitFor(() => expect(bridge.cliPostResult).toHaveBeenCalled(), { timeout: 2500 });
    expect(replaceActive).toHaveBeenCalledTimes(1);
    expect(replaceActive.mock.calls[0]?.[0].root.children[0]).toMatchObject({
      id: "a",
      topic: "A",
      children: [{ id: "a1", topic: "A1", children: [] }],
    });
    expect(bridge.cliPostResult).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          mapId: doc.id,
          nodeIds: ["a", "a1"],
          stats: expect.objectContaining({ topics: 3 }),
        }),
      }),
    );
    expect(bridge.cliPostResult.mock.calls[0]?.[1].result).not.toHaveProperty("map");
    view.unmount();
  });
});
