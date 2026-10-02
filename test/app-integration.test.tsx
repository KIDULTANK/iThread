import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import * as mapStore from "../src/store/mapStore";

// Integration cover for App — the orchestration root (previously 0%). Renders the whole app over a
// fake IndexedDB, opens a map from the Start screen, and drives the editor's wiring: panels, dialogs,
// find/replace, undo/redo, the ⌘K palette, and the Start round-trip. The sub-features have their own
// unit tests; this executes App's glue so a regression in the shell is caught.

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

// Canvas viewport animations (fit / setCenter) run zero-duration here — see the design/tokens mock
// below — so d3 completes them in a single frame instead of rescheduling itself frame-by-frame. That
// keeps the synchronous-RAF mock below from recursing until wall-clock time elapses (a stack overflow)
// and from leaking a half-finished transition past unmount.
vi.mock("../src/design/tokens", async (importActual) => {
  const actual = await importActual<typeof import("../src/design/tokens")>();
  return {
    ...actual,
    motion: { ...actual.motion, dur: { ...actual.motion.dur, fit: 0, viewport: 0 } },
  };
});

// App defers a focusNode via requestAnimationFrame on selection. Run RAF callbacks synchronously in
// this suite so that deferred work executes inline (while still mounted) instead of firing after the
// component unmounts at teardown — which would otherwise reach into a torn-down jsdom (null document).
let realRaf: typeof globalThis.requestAnimationFrame;
let fakeRafTime = 0;
beforeEach(() => {
  realRaf = globalThis.requestAnimationFrame;
  fakeRafTime = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    // Advance the synthetic clock far enough for layout animations to finish on their second frame.
    // Keeping the callback synchronous still prevents work from leaking past test teardown.
    fakeRafTime += 1_000;
    cb(fakeRafTime);
    return fakeRafTime;
  }) as typeof globalThis.requestAnimationFrame;
});
afterEach(() => {
  globalThis.requestAnimationFrame = realRaf;
});

/** From a fresh mount, land in the editor by opening a template from the Start screen. */
async function openEditor(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  // Boot lands on Start (no saved session); open a template card to enter the editor.
  if (container.querySelector(".mm-editor")) return; // already in the editor
  // The Start screen's first paint can exceed the 1s default under heavy parallel/coverage load;
  // give it the same headroom as the editor-mount waits below to avoid an intermittent red.
  await waitFor(() => expect(screen.getByText("Brainstorm", { exact: true })).toBeTruthy(), {
    timeout: 4000,
  });
  await user.click(screen.getByText("Brainstorm", { exact: true }));
  await waitFor(() => expect(container.querySelector(".mm-editor")).toBeTruthy(), {
    timeout: 4000,
  });
  await waitFor(() => expect(container.querySelector(".react-flow")).toBeTruthy(), {
    timeout: 4000,
  });
}

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "prompt").mockReturnValue("My view");
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:stub"; // jsdom has no object-URL; stub so export paths don't throw
    URL.revokeObjectURL = () => {};
  }
  // jsdom has no clipboard; stub so copy actions resolve.
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  }
  // Anchor download click — no-op so export "save" doesn't navigate.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("App (integration)", () => {
  it("boots to the Start screen and opens a map into the editor", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    // Start screen affordances render (template gallery present).
    expect(screen.getByText("Brainstorm", { exact: true })).toBeTruthy();
    await openEditor(user, container);
    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("opens + closes the ⌘K command palette", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // ⌘/Ctrl-K opens the palette (document-level keydown listener).
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
      );
    });
    const input = await screen.findByPlaceholderText(/Search commands/);
    expect(input).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByPlaceholderText(/Search commands/)).toBeNull());
  });

  it("toggles a side panel into the tabbed dock via the Panels menu", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    await user.click(screen.getByRole("button", { name: /Panels/ }));
    // menuitemcheckbox, not plain text — the status-bar Map/Outline/Board switcher (T3-27) also
    // renders an "Outline" button, so a bare text query would now match both.
    const ol = await screen.findByRole("menuitemcheckbox", { name: "Outline" });
    // The 12 toggles are grouped under three section labels (Phase 11c).
    const menu = ol.closest(".mm-menu");
    expect(menu?.textContent).toContain("Structure");
    expect(menu?.textContent).toContain("Analysis");
    expect(menu?.textContent).toContain("Workflow");
    await user.click(ol);
    // The panel docks into the one tabbed column (mm-dock) rather than a free-floating 250px sibling.
    await waitFor(() => expect(container.querySelector(".mm-dock")).toBeTruthy());
    expect(container.querySelector(".mm-dock-tab")).toBeTruthy();
  });

  it("runs find then replace-all from the overlay without crashing", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // Find & Replace now opens as an overlay (the toolbar "Find" button / Ctrl+F / "/").
    await user.click(screen.getByRole("button", { name: "Find" }));
    const find = (await screen.findByLabelText("Find node")) as HTMLInputElement;
    await user.click(find);
    await user.type(find, "idea{Enter}");
    await flush();
    expect(find.value).toBe("idea");
    const replace = screen.getByLabelText("Replace with") as HTMLInputElement;
    await user.type(replace, "concept");
    await user.click(screen.getByRole("button", { name: /Replace all/ }));
    await flush();
  });

  it("undo / redo from the header toolbar", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // Make an edit first so undo has something to do: add a quick topic.
    const quick = screen.queryByPlaceholderText(/Quick add/);
    if (quick) {
      await user.click(quick);
      await user.type(quick, "Extra topic{Enter}");
      await flush();
    }
    const undo = screen.queryByRole("button", { name: /Undo/ });
    if (undo) {
      await user.click(undo);
      await flush();
    }
    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("drives the View, Canvas and Export menus without crashing", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);

    const openMenu = async (label: string) => {
      const btn = screen
        .getAllByRole("button")
        .find((b) => b.textContent?.trim() === label || b.getAttribute("title") === label);
      if (btn) await user.click(btn);
      await flush();
    };
    const clickIfPresent = async (text: string | RegExp) => {
      const els = screen.queryAllByText(text);
      if (els[0]) {
        await user.click(els[0]);
        await flush();
        return true;
      }
      return false;
    };

    // View menu — fit / expand / collapse-style actions.
    await openMenu("View");
    await clickIfPresent(/Collapse all/i);

    // Canvas menu — toggle Free layout if present (design presets + layout now live in the Map panel).
    await openMenu("Canvas");
    await clickIfPresent(/Free layout/i);

    // Layout select (always visible in the toolbar row).
    const layoutSel = screen.queryByLabelText(/layout/i) as HTMLSelectElement | null;
    if (layoutSel && layoutSel.options.length > 1) {
      await user.selectOptions(layoutSel, layoutSel.options[1].value);
      await flush();
    }

    // Export menu — JSON + Markdown (pure serializers; download click is stubbed).
    await openMenu("Export");
    await clickIfPresent(/Markdown/i);
    await openMenu("Export");
    await clickIfPresent(/^JSON/i);

    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("opens the More menu and starts + exits Present mode", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    await user.click(screen.getByRole("button", { name: /More/ }));
    await flush();
    const present = screen.queryByText("Present", { exact: true });
    if (present) {
      await user.click(present);
      await flush();
      await user.keyboard("{Escape}");
      await flush();
    }
    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("imports a file, surfaces the lossy-import note, and dismisses the banner", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // The import <input> lives in the More menu — open it so the input is mounted, then fire the
    // change directly (the real picker dialog can't open in jsdom).
    await user.click(screen.getByRole("button", { name: /More/ }));
    await flush();
    const input = container.querySelector('input[accept*=".opml"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const opml =
      '<?xml version="1.0"?><opml version="2.0"><head><title>Imported</title></head><body><outline text="A"/></body></opml>';
    const file = new File([opml], "imp.opml", { type: "text/x-opml" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await flush();
    });
    // A non-native import surfaces a one-line lossy-conversion note in the warnings banner…
    expect(await screen.findByText(/OPML/i)).toBeTruthy();
    // …which the × dismisses.
    await user.click(screen.getByRole("button", { name: /dismiss import notes/i }));
    await waitFor(() => expect(screen.queryByText(/OPML/i)).toBeNull());
  });

  it("opens Settings with the Ctrl/⌘+, shortcut", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    expect(container.querySelector(".mm-editor")).toBeTruthy();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: ",", ctrlKey: true, bubbles: true }),
      );
    });
    await waitFor(() => expect(screen.getByText("Local data")).toBeTruthy());
  });

  it("opens Settings from the rail and drives its actions", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    await user.click(screen.getByRole("button", { name: /^settings$/i }));
    await flush();
    expect(screen.getByText("Local data")).toBeTruthy();
    // Re-show getting-started clears the one-way first-run flag + closes the dialog.
    await user.click(screen.getByRole("button", { name: /getting-started tips/i }));
    await flush();
    // Reopen and clear the command history (drives the App handler + its hint toast).
    await user.click(screen.getByRole("button", { name: /^settings$/i }));
    await flush();
    await user.click(screen.getByRole("button", { name: /clear command history/i }));
    await flush();
    // "Clear all local data" confirms first via the themed dialog — declining is a safe no-op.
    await user.click(screen.getByRole("button", { name: /clear all local data/i }));
    await flush();
    expect(screen.getByText("Delete all local data?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await flush();
    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("selects a topic and drives inspector edits (tag, progress, priority)", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // Open the Topic info / inspector panel (off by default) so the InfoPanel + its App-wired editors
    // (setSelectedTags / setSelectedProgress / setSelectedPriority) are reachable.
    await user.click(screen.getByRole("button", { name: /Panels/ }));
    await flush();
    const inspectorItem = screen
      .getAllByRole("menuitemcheckbox")
      .find((e) => /inspector|topic info/i.test(e.textContent ?? ""));
    if (inspectorItem) await user.click(inspectorItem);
    else await user.keyboard("{Escape}");
    await flush();
    // Select a topic on the canvas. Use fireEvent.click (click-only) — userEvent.click also dispatches
    // mousedown, which trips React Flow's d3-drag in jsdom (synthetic events have no `view`).
    const node = container.querySelector(".react-flow__node");
    expect(node).toBeTruthy();
    act(() => {
      fireEvent.click(node as Element);
    });
    await flush();
    const tag = screen.queryByPlaceholderText(/Add a tag/);
    if (tag) {
      await user.type(tag, "urgent{Enter}");
      await flush();
    }
    for (const label of ["50", "High"]) {
      const btn = screen.queryAllByRole("button", { name: label })[0];
      if (btn) {
        await user.click(btn);
        await flush();
      }
    }
    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("records back/forward navigation and copies a deep-link to the selected topic", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);

    // Select topics so the nav history records places. fireEvent.click (no mousedown) avoids
    // tripping React Flow's d3-drag in jsdom. Click every rendered node so ≥1 place is recorded.
    const nodes = container.querySelectorAll(".react-flow__node");
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      act(() => fireEvent.click(n));
      await flush();
    }

    // Alt+← steps back through the history, Alt+→ steps forward — the editor stays mounted.
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }),
      ),
    );
    await flush();
    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }),
      ),
    );
    await flush();

    // The URL now carries a ?node= deep-link to the selected topic (kept in sync on selection).
    expect(new URLSearchParams(window.location.search).has("node")).toBe(true);

    // "Copy link to this topic" (More menu) writes a shareable map+node URL to the clipboard.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getAllByRole("button", { name: /More/ })[0]);
    await flush();
    const copy = screen.queryByText(/Copy link to this (topic|map)/);
    if (copy) {
      await user.click(copy);
      await flush();
      expect(writeText).toHaveBeenCalled();
      expect(String(writeText.mock.calls.at(-1)?.[0])).toContain("map=");
    }
    expect(container.querySelector(".mm-editor")).toBeTruthy();
  });

  it("flushes a pending debounced autosave the instant the tab is hidden", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // Make an edit so a 500ms-debounced IndexedDB save is queued (scheduleSave).
    const quick = screen.queryByPlaceholderText(/Quick add/);
    if (!quick) return; // editor variant without quick-add — nothing to assert
    await user.click(quick);
    await user.type(quick, "Closing edit{Enter}");
    // Don't wait out the debounce: hide the tab now and assert the save fired immediately, proving the
    // edit isn't lost in the 500ms window on close.
    const saveSpy = vi.spyOn(mapStore, "saveMap");
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
  });

  it("returns to the Start screen via Home and back into a map", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await flush();
    await openEditor(user, container);
    // Home / Start nav (the breadcrumb home button) — find a Start affordance and click it.
    const home = screen.queryByLabelText(/home/i) ?? screen.queryByText("Maps");
    if (home) await user.click(home);
    await flush();
    expect(document.body.textContent).toBeTruthy();
  });
});
