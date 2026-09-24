import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ShortcutsDialog } from "../src/components/ShortcutsDialog";

// The cheat-sheet renders inside the shared native-<dialog> wrapper. jsdom's <dialog> modal methods
// can be absent depending on version, so guard-stub them (no-op when the real impl exists).
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  }
});

describe("ShortcutsDialog (#2)", () => {
  it("renders the grouped cheat-sheet from the central shortcut map", () => {
    render(<ShortcutsDialog open={true} onClose={() => {}} />);
    expect(screen.getByText("Keyboard shortcuts")).toBeTruthy();
    // Grouped by Editing / Navigation / View, sourced from src/shortcuts.ts.
    expect(screen.getByText("Editing")).toBeTruthy();
    expect(screen.getByText("Navigation")).toBeTruthy();
    expect(screen.getByText("View")).toBeTruthy();
    // A couple of real bindings appear.
    expect(screen.getByText("Add a sibling topic")).toBeTruthy();
    expect(screen.getByText("Open the command palette (do anything)")).toBeTruthy();
  });

  it("renders without a duplicate React key warning when an action has two bindings", () => {
    // "Open the selected topic's note" is bound to BOTH Ctrl/⌘+T and F4, so the row key can't be `action`
    // alone (that flooded the console with "two children with the same key" on every editor render).
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ShortcutsDialog open={true} onClose={() => {}} />);
    expect(screen.getAllByText("Open the selected topic's note").length).toBe(2); // both render
    const dupKeyWarning = err.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("same key")),
    );
    expect(dupKeyWarning).toBe(false);
    err.mockRestore();
  });

  it("closes via the ✕ button", () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
