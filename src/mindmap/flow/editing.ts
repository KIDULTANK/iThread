import { createContext, useContext } from "react";
import type { LinkCandidate } from "./linkAutocomplete";

// Inline-edit coordination between FlowInner (owner of the doc) and the TopicNode being
// edited. Passed via context so a node can enter edit mode + commit without threading
// callbacks through React Flow's node data.

export interface EditingApi {
  editingId: string | null;
  /** Optional initial content for a newly-created topic editor; normal edits use `null`. */
  seed: string | null;
  /** Enter inline edit for a node. */
  beginEdit: (id: string) => void;
  /** Commit the edited topic (raw contenteditable HTML) and leave edit mode. `keepSelected` is used
   *  by Enter; blur commits must not steal selection back from the thing the user clicked. */
  commitEdit: (id: string, html: string, keepSelected?: boolean) => void;
  /** Commit, then add + edit a sibling (Enter) or child (Tab). `html` is the raw editor HTML. */
  commitAndAdd: (id: string, html: string, what: "sibling" | "child") => void;
  /** Leave edit mode (Escape). `html` is the live editor buffer: an existing node reverts to its
   *  committed text, but a brand-new node keeps what you typed (or is discarded if still empty). */
  cancelEdit: (html?: string) => void;
  /** Collapse/expand a node from its toggle. */
  toggleCollapse: (id: string) => void;
  /** Set a topic's text-wrap width from the on-canvas right-edge drag grip (10b Layer 2). `maxWidth` is
   *  a CSS length ("220px") or "" for None — the same string the inspector's Wrap slider writes. The
   *  whole drag coalesces into a single undo step. */
  setWrapWidth: (id: string, maxWidth: string) => void;
  /** Follow a node's hyperlink: jump to a topic (#node=), open a map (#map=), or open a URL. */
  openLink: (url: string) => void;
  /** Click the on-canvas priority chip to step priority: none → High → Med → Low → none. */
  cyclePriority: (id: string) => void;
  /** Select the node and open the inspector on its Notes tab (clicking the node's 📝 indicator). */
  openNote: (id: string) => void;
  /** Native browser spell-check on the topic editors (a view setting; off by default). */
  spellcheck: boolean;
  /** Apply a marker dragged from the palette onto this node (drag-and-drop marker application). */
  dropMarker: (id: string, marker: string) => void;
  /** Run a slash-menu command on a node (the `/` command menu): clears the `/query` text, then applies
   *  the command's effect (add child/sibling, task/priority/date, boundary, note, marker). */
  runSlashCommand: (id: string, commandId: string) => void;
  /** Candidate topics for the `[[`/`@` link autocomplete — every named topic in this map except the one
   *  being edited (you can't wiki-link a topic to itself). */
  linkCandidates: (excludeId: string) => LinkCandidate[];
  /** Attach a name-based link chosen from the autocomplete to a node: the first link becomes the
   *  node's primary `hyperlink`, further ones its additional `hyperlinks`. */
  addNodeLink: (id: string, link: string) => void;
  /** Every tag used anywhere in the map — feeds the inline `#tag` accelerator's suggestion list. */
  tagCandidates: () => string[];
  /** Add a tag to a node (deduped) — the inline `#tag` accelerator's commit. */
  addNodeTag: (id: string, tag: string) => void;
}

export const EditingContext = createContext<EditingApi | null>(null);

export function useEditing(): EditingApi | null {
  return useContext(EditingContext);
}
