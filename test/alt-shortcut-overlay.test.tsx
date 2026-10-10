// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AltShortcutOverlay } from "../src/components/AltShortcutOverlay";
import { INTERACTION_PREF_KEY } from "../src/store/interactionPrefs";

describe("AltShortcutOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(INTERACTION_PREF_KEY);
  });
  afterEach(() => vi.useRealTimers());

  const holdAlt = () => {
    fireEvent.keyDown(window, { key: "Alt" });
    act(() => vi.advanceTimersByTime(550));
  };

  it("uses the configured hold delay", () => {
    localStorage.setItem(INTERACTION_PREF_KEY, JSON.stringify({ altDelay: 800 }));
    render(<AltShortcutOverlay />);
    fireEvent.keyDown(window, { key: "Alt" });
    act(() => vi.advanceTimersByTime(799));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("does not reveal when disabled in preferences", () => {
    localStorage.setItem(INTERACTION_PREF_KEY, JSON.stringify({ altHelp: false }));
    render(<AltShortcutOverlay />);
    fireEvent.keyDown(window, { key: "Alt" });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows only after Alt is held, then closes on release", () => {
    render(<AltShortcutOverlay />);
    fireEvent.keyDown(window, { key: "Alt" });
    act(() => vi.advanceTimersByTime(549));
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
    fireEvent.keyUp(window, { key: "Alt" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  it("cancels the reveal when Alt becomes part of a real shortcut chord", () => {
    render(<AltShortcutOverlay />);
    fireEvent.keyDown(window, { key: "Alt" });
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  it("closes on Escape while Alt is held", () => {
    render(<AltShortcutOverlay />);
    holdAlt();
    fireEvent.keyDown(window, { key: "Escape", altKey: true });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  it("shows one shortcut category per page and changes pages by click", () => {
    render(<AltShortcutOverlay />);
    holdAlt();
    expect(screen.getByRole("region", { name: "Editing" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Selection & moving" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next ›" }));
    expect(screen.getByRole("region", { name: "Editing" })).toBeTruthy();
    expect(screen.getByText("2 / 7")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "3 / 7 · Selection & moving" }));
    expect(screen.getByRole("region", { name: "Selection & moving" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1 / 7 · Editing 1/2" }));
    expect(screen.getByRole("region", { name: "Editing" })).toBeTruthy();
  });

  it("owns Alt+Arrow keys while visible, paging without running canvas shortcuts", () => {
    render(<AltShortcutOverlay />);
    const canvasKey = vi.fn();
    document.addEventListener("keydown", canvasKey);
    window.addEventListener("keydown", canvasKey);
    try {
      holdAlt();
      canvasKey.mockClear();
      const press = (key: string, repeat = false) => {
        const event = new KeyboardEvent("keydown", {
          key,
          altKey: true,
          repeat,
          bubbles: true,
          cancelable: true,
        });
        fireEvent(document.body, event);
        expect(event.defaultPrevented).toBe(true);
      };
      press("ArrowLeft");
      expect(screen.getByText("1 / 7")).toBeTruthy();
      press("ArrowRight");
      expect(screen.getByText("2 / 7")).toBeTruthy();
      press("ArrowRight", true);
      expect(screen.getByText("3 / 7")).toBeTruthy();
      press("ArrowLeft");
      expect(screen.getByText("2 / 7")).toBeTruthy();
      for (let index = 0; index < 10; index++) press("ArrowRight");
      expect(screen.getByText("7 / 7")).toBeTruthy();
      press("ArrowUp");
      press("p");
      expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
      expect(canvasKey).not.toHaveBeenCalled();
      fireEvent.keyUp(document.body, { key: "Alt", bubbles: true });
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true });
      expect(canvasKey).toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", canvasKey);
      window.removeEventListener("keydown", canvasKey);
    }
  });

  it("restores shortcuts after dismissal and can reveal again", () => {
    render(<AltShortcutOverlay />);
    holdAlt();
    fireEvent.blur(window);
    expect(screen.queryByRole("dialog")).toBeNull();
    holdAlt();
    expect(screen.getByRole("dialog")).toBeTruthy();
    const backdrop = screen.getByRole("dialog").parentElement;
    if (!backdrop) throw new Error("Shortcut backdrop missing");
    fireEvent.pointerDown(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyUp(window, { key: "Alt" });
    holdAlt();
    expect(screen.getByText("1 / 7")).toBeTruthy();
  });
});
