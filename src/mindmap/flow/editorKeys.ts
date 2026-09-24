// Keyboard routing for the inline topic editor (the contentEditable in TopicNode). Extracted from the
// node so the decision — "what does this keystroke mean?" — is a pure, unit-tested function with one
// obvious place to add new branches (e.g. the slash-command menu). The DOM side effects (applying a
// format, reading innerHTML) stay in the caller's action callbacks; this function only decides.

/** The minimal keyboard-event shape this router needs (a real React/DOM KeyboardEvent satisfies it). */
export interface EditorKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Side-effecting actions the editor can take, supplied by TopicNode (kept out of this pure router). */
export interface EditorKeyActions {
  /** Apply an inline format to the contentEditable's selection (Ctrl/Cmd + B/I/U). The tag names are
   *  the semantic ones richTextCommands emits, not the old execCommand verbs. */
  format: (tag: "b" | "i" | "u") => void;
  /** Commit the edit, leave the topic selected, and remain on it (Enter). */
  commit: () => void;
  /** Commit the edit and add a child (Tab). */
  commitAndAdd: (what: "sibling" | "child") => void;
  /** Leave edit mode, keeping/reverting per the editor's own rules (Escape). */
  cancel: () => void;
}

/** Route a keydown in the inline topic editor to an action. Returns true when the key was handled (and
 *  default prevented), false when it should fall through to normal text entry. Pure aside from calling
 *  the supplied actions + `preventDefault`. */
export function handleEditorKeyDown(e: EditorKeyEvent, actions: EditorKeyActions): boolean {
  // Inline formatting: Ctrl/Cmd + B / I / U. The key letter IS the semantic tag.
  if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key)) {
    e.preventDefault();
    actions.format(e.key.toLowerCase() as "b" | "i" | "u");
    return true;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    actions.commit();
    return true;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    actions.commitAndAdd("child");
    return true;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    actions.cancel();
    return true;
  }
  return false;
}
