// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBranchFocus } from "../src/hooks/useBranchFocus";
import type { TopicNode } from "../src/mindmap/flow/types";
import { useAutoZoom } from "../src/mindmap/flow/useAutoZoom";
import type { MindMapDoc } from "../src/model/types";

const leaf = (id: string) => ({ id, topic: id, children: [] });
const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "map",
  title: "Map",
  root: {
    ...leaf("root"),
    children: [{ ...leaf("a"), children: [leaf("a1")] }, leaf("b"), leaf("c")],
  },
};

it("locks the entire selection, follows changes when asked, and resets for another map", () => {
  const { result, rerender } = renderHook(({ map, selection }) => useBranchFocus(map, selection), {
    initialProps: { map: doc, selection: ["a", "b"] },
  });
  act(() => result.current.setMode("locked"));
  rerender({ map: doc, selection: ["c"] });
  expect(result.current.litIds).toEqual(new Set(["root", "a", "a1", "b"]));
  act(() => result.current.setMode("follow"));
  expect(result.current.litIds).toEqual(new Set(["root", "c"]));
  rerender({ map: { ...doc, id: "other" }, selection: ["c"] });
  expect(result.current.mode).toBe("off");
  expect(result.current.litIds).toBeNull();
});

afterEach(() => vi.useRealTimers());
it("defers camera movement while editing and lets manual framing win until selection changes", () => {
  vi.useFakeTimers();
  const nodes = ["a", "b", "c"].map((id, x) => ({
    id,
    position: { x, y: 0 },
    hidden: id === "c",
  })) as TopicNode[];
  const fitView = vi.fn();
  const { result, rerender } = renderHook(
    ({ selected, editing }) =>
      useAutoZoom({
        enabled: true,
        selectedIds: new Set(selected),
        nodes,
        initialized: true,
        editing,
        busy: false,
        reducedMotion: true,
        fitView,
      }),
    { initialProps: { selected: ["a"], editing: true } },
  );
  act(() => vi.advanceTimersByTime(300));
  expect(fitView).not.toHaveBeenCalled();
  rerender({ selected: ["a"], editing: false });
  act(() => result.current());
  act(() => vi.advanceTimersByTime(300));
  expect(fitView).not.toHaveBeenCalled();
  rerender({ selected: ["b", "c"], editing: false });
  act(() => vi.advanceTimersByTime(300));
  expect(fitView).toHaveBeenCalledWith(
    expect.objectContaining({
      nodes: [{ id: "b" }],
      maxZoom: 1.25,
      duration: 0,
    }),
  );
});
