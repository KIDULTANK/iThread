// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AltShortcutOverlay } from "../src/components/AltShortcutOverlay";

describe("AltShortcutOverlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const holdAlt = () => {
    fireEvent.keyDown(window, { key: "Alt" });
    act(() => vi.advanceTimersByTime(550));
  };

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
});
