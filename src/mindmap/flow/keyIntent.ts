// The canvas keydown handler, split into a PURE key→intent mapping (this file) + the listener wiring +
// dispatch (FlowMindMap). Same keys, same guards as before — but now unit-testable without a DOM.

export type KeyIntent =
  | { kind: "clearLinking" }
  | { kind: "clearDropTarget" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "addChild"; id: string }
  | { kind: "addSibling"; id: string }
  | { kind: "addSiblingBefore"; id: string }
  | { kind: "outdent"; id: string }
  | { kind: "indent"; id: string }
  | { kind: "moveUp"; id: string }
  | { kind: "moveDown"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "openNote"; id: string }
  | { kind: "rename"; id: string }
  | { kind: "openSlashMenu"; id: string }
  | { kind: "stepProgress"; id: string; direction: "up" | "down" }
  | { kind: "selectDir"; id: string; dir: "up" | "down" | "left" | "right" }
  | { kind: "copyBranch"; id: string }
  | { kind: "duplicateBranch"; id: string }
  | { kind: "pasteBranch"; id: string }
  | { kind: "startLinking"; id: string }
  | { kind: "completeLink"; id: string }
  | { kind: "nudge"; id: string; dir: "up" | "down" | "left" | "right" }
  | { kind: "setPriority"; id: string; level: number }
  | { kind: "zoomIn" }
  | { kind: "zoomOut" }
  | { kind: "zoomReset" }
  | { kind: "toggleCollapse"; id: string }
  | { kind: "setExpandedLevel"; id: string; level: number }
  | null;

export interface KeyState {
  /** A node is being inline-edited (typing should go to the editor, not trigger shortcuts). */
  editing: boolean;
  /** The selected (anchor) node id, or null. */
  selectedId: string | null;
  /** A relationship link is being drawn (Escape cancels it). */
  linking: boolean;
  /** The map is in free-canvas (freeform) mode, where nodes carry manual positions — enables the
   *  Ctrl/⌘+arrow keyboard nudge (a non-drag way to reposition, for WCAG 2.5.7). */
  freeform: boolean;
  /** Running as an installed PWA (standalone). Gates browser-reserved shortcuts like Ctrl/⌘+T, which
   *  only reach the page in standalone mode (a normal tab hands them to the browser). */
  pwa: boolean;
}

/** The minimal event shape keyIntent reads (a real KeyboardEvent satisfies it; tests pass a literal). */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: { tagName?: string; isContentEditable?: boolean } | null;
}

const FIELD = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/;

/** Map a keydown to the editor intent it triggers (or null for "ignore"). All `kind`s except the two
 *  `clear*` ones are dispatched with preventDefault by the caller. Order matters: Escape is handled
 *  before the inline-editing guard (it must still clear a stray drag indicator while editing). */
export function keyIntent(e: KeyEventLike, state: KeyState): KeyIntent {
  if (e.key === "Escape" && state.linking) return { kind: "clearLinking" };
  if (e.key === "Escape") return { kind: "clearDropTarget" };
  if (state.editing) return null;
  const t = e.target;
  if (t && (t.isContentEditable || (t.tagName ? FIELD.test(t.tagName) : false))) return null;
  // Undo/redo work regardless of selection.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")
    return e.shiftKey ? { kind: "redo" } : { kind: "undo" };
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") return { kind: "redo" };
  // Keyboard zoom (Ctrl/⌘ + / − / 0) — selection-free, like undo/redo. Claims the browser's own
  // page-zoom bindings while the canvas has focus (the dispatcher preventDefaults). "=" is the
  // unshifted plus key on most layouts, so accept it (and the shifted "+") for zoom-in.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "+" || e.key === "="))
    return { kind: "zoomIn" };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "-") return { kind: "zoomOut" };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "PageUp") return { kind: "zoomIn" };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "PageDown") return { kind: "zoomOut" };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === "0")
    return { kind: "zoomReset" };
  const id = state.selectedId;
  if (!id) return null;
  // While drawing a relationship, Enter links the source to the currently-selected target (Esc cancels,
  // handled above). Keyboard parity for the mouse "click a target to finish" step.
  if (state.linking && e.key === "Enter" && !e.ctrlKey && !e.metaKey)
    return { kind: "completeLink", id };
  // iPad-style branch movement, adapted to the user's Windows preference: hold Alt and use arrows.
  // Auto-layout: up/down reorder siblings, left/right change hierarchy. Free-canvas Alt+arrow is a
  // positional nudge below. Repeated keydown events are intentionally accepted for held-key motion.
  if (e.altKey && !e.ctrlKey && !e.metaKey && !state.freeform && e.key === "ArrowUp")
    return { kind: "moveUp", id };
  if (e.altKey && !e.ctrlKey && !e.metaKey && !state.freeform && e.key === "ArrowDown")
    return { kind: "moveDown", id };
  if (e.altKey && !e.ctrlKey && !e.metaKey && !state.freeform && e.key === "ArrowLeft")
    return { kind: "outdent", id };
  if (e.altKey && !e.ctrlKey && !e.metaKey && !state.freeform && e.key === "ArrowRight")
    return { kind: "indent", id };
  // Branch clipboard: copy (Ctrl/⌘+C), duplicate-as-sibling (Ctrl/⌘+D), paste under the selection
  // (Ctrl/⌘+Shift+V). NOT Ctrl/⌘+V — that's the window-level image paste (useClipboardImagePaste).
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "c")
    return { kind: "copyBranch", id };
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d")
    return { kind: "duplicateBranch", id };
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v")
    return { kind: "pasteBranch", id };
  // Start drawing a relationship from the selected topic — keyboard parity for the mouse "Link to…"
  // menu + drag grip. Ctrl/⌘+Shift+L, then arrow to a target and Enter to complete (Esc cancels).
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l")
    return { kind: "startLinking", id };
  // iThoughts for Windows: Ctrl+1..5 sets priority. Ctrl+Shift remains a compatibility alias.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[1-5]$/.test(e.key))
    return { kind: "setPriority", id, level: Number(e.key) };
  // Free-canvas mode: Alt+arrow nudges the selected node's position by a step (a keyboard / non-drag
  // alternative to drag-positioning — WCAG 2.5.7). Only in freeform; the auto-layouts ignore node.pos.
  if (state.freeform && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (e.key === "ArrowUp") return { kind: "nudge", id, dir: "up" };
    if (e.key === "ArrowDown") return { kind: "nudge", id, dir: "down" };
    if (e.key === "ArrowLeft") return { kind: "nudge", id, dir: "left" };
    if (e.key === "ArrowRight") return { kind: "nudge", id, dir: "right" };
  }
  // Bare arrows move the selection through the tree (left=parent, right=child, up/down=siblings).
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    if (e.key === "ArrowUp") return { kind: "selectDir", id, dir: "up" };
    if (e.key === "ArrowDown") return { kind: "selectDir", id, dir: "down" };
    if (e.key === "ArrowLeft") return { kind: "selectDir", id, dir: "left" };
    if (e.key === "ArrowRight") return { kind: "selectDir", id, dir: "right" };
  }
  if (e.key === "Enter" && e.shiftKey && !e.ctrlKey && !e.metaKey)
    return { kind: "addSiblingBefore", id };
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return { kind: "rename", id };
  if (e.key === "Enter") return { kind: "addSibling", id };
  if (e.key === "Tab" && !e.shiftKey) return { kind: "addChild", id };
  if (e.key === "Tab" && e.shiftKey) return { kind: "outdent", id };
  // Backspace = Delete (Mac keyboards lack forward-Delete; overlays already accept both).
  if (e.key === "Delete" || e.key === "Backspace") return { kind: "delete", id };
  // Ctrl/⌘+T → open the selected topic's note. Only in the installed PWA: a normal browser tab
  // reserves Ctrl+T for "new tab" (the page can't intercept it), so we don't claim it there.
  if (state.pwa && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t")
    return { kind: "openNote", id };
  if (e.key === "F4") return { kind: "openNote", id };
  if (e.key === "F2") return { kind: "rename", id };
  // Slash is an explicit command shortcut, not general type-to-edit behaviour.
  if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) return { kind: "openSlashMenu", id };
  // iThoughts: P increments task progress; Shift+P decrements it. The first increment turns a plain
  // topic into a 0% task. This is handled before the visibility keys and is inactive while editing.
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "p")
    return { kind: "stepProgress", id, direction: e.shiftKey ? "down" : "up" };
  if (e.key === "." && !e.ctrlKey && !e.metaKey && !e.altKey) return { kind: "toggleCollapse", id };
  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey)
    return { kind: "setExpandedLevel", id, level: Number(e.key) };
  // Plain printable keys stay free for explicit shortcuts. Editing starts through F2, Ctrl/⌘+Enter,
  // or double-click, so selecting a topic and accidentally typing never replaces its title.
  return null;
}
