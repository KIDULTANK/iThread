// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTouchContextMenu } from "../src/hooks/useTouchContextMenu";

function event(overrides = {}) {
  const target = document.createElement("div");
  target.className = "react-flow__node";
  target.dataset.id = "synthetic";
  return {
    target,
    pointerType: "touch",
    isPrimary: true,
    pointerId: 1,
    clientX: 20,
    clientY: 30,
    ...overrides,
  } as unknown as PointerEvent<HTMLElement>;
}
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("touch topic menus", () => {
  it("opens after a stationary press and consumes the following click", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result } = renderHook(() => useTouchContextMenu(open));
    act(() => {
      result.current.onPointerDownCapture(event());
      vi.advanceTimersByTime(550);
    });
    expect(open).toHaveBeenCalledWith("synthetic", 20, 30);
    const click = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    result.current.onClickCapture(click);
    expect(click.stopPropagation).toHaveBeenCalledTimes(1);
  });
  it.each(["move", "pinch", "up", "cancel", "unmount"])("cancels on %s", (reason) => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result, unmount } = renderHook(() => useTouchContextMenu(open));
    act(() => result.current.onPointerDownCapture(event()));
    act(() => {
      if (reason === "move") result.current.onPointerMoveCapture(event({ clientX: 60 }));
      if (reason === "pinch")
        result.current.onPointerDownCapture(event({ pointerId: 2, isPrimary: false }));
      if (reason === "up") result.current.onPointerUpCapture();
      if (reason === "cancel") result.current.onPointerCancelCapture();
      if (reason === "unmount") unmount();
      vi.advanceTimersByTime(1000);
    });
    expect(open).not.toHaveBeenCalled();
  });
  it("does not take over mouse input or editor controls", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result } = renderHook(() => useTouchContextMenu(open));
    act(() => {
      result.current.onPointerDownCapture(event({ pointerType: "mouse" }));
      vi.advanceTimersByTime(1000);
      result.current.onPointerDownCapture(event({ target: document.createElement("textarea") }));
      vi.advanceTimersByTime(1000);
    });
    expect(open).not.toHaveBeenCalled();
  });
});
