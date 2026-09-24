import { describe, expect, it, vi } from "vitest";
import {
  type EditorKeyActions,
  type EditorKeyEvent,
  handleEditorKeyDown,
} from "../src/mindmap/flow/editorKeys";

// Pins the inline topic-editor keyboard routing (extracted from TopicNode) so later branches — e.g. a
// slash-command menu — can't silently regress Enter/Tab/Escape/formatting.

const ev = (over: Partial<EditorKeyEvent>): EditorKeyEvent => ({
  key: "",
  ctrlKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  ...over,
});

const actions = (): EditorKeyActions & {
  format: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  commitAndAdd: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
} => ({ format: vi.fn(), commit: vi.fn(), commitAndAdd: vi.fn(), cancel: vi.fn() });

describe("handleEditorKeyDown", () => {
  // The router now dispatches the SEMANTIC tag richTextCommands applies (b/i/u), not the old
  // execCommand verb (bold/italic/underline) — the key letter is itself the tag.
  it("maps Ctrl/Cmd + B / I / U to the matching format tag", () => {
    for (const [key, cmd] of [
      ["b", "b"],
      ["i", "i"],
      ["u", "u"],
    ] as const) {
      const a = actions();
      const e = ev({ key, ctrlKey: true });
      expect(handleEditorKeyDown(e, a)).toBe(true);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(a.format).toHaveBeenCalledWith(cmd);
      // Cmd (metaKey) works too, and is case-insensitive.
      const a2 = actions();
      handleEditorKeyDown(ev({ key: key.toUpperCase(), metaKey: true }), a2);
      expect(a2.format).toHaveBeenCalledWith(cmd);
    }
  });

  it("commits in place on Enter and commits + adds a child on Tab", () => {
    const a = actions();
    const enter = ev({ key: "Enter" });
    expect(handleEditorKeyDown(enter, a)).toBe(true);
    expect(a.commit).toHaveBeenCalledOnce();
    expect(a.commitAndAdd).not.toHaveBeenCalled();
    expect(enter.stopPropagation).toHaveBeenCalledOnce();

    const b = actions();
    expect(handleEditorKeyDown(ev({ key: "Tab" }), b)).toBe(true);
    expect(b.commitAndAdd).toHaveBeenCalledWith("child");
  });

  it("cancels on Escape", () => {
    const a = actions();
    const e = ev({ key: "Escape" });
    expect(handleEditorKeyDown(e, a)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(a.cancel).toHaveBeenCalled();
  });

  it("falls through (returns false, no preventDefault) for ordinary typing", () => {
    const a = actions();
    const e = ev({ key: "a" });
    expect(handleEditorKeyDown(e, a)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(a.format).not.toHaveBeenCalled();
    expect(a.commit).not.toHaveBeenCalled();
    expect(a.commitAndAdd).not.toHaveBeenCalled();
    expect(a.cancel).not.toHaveBeenCalled();
  });

  it("does not treat a plain b/i/u (no modifier) as a format command", () => {
    const a = actions();
    expect(handleEditorKeyDown(ev({ key: "b" }), a)).toBe(false);
    expect(a.format).not.toHaveBeenCalled();
  });
});
