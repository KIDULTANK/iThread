// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StartScreen } from "../src/components/start/StartScreen";
import { StartSidebar } from "../src/components/start/StartSidebar";
import { setLocale } from "../src/i18n";

vi.mock("../src/components/start/useLibrary", () => ({
  useLibrary: () => [],
  useFolders: () => [],
}));
describe("library settings entry", () => {
  beforeEach(() => setLocale("en"));
  it("offers a visible labeled gear in the left navigation", () => {
    const onSettings = vi.fn();
    render(
      <StartSidebar
        active="start"
        mapCount={0}
        onNavigate={vi.fn()}
        onNewMap={vi.fn()}
        onSettings={onSettings}
      />,
    );
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button.closest("nav")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Learn mind mapping" })).toBeNull();
    expect(button.querySelector("svg path")?.getAttribute("d")).toContain("9.5 3");
    fireEvent.click(button);
    expect(onSettings).toHaveBeenCalledOnce();
  });
  it("wires both the homepage button and Ctrl+comma to settings", () => {
    const onSettings = vi.fn();
    render(
      <StartScreen dark={false} onOpen={vi.fn()} onImportFiles={vi.fn()} onSettings={onSettings} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    expect(onSettings).toHaveBeenCalledTimes(2);
  });
});
