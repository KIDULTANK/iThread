import { Handle, type NodeProps, Position, useStore, useStoreApi } from "@xyflow/react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge, DateChip } from "../../Badge";
import { t } from "../../i18n/registry";
import { markerImage } from "../../icons";
import { parseInlineMarkdown, sanitizeRich } from "../../io/richText";
import { priorityColor, priorityLabel } from "../../priority";
import { type InlineTag, applyColor, toggleInline } from "../../richTextCommands";
import { isOverdue, taskInfoLine, todayISO } from "../../taskDate";
import {
  WRAP_MAX,
  WRAP_MIN,
  snapWrapWidth,
  styleToWrapWidth,
  wrapWidthLabel,
  wrapWidthToStyle,
} from "../../wrapWidth";
import { MARKER_DND_TYPE } from "../contract";
import "./messages"; // registers the canvas catalogue into this (lazy) chunk
import { useEditing } from "./editing";
import { handleEditorKeyDown } from "./editorKeys";
import { matchBorderColor } from "./geometry";
import {
  type LinkCandidate,
  type LinkTrigger,
  type TagTrigger,
  applyLinkSelection,
  linkTriggerAt,
  matchLinkCandidates,
  matchTagCandidates,
  tagTriggerAt,
} from "./linkAutocomplete";
import { relateGripTopCss } from "./relateGripGeometry";
import { isGeometric, shapeInset, shapeOverlayPath, shapePath } from "./shapes";
import { type SlashCommand, matchSlashCommands, slashMenuKey, slashQuery } from "./slashCommands";
import {
  TOPIC_SHADOW_CSS,
  levelFontSize,
  readableTextOn,
  resolveLevelBox,
  resolveTopicFill,
} from "./style";
import type { TopicNode as TopicNodeT } from "./types";
import {
  WRAP_HANDLE_H,
  WRAP_HANDLE_TOP,
  WRAP_HANDLE_W,
  wrapHandleFits,
} from "./wrapHandleGeometry";

// Custom topic node: a rounded box honouring the model's NodeStyle, with marker emoji, the
// topic text (inline-editable via contenteditable), an optional image, note/link affordances,
// tag chips, and a collapse toggle. Four hidden handles let branches connect on any side.

// The "double-click to edit" microcopy (#5) is shown on hover until the user edits a topic for the
// first time, then never again (best-effort persisted, like the theme + panel prefs). Module-level so
// every node shares the one flag without re-projecting node data.
let editHintSeen = (() => {
  try {
    return localStorage.getItem("mindmap-edit-hint") === "seen";
  } catch {
    return false;
  }
})();
function markEditHintSeen() {
  if (editHintSeen) return;
  editHintSeen = true;
  try {
    localStorage.setItem("mindmap-edit-hint", "seen");
  } catch {
    // best-effort — the hint just shows again next session
  }
}

// One-time coach for the drag-to-relate grip (C7): shown on hover after the edit hint is retired,
// until the user first grabs the grip. Same module-level best-effort-persisted pattern as the edit hint.
let relateHintSeen = (() => {
  try {
    return localStorage.getItem("mindmap-relate-hint") === "seen";
  } catch {
    return false;
  }
})();
function markRelateHintSeen() {
  if (relateHintSeen) return;
  relateHintSeen = true;
  try {
    localStorage.setItem("mindmap-relate-hint", "seen");
  } catch {
    // best-effort
  }
}

// Plain-text caret offset within a contentEditable (how many characters precede the caret). Used to
// locate the `[[`/`@` link-autocomplete trigger. Returns the end of the text when there's no selection.
function caretOffset(el: HTMLElement): number {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  const end = el.textContent?.length ?? 0;
  if (!sel || sel.rangeCount === 0) return end;
  const range = sel.getRangeAt(0);
  // A selection left over from before an imperative text reset points at a detached node — treat a
  // caret outside this editor as "at the end" (the common case just after typing).
  if (!el.contains(range.endContainer)) return end;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

// Place the caret at a plain-text offset in a contentEditable whose content was just reset to one text
// node (the plain link-autocomplete rewrite path). Clamps to the text length.
function placeCaret(el: HTMLElement, offset: number): void {
  const node = el.firstChild ?? el;
  const len = node.textContent?.length ?? 0;
  const range = document.createRange();
  range.setStart(node, Math.min(offset, len));
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// Map a plain-text offset to a DOM (text node, offset) position inside a contentEditable — the inverse
// of caretOffset. Used to replace only the `[[`/`@` token range while leaving surrounding rich markup
// intact. Falls back to the end of the element if the offset runs past the text.
function domPositionAt(el: HTMLElement, target: number): { node: Node; offset: number } {
  let remaining = target;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) return { node, offset: remaining };
    remaining -= len;
    node = walker.nextNode();
  }
  return { node: el, offset: el.childNodes.length };
}

// Replace the plain-text range [start, end) in a contentEditable with `label`, preserving any markup
// outside the range, and leave the caret just after the inserted text. Used by the link autocomplete
// so inserting a link into a formatted topic doesn't flatten its bold/italic/colour runs.
function replaceTokenRange(el: HTMLElement, start: number, end: number, label: string): void {
  const from = domPositionAt(el, start);
  const to = domPositionAt(el, end);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  range.deleteContents();
  const inserted = document.createTextNode(label);
  range.insertNode(inserted);
  const after = document.createRange();
  after.setStartAfter(inserted);
  after.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(after);
}

const HANDLE: CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
};

const chipStyle: CSSProperties = {
  fontSize: 11,
  padding: "0 6px",
  borderRadius: 6,
  background: "rgba(0,0,0,0.06)",
  color: "inherit",
};

// Text colours offered by the inline rich-text mini-toolbar (red / green / blue / amber / ink).
const RICH_COLORS = ["#e23b3b", "#1b8a5e", "#3f6fb0", "#b5852a", "#111827"];

/** The floating bold/italic/underline + colour bar shown above a topic while it's being edited
 *  (MindManager's inline format bar). Buttons preventDefault on mousedown so clicking them keeps the
 *  contentEditable's selection + focus (no blur/commit); the commands mirror the Ctrl+B/I/U path.
 *  `editRef` is the contentEditable being edited — every command is scoped to it so a stray selection
 *  elsewhere on the page can't be reformatted. */
function RichEditToolbar({ editRef }: { editRef: RefObject<HTMLDivElement | null> }) {
  const stop = (e: ReactMouseEvent) => e.preventDefault();
  const fmt = (tag: InlineTag) => {
    if (editRef.current) toggleInline(editRef.current, tag);
  };
  const color = (c: string) => {
    if (editRef.current) applyColor(editRef.current, c);
  };
  const btn: CSSProperties = {
    width: 22,
    height: 22,
    border: "none",
    borderRadius: 5,
    background: "transparent",
    cursor: "pointer",
    font: "inherit",
    // Themed so the floating rich-text bar follows the app appearance (was a fixed near-black that
    // sat unreadable on the dark-mode card surface below).
    color: "var(--ed-ink, #1f2933)",
  };
  return (
    <div
      className="nodrag nopan"
      style={{
        position: "absolute",
        top: -34,
        left: 0,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 7,
        // Themed surface + shadow (was a hardcoded white card + dark shadow — a light box in dark mode).
        background: "var(--ed-card, #fff)",
        boxShadow: "var(--ed-shadow-pop, 0 2px 10px rgba(0,0,0,0.2))",
        zIndex: 6,
      }}
    >
      <button
        type="button"
        title={t("canvas.format.bold")}
        onMouseDown={stop}
        onClick={() => fmt("b")}
        style={{ ...btn, fontWeight: 800 }}
      >
        B
      </button>
      <button
        type="button"
        title={t("canvas.format.italic")}
        onMouseDown={stop}
        onClick={() => fmt("i")}
        style={{ ...btn, fontStyle: "italic" }}
      >
        I
      </button>
      <button
        type="button"
        title={t("canvas.format.underline")}
        onMouseDown={stop}
        onClick={() => fmt("u")}
        style={{ ...btn, textDecoration: "underline" }}
      >
        U
      </button>
      <span
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "var(--ed-border, #e4e4e7)",
          margin: "0 2px",
        }}
      />
      {RICH_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={t("canvas.format.textColour", { colour: c })}
          aria-label={t("canvas.format.textColour", { colour: c })}
          onMouseDown={stop}
          onClick={() => color(c)}
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.15)",
            background: c,
            cursor: "pointer",
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

// Memoised: React Flow re-renders every visible node whenever the node array changes (e.g. an
// unrelated node moves or selection shifts). The producer (project/sync in FlowMindMap) only mints
// a fresh `data` object when this node's content actually changes — selection, Power-Filter dimming,
// topic/style/progress edits — so the default shallow compare re-renders exactly when needed and
// skips the rest. Inline-edit + collapse arrive via the `useEditing()` context, which memo never
// blocks, so editing state still re-renders correctly.
function TopicNodeImpl({ id, data, selected, dragging }: NodeProps<TopicNodeT>) {
  const {
    topic,
    topicRich,
    number,
    icons,
    tags,
    style: ownStyle,
    condStyle,
    image,
    note,
    hyperlink,
    rollup,
    rollupTitle,
    isRoot,
    depth,
    branchColor,
    tipLeft,
    collapsed,
    hasChildren,
    hiddenCount,
    childTitles,
    progress,
    due,
    start,
    durationDays,
    resources,
    priority,
    attachmentCount,
    attachmentNames,
    dimmed,
    matched,
    dropTarget,
    locked,
    fontScale = 1,
    fontFamily: mapFontFamily,
    motionProgress = 1,
  } = data;
  // Conditional-formatting style sits *under* the node's own style (manual styling wins).
  const style = condStyle ? { ...condStyle, ...ownStyle } : ownStyle;
  // Map-wide typography: scale the per-depth default size (a manual style.fontSize still wins), and
  // use the map base family as the fallback when the node has no family of its own.
  const scaledFont = levelFontSize(depth) * fontScale;
  const familyFor = (s: typeof style) => s?.fontFamily ?? mapFontFamily;
  const editing = useEditing();
  const isEditing = editing?.editingId === id;
  // Type-to-edit: when edit was started by typing a character on the selected node, seed the editor
  // with that character (caret at the end) instead of the existing topic + select-all.
  const seed = isEditing ? (editing?.seed ?? null) : null;
  const editRef = useRef<HTMLDivElement>(null);
  // Hover state drives the lift/shadow (#5) and reveals the ＋ add affordances (#1).
  const [hovered, setHovered] = useState(false);
  // Is more than one node selected? A branch/marquee select would otherwise pop a per-node action bar
  // + ＋ buttons on EVERY selected node, burying the map — so suppress them in bulk. Reactive: the
  // selector returns a stable boolean, so a node only re-renders when the count crosses 1 ↔ many.
  const multiSelected = useStore((s) => {
    let n = 0;
    for (const node of s.nodeLookup.values()) {
      if (node.selected) {
        n += 1;
        if (n > 1) return true;
      }
    }
    return false;
  });
  // On-canvas wrap-width grip (10b Layer 2). It lives on the node box's right edge, so measure the box
  // to decide whether there's clearance for it (wrapHandleGeometry) — only when this node is the sole
  // selection (the grip is single-select only). `useStoreApi` reads the live zoom imperatively at
  // drag-start WITHOUT subscribing every node to viewport changes (which would re-render the whole map
  // on pan/zoom).
  const storeApi = useStoreApi();
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(0);
  const [wrapDragging, setWrapDragging] = useState(false);
  const wrapDrag = useRef<{ startX: number; startPx: number; zoom: number; last: number } | null>(
    null,
  );
  const singleSelected = selected && !multiSelected && !isEditing;
  // Measure the box HEIGHT while this node is the sole selection, and keep it current via a
  // ResizeObserver — so the clearance gate re-evaluates whenever the content that affects height
  // (text, wrap cap, font) changes, without listing those as effect deps (biome) and without a static
  // dependency the effect body doesn't read. jsdom has no ResizeObserver + zero layout, so the guard
  // keeps tests happy (the grip is a canvas affordance, verified in-browser).
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!singleSelected || !el) return;
    setBoxHeight(el.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [singleSelected]);
  // Shown on a single-selected node tall enough to clear the centre ＋/relate cluster; kept visible for
  // the whole drag even if the live re-wrap changes the height (so pointer-capture isn't dropped).
  const showWrapHandle = (singleSelected && wrapHandleFits(boxHeight)) || wrapDragging;
  const onWrapPointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const zoom = storeApi.getState().transform[2] || 1;
    // Start from the node's rendered width (clamped) so the edge tracks the pointer 1:1; fall back to
    // the stored cap if the box hasn't measured yet.
    const rendered = boxRef.current?.offsetWidth ?? styleToWrapWidth(ownStyle?.maxWidth);
    const startPx = Math.min(WRAP_MAX, Math.max(WRAP_MIN, rendered));
    wrapDrag.current = { startX: e.clientX, startPx, zoom, last: startPx };
    setWrapDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onWrapPointerMove = (e: ReactPointerEvent) => {
    const d = wrapDrag.current;
    if (!d) return;
    // Screen-space pointer delta → flow-space px (divide by zoom); snap to presets/None near the ticks.
    const px = snapWrapWidth(d.startPx + (e.clientX - d.startX) / d.zoom);
    if (px !== d.last) {
      d.last = px;
      editing?.setWrapWidth(id, wrapWidthToStyle(px));
    }
  };
  const onWrapPointerUp = (e: ReactPointerEvent) => {
    wrapDrag.current = null;
    setWrapDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  // Keyboard parity (the grip is a real button): arrows nudge ±20px, Home = None, End = narrowest.
  const onWrapKeyDown = (e: ReactKeyboardEvent) => {
    const cur = styleToWrapWidth(ownStyle?.maxWidth);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + 20;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - 20;
    else if (e.key === "Home") next = WRAP_MAX;
    else if (e.key === "End") next = WRAP_MIN;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    editing?.setWrapWidth(id, wrapWidthToStyle(snapWrapWidth(next)));
  };
  // Hover-peek: show the note's text in a small card when the 📝 indicator is hovered (read it
  // without opening the inspector). Canvas-only.
  const [peekNote, setPeekNote] = useState(false);
  // Hover-peek on the collapsed +N toggle: list the first few hidden child titles so you can decide
  // whether to expand without re-laying out the map. Canvas-only.
  const [peekCollapsed, setPeekCollapsed] = useState(false);
  // True while a marker is being dragged over this node (drag-and-drop marker application) — drives a
  // drop-highlight ring.
  const [markerDragOver, setMarkerDragOver] = useState(false);
  // Re-sanitise on render too (defence-in-depth: a topicRich could arrive via an imported .json).
  // Plain topics also get a lightweight Markdown pass so older iThoughts files containing ** / == /
  // __ markers render correctly without requiring a one-off data migration.
  const richHtml = useMemo(
    () => (topicRich ? sanitizeRich(topicRich) : (parseInlineMarkdown(topic).rich ?? null)),
    [topic, topicRich],
  );
  // Slash `/` command menu: opens when the editor text starts with "/", filtered by what follows.
  // `items` empty ⇒ closed. `index` is the highlighted row (Arrow keys move it, Enter/Tab selects).
  const [slashItems, setSlashItems] = useState<SlashCommand[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashOpen = isEditing && slashItems.length > 0;
  // `[[`/`@` link autocomplete: a mid-text trigger at the caret opens a topic picker.
  const [linkItems, setLinkItems] = useState<LinkCandidate[]>([]);
  const [linkIndex, setLinkIndex] = useState(0);
  const [linkTrigger, setLinkTrigger] = useState<LinkTrigger | null>(null);
  const linkOpen = isEditing && linkTrigger !== null && linkItems.length > 0;
  // `#tag` accelerator: a mid-text `#word` trigger opens a tag picker.
  const [tagItems, setTagItems] = useState<string[]>([]);
  const [tagIndex, setTagIndex] = useState(0);
  const [tagTrigger, setTagTrigger] = useState<TagTrigger | null>(null);
  const tagOpen = isEditing && tagTrigger !== null && tagItems.length > 0;
  // The editor text at which the user pressed Escape to dismiss a menu — syncMenus keeps the menu shut
  // while the text is unchanged, so the keyup/caret-move re-sync doesn't immediately reopen it. Cleared
  // once the text changes (they typed something) or on leaving edit.
  const dismissedRef = useRef<string | null>(null);
  // Recompute both menus from the editor's current text (+ caret for the link one). Slash wins: a
  // leading "/" and a mid-text "[["/"@" can't sensibly coexist, so only one menu is ever open.
  const syncMenus = useCallback(() => {
    const el = editRef.current;
    const text = el?.textContent ?? "";
    if (dismissedRef.current !== null) {
      // Stay dismissed until the text actually changes from what was Escaped.
      if (dismissedRef.current === text) {
        setSlashItems([]);
        setLinkTrigger(null);
        setLinkItems([]);
        setTagTrigger(null);
        setTagItems([]);
        return;
      }
      dismissedRef.current = null;
    }
    const slash = slashQuery(text);
    if (slash !== null) {
      const items = matchSlashCommands(slash);
      setSlashItems(items);
      setSlashIndex(0);
      setLinkTrigger(null);
      setLinkItems([]);
      setTagTrigger(null);
      setTagItems([]);
      return;
    }
    setSlashItems([]);
    const caret = el ? caretOffset(el) : 0;
    const trigger = el ? linkTriggerAt(text, caret) : null;
    const items =
      trigger && editing ? matchLinkCandidates(editing.linkCandidates(id), trigger.query) : [];
    setLinkTrigger(items.length ? trigger : null);
    setLinkItems(items);
    setLinkIndex(0);
    // `#tag` picker — only when the link picker isn't claiming the caret (they can't both be at the
    // same token: `[[`/`@`/`#` are distinct trigger chars).
    const tt = !items.length && el ? tagTriggerAt(text, caret) : null;
    const tags = tt && editing ? matchTagCandidates(editing.tagCandidates(), tt.query) : [];
    setTagTrigger(tags.length ? tt : null);
    setTagItems(tags);
    setTagIndex(0);
  }, [editing, id]);

  // Pick a link-autocomplete candidate: rewrite the buffer (replace the `[[`/`@` token with the topic
  // name), restore the caret after it, attach the link to the node, and close the menu. Edit stays open.
  const selectLink = useCallback(
    (cand: LinkCandidate) => {
      const el = editRef.current;
      if (!el || !linkTrigger) return;
      if (el.children.length === 0) {
        // Plain buffer (no markup): recompute the whole string — simple + exercised by the tests.
        const { text, caret } = applyLinkSelection(el.textContent ?? "", linkTrigger, cand.label);
        el.textContent = text;
        placeCaret(el, caret);
      } else {
        // Formatted buffer: splice only the token range so bold/italic/colour runs survive.
        replaceTokenRange(el, linkTrigger.start, linkTrigger.end, cand.label);
      }
      editing?.addNodeLink(id, cand.link);
      setLinkTrigger(null);
      setLinkItems([]);
    },
    [editing, id, linkTrigger],
  );

  // Pick a #tag candidate: strip the `#query` token from the title (a tag is metadata, not text),
  // restore the caret, assign the tag, and close the menu. Edit stays open.
  const selectTag = useCallback(
    (tag: string) => {
      const el = editRef.current;
      if (!el || !tagTrigger) return;
      if (el.children.length === 0) {
        const { text, caret } = applyLinkSelection(el.textContent ?? "", tagTrigger, "");
        el.textContent = text;
        placeCaret(el, caret);
      } else {
        replaceTokenRange(el, tagTrigger.start, tagTrigger.end, "");
      }
      editing?.addNodeTag(id, tag);
      setTagTrigger(null);
      setTagItems([]);
    },
    [editing, id, tagTrigger],
  );

  // On entering edit mode: seed the text, focus, and select all (uncontrolled — React must
  // not re-render over the user's keystrokes, so the text is set imperatively, once).
  useEffect(() => {
    if (!isEditing || !editRef.current) return;
    const el = editRef.current;
    // Type-to-edit seeds with the typed character (plain text); otherwise seed with the rich HTML so
    // existing formatting stays editable, else the plain topic.
    if (seed !== null) el.textContent = seed;
    else if (richHtml) el.innerHTML = richHtml;
    else el.textContent = topic;
    // A freshly-CREATED node is briefly `visibility:hidden` while React Flow measures it, so the
    // first focus() is a no-op (focus can't land on a hidden element) — that left a new node in edit
    // mode but unfocused, so you couldn't type into it. Retry across a few frames until focus lands
    // (an existing node, e.g. via F2, is already visible so it succeeds on the first try).
    let raf = 0;
    let tries = 0;
    const place = () => {
      el.focus();
      if (document.activeElement === el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        // Type-to-edit: caret at the end (keep the just-typed char). Normal edit: select all.
        if (seed !== null) range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
      if (tries++ < 10 && typeof requestAnimationFrame === "function") {
        raf = requestAnimationFrame(place);
      }
    };
    place();
    // Type-to-edit could seed a leading "/" (open the slash menu immediately); otherwise this closes it.
    syncMenus();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isEditing, topic, richHtml, seed, syncMenus]);

  // Leaving edit mode tears both menus down so they can't linger with stale items on the next edit.
  useEffect(() => {
    if (!isEditing) {
      setSlashItems([]);
      setSlashIndex(0);
      setLinkItems([]);
      setLinkTrigger(null);
      setLinkIndex(0);
      dismissedRef.current = null;
    }
  }, [isEditing]);

  // The first real edit retires the "double-click to edit" microcopy for good.
  useEffect(() => {
    if (isEditing) markEditHintSeen();
  }, [isEditing]);

  // Geometric shapes (diamond/ellipse/…) are painted by an SVG backdrop; the box itself goes
  // transparent and the text gets extra padding so it stays inside the narrowing outline.
  const shape = isRoot ? undefined : style?.shape;
  const geom = isGeometric(shape);
  const ins = geom ? shapeInset(shape) : null;
  // Branch-derived fill (tint/gradient); null when no fill mode is set → keep the flat-fill path.
  const topicFill = isRoot
    ? null
    : resolveTopicFill({ mode: style?.fill, background: style?.background, branchColor });
  const shapeFill = topicFill?.solid ?? style?.background ?? "var(--mm-node-bg, #faf9f5)";
  const shapeStroke = matchBorderColor(style?.border) ?? branchColor;
  const shapeStrokeW = style?.border ? Number.parseFloat(style.border) || 2 : 2;

  // Level-based topic styling (MindManager reads its hierarchy from shape alone): depth-1 mains are
  // FILLED with the branch colour; depth-2 keep the bordered white card; depth-3+ leaves drop the box
  // for a short branch-colour underline under the text. A manual NodeStyle key always wins — set a
  // background or border and the node reverts to a normal card.
  const { filledMain, underlineLeaf } = resolveLevelBox({ isRoot, geom, depth, style });

  const box: CSSProperties = isRoot
    ? {
        // The central topic dominates: larger bold type + a slightly bigger capsule, text centred.
        background: "var(--mm-root-bg, #1b8a5e)",
        color: "var(--mm-root-color, #ffffff)",
        borderRadius: 16,
        padding: "9px 20px",
        fontWeight: 700,
        fontSize: 20 * fontScale,
        fontFamily: mapFontFamily,
        textAlign: "center",
        border: "none",
      }
    : geom && ins
      ? {
          background: "transparent",
          color: style?.color ?? "var(--mm-color, #2c2c2a)",
          border: "none",
          padding: `${6 + ins.top}px ${12 + ins.right}px ${6 + ins.bottom}px ${12 + ins.left}px`,
          fontSize: style?.fontSize ?? scaledFont,
          fontWeight: style?.fontWeight,
          fontFamily: familyFor(style),
          textDecoration: style?.textDecoration,
          textAlign: "center",
        }
      : {
          background: style?.fillImage
            ? `center/cover no-repeat url("${style.fillImage}")`
            : (topicFill?.css ??
              style?.background ??
              (filledMain
                ? branchColor
                : underlineLeaf
                  ? "transparent"
                  : "var(--mm-node-bg, #ffffff)")),
          // An image fill needs a readable text colour + scrim regardless of the picture beneath it.
          color: style?.fillImage
            ? (style?.color ?? "#ffffff")
            : (style?.color ??
              topicFill?.text ??
              (filledMain ? readableTextOn(branchColor) : "var(--mm-color, #23211c)")),
          textShadow: style?.fillImage ? "0 1px 3px rgba(0,0,0,0.85)" : undefined,
          // Underline leaves carry only a bottom rule. Setting `border` to undefined (rather than
          // omitting the key) still leaves it as an own property, so React's shorthand/longhand
          // diffing sees both `border` and `borderBottom` on the object across renders and warns
          // when a node toggles between the two states. Spreading in exactly one of the two keys
          // keeps them from ever coexisting on the object at all.
          ...(style?.border
            ? { border: style.border }
            : underlineLeaf
              ? { borderBottom: `2px solid ${branchColor}` }
              : { border: filledMain ? "none" : `1.5px solid ${branchColor}` }),
          borderRadius: style?.borderRadius ?? (underlineLeaf ? 0 : "11px"),
          padding: underlineLeaf ? "3px 8px 4px" : "6px 12px",
          // Per-topic wrap width enables mid-word breaking when a width is set; the width cap itself is
          // applied on the outer box below (a flat `maxWidth` here was clobbered by the 320 hard cap).
          overflowWrap: style?.maxWidth ? "anywhere" : undefined,
          fontSize: style?.fontSize ?? scaledFont,
          fontWeight: style?.fontWeight ?? (filledMain ? 600 : undefined),
          fontFamily: familyFor(style),
          textDecoration: style?.textDecoration,
          textAlign: "center",
        };

  // Selection-ring colour: the node's branch colour, emerald for the root.
  const ringColor = "var(--ed-accent, #be3d32)";

  // Inline task-info line (MindManager schedule/assignment row): start ▸ duration ▸ resources. The
  // priority / progress / due chips render above; this surfaces the remaining task fields the canvas
  // used to drop. Mirrored in the exporter (canvas == export).
  const taskInfo = taskInfoLine({ start, durationDays, resources });

  return (
    <div
      ref={boxRef}
      style={{
        ...box,
        position: "relative",
        boxSizing: "border-box",
        // Per-topic wrap width when set (Narrow/Medium/Wide), else the 320 hard cap. Previously a flat
        // `maxWidth: 320` here silently overrode the per-topic width — so the canvas rendered wide while
        // layout.ts + the SVG export already wrapped to the set width (a canvas==export break, now fixed).
        maxWidth: style?.maxWidth || 320,
        lineHeight: 1.35,
        // Selected: a branded ring (node's branch colour, emerald for the root) + soft glow — the
        // redesign's selection treatment, replacing React Flow's faint default. Hover gets a softer
        // lift so the node reads as interactive (#5). Canvas-only (exports never render selection or
        // hover), so it carries no canvas==export risk.
        boxShadow: dragging
          ? "0 14px 34px rgba(40,30,16,0.28)"
          : dropTarget
            ? // Drag-to-reparent target: a bold emerald ring so the drop destination is unmistakable.
              "0 0 0 3px var(--ed-accent, #be3d32), 0 0 0 8px var(--ed-accent-tint, rgba(190,61,50,0.08))"
            : selected
              ? `0 0 0 2px ${ringColor}, 0 0 0 5px var(--ed-accent-tint, rgba(190,61,50,0.08)), 0 3px 10px rgba(40,30,16,0.08)`
              : hovered
                ? isRoot
                  ? "0 4px 14px rgba(40,30,16,0.15)"
                  : underlineLeaf
                    ? "none"
                    : "0 6px 18px rgba(40,30,16,0.20)"
                : // At rest the cards are flat — unless the topic opts into a raised drop shadow (#4),
                  // which IS a persisted style and so also renders in the export (canvas == export).
                  style?.shadow
                  ? TOPIC_SHADOW_CSS
                  : "none",
        // Hover lift + a pointer cursor signal "you can click/edit me" (#5); selection keeps the ring.
        transform:
          motionProgress < 1
            ? `scale(${0.9 + motionProgress * 0.1})`
            : dragging
              ? "scale(1.025)"
              : hovered && !selected && !isEditing
                ? "translateY(-1px)"
                : undefined,
        transformOrigin: tipLeft ? "right center" : "left center",
        cursor: isEditing ? "text" : dragging ? "grabbing" : "pointer",
        // Read-only Power Filter: fade nodes that aren't on a path to a match.
        opacity: (dimmed ? 0.22 : 1) * motionProgress,
        // Drag-a-marker drop target highlight, else a Find-result highlight ring.
        outline: markerDragOver
          ? "2px dashed var(--ed-accent, #be3d32)"
          : matched
            ? "2px solid #f5a623"
            : undefined,
        outlineOffset: 2,
        transition:
          motionProgress < 1
            ? "none"
            : "opacity 0.16s ease, box-shadow 0.18s ease, transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        editing?.beginEdit(id);
      }}
      // Accept a marker dragged from the palette (#3): highlight on drag-over, toggle on drop.
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(MARKER_DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!markerDragOver) setMarkerDragOver(true);
        }
      }}
      onDragLeave={() => markerDragOver && setMarkerDragOver(false)}
      onDrop={(e) => {
        const marker = e.dataTransfer.getData(MARKER_DND_TYPE);
        if (!marker) return;
        e.preventDefault();
        e.stopPropagation();
        setMarkerDragOver(false);
        editing?.dropMarker(id, marker);
      }}
    >
      <Handle type="target" id="tl" position={Position.Left} style={HANDLE} />
      <Handle type="target" id="tr" position={Position.Right} style={HANDLE} />
      <Handle type="source" id="sl" position={Position.Left} style={HANDLE} />
      <Handle type="source" id="sr" position={Position.Right} style={HANDLE} />
      {/* Drag-to-relate grip — a visible dot on hover; pull it onto another topic to draw a
          cross-link. Not on the root/floating chrome differences; loose mode lets it drop anywhere. */}
      {!isRoot && (
        <Handle
          type="source"
          id="relate"
          // Mirrors the branch's outward edge (left for a left-growing branch) — same side as the
          // add-child ＋ and collapse toggle, matching the tip-side affordance cluster (C4/tipLeft).
          position={tipLeft ? Position.Left : Position.Right}
          className="mm-relate-handle nodrag"
          title={t("canvas.node.relateGrip")}
          // Grabbing the grip retires its one-time coach hint (C7).
          onMouseDown={markRelateHintSeen}
          style={{
            // 16px (was 11) so "drag to link" is a reliable target, not a fiddly dot.
            width: 16,
            height: 16,
            ...(tipLeft ? { left: -8 } : { right: -8 }),
            // Sit below the vertically-centred add-child ＋ (C4) — but when a collapse toggle shares the
            // same edge (a node with children), clamp the grip to ride just above it so the two never
            // overlap on a short node (relateGripGeometry). Grip + toggle always mirror together.
            top: relateGripTopCss(hasChildren),
            transform: "translateY(-50%)",
            border: "2px solid #fff",
            background: branchColor,
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      )}
      {/* On-canvas wrap-width grip (10b Layer 2): a slim vertical bar on the TOP outward edge — clear of
          the centred ＋/relate cluster + the collapse toggle at the tip corner — shown only on a single-
          selected node with the height to clear them (wrapHandleGeometry, side-agnostic). Drag (or
          arrow-key) to set the text-wrap width; the inspector Wrap slider still works on any topic.
          Desktop only (the .mm-wrap-handle @media rule hides it on touch, which keeps the slider). */}
      {showWrapHandle ? (
        <button
          type="button"
          className="mm-wrap-handle nodrag nopan"
          aria-label={t("canvas.node.wrapWidth", {
            width: wrapWidthLabel(styleToWrapWidth(ownStyle?.maxWidth)),
          })}
          title={t("canvas.node.wrapGrip")}
          onPointerDown={onWrapPointerDown}
          onPointerMove={onWrapPointerMove}
          onPointerUp={onWrapPointerUp}
          onKeyDown={onWrapKeyDown}
          style={{
            position: "absolute",
            top: WRAP_HANDLE_TOP,
            ...(tipLeft ? { left: -3 } : { right: -3 }),
            width: WRAP_HANDLE_W,
            height: WRAP_HANDLE_H,
            background: ringColor,
          }}
        />
      ) : null}
      {geom && shape ? (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 0 }}
        >
          <path
            d={shapePath(shape, 0, 0, 100, 100)}
            fill={shapeFill}
            stroke={shapeStroke}
            strokeWidth={shapeStrokeW}
            vectorEffect="non-scaling-stroke"
          />
          {shapeOverlayPath(shape, 0, 0, 100, 100) ? (
            <path
              d={shapeOverlayPath(shape, 0, 0, 100, 100) ?? ""}
              fill="none"
              stroke={shapeStroke}
              strokeWidth={shapeStrokeW}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
      ) : null}
      <div style={{ position: "relative", zIndex: 1 }}>
        {image ? (
          <img
            src={image.url}
            alt=""
            style={{
              display: "block",
              // Honour the stored dimensions (clamped) so the image is the same size on screen and in
              // the export, which also reads image.width/height (canvas == export). Fall back to the
              // SAME 120px default the export uses when a dimension is missing, and `contain` to match
              // the export's preserveAspectRatio="meet" (no stretch) — so the two never diverge.
              width: Math.min(image.width ?? 120, 200),
              height: Math.min(image.height ?? 120, 140),
              maxWidth: 200,
              maxHeight: 140,
              objectFit: "contain",
              borderRadius: 4,
              marginBottom: 4,
            }}
          />
        ) : null}
        {icons?.length ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 2,
              marginBottom: 2,
            }}
          >
            {icons.map((ic) => {
              const url = markerImage(ic);
              return url ? (
                <img
                  key={ic}
                  src={url}
                  alt=""
                  width={14}
                  height={14}
                  style={{ display: "block" }}
                />
              ) : (
                <span key={ic} style={{ fontSize: 13 }}>
                  {ic}
                </span>
              );
            })}
          </div>
        ) : null}
        <span style={{ whiteSpace: "pre-wrap" }}>
          {number ? (
            <span style={{ marginRight: 5, opacity: 0.55, fontVariantNumeric: "tabular-nums" }}>
              {number}
            </span>
          ) : null}
          {isEditing ? <RichEditToolbar editRef={editRef} /> : null}
          {isEditing ? (
            <span style={{ position: "relative", display: "inline-block" }}>
              <span
                ref={editRef}
                contentEditable
                suppressContentEditableWarning
                // contentEditable already exposes an implicit textbox role + focusability; just name it.
                aria-label={
                  topic ? t("canvas.node.editTopicNamed", { topic }) : t("canvas.node.editTopic")
                }
                spellCheck={editing?.spellcheck ?? false}
                className="nodrag nopan"
                style={{ outline: "none", display: "inline-block", minWidth: 16 }}
                // Also re-sync on keyup/click so the link menu tracks caret moves (arrow keys, clicks),
                // not just text changes — onInput alone misses a caret that moves without editing.
                onInput={syncMenus}
                onKeyUp={syncMenus}
                onClick={syncMenus}
                onKeyDown={(e) => {
                  // An open menu owns Arrow/Enter/Tab/Escape; anything else falls through to normal
                  // typing (and re-filters via onInput/onKeyUp). Slash and link menus never co-exist.
                  if (slashOpen) {
                    const r = slashMenuKey(e.key, slashIndex, slashItems.length);
                    if (r.action !== "passthrough") {
                      e.preventDefault();
                      if (r.action === "move") setSlashIndex(r.index);
                      else if (r.action === "close") {
                        setSlashItems([]);
                        // Latch the current text so the keyup re-sync doesn't reopen the menu.
                        dismissedRef.current = editRef.current?.textContent ?? "";
                      } else if (r.action === "select")
                        editing?.runSlashCommand(id, slashItems[slashIndex].id);
                      return;
                    }
                  } else if (linkOpen) {
                    const r = slashMenuKey(e.key, linkIndex, linkItems.length);
                    if (r.action !== "passthrough") {
                      e.preventDefault();
                      if (r.action === "move") setLinkIndex(r.index);
                      else if (r.action === "close") {
                        setLinkTrigger(null);
                        dismissedRef.current = editRef.current?.textContent ?? "";
                      } else if (r.action === "select") selectLink(linkItems[linkIndex]);
                      return;
                    }
                  } else if (tagOpen) {
                    const r = slashMenuKey(e.key, tagIndex, tagItems.length);
                    if (r.action !== "passthrough") {
                      e.preventDefault();
                      if (r.action === "move") setTagIndex(r.index);
                      else if (r.action === "close") {
                        setTagTrigger(null);
                        dismissedRef.current = editRef.current?.textContent ?? "";
                      } else if (r.action === "select") selectTag(tagItems[tagIndex]);
                      return;
                    }
                  }
                  const html = editRef.current?.innerHTML ?? "";
                  handleEditorKeyDown(e, {
                    format: (tag) => {
                      if (editRef.current) toggleInline(editRef.current, tag);
                    },
                    commit: () => editing?.commitEdit(id, html, true),
                    commitAndAdd: (what) => editing?.commitAndAdd(id, html, what),
                    cancel: () => editing?.cancelEdit(html),
                  });
                }}
                onBlur={() => editing?.commitEdit(id, editRef.current?.innerHTML ?? "")}
              />
              {slashOpen ? (
                // Plain buttons (not an ARIA listbox): keyboard focus stays in the editor — the menu is
                // driven by the editor's keydown + aria-pressed reflects the highlighted row — so a
                // focusable listbox would fight the contentEditable. Buttons are natively interactive.
                <div
                  className="nodrag nopan mm-slash-menu"
                  aria-label={t("canvas.menu.insertCommand")}
                >
                  {slashItems.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      type="button"
                      aria-pressed={i === slashIndex}
                      // Keep focus in the editor (a blur would commit/discard the node before the
                      // command runs); the click still fires.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setSlashIndex(i)}
                      onClick={() => editing?.runSlashCommand(id, cmd.id)}
                      data-active={i === slashIndex || undefined}
                      className="mm-slash-item"
                    >
                      <span>{cmd.label}</span>
                      {cmd.hint ? <span className="mm-slash-hint">{cmd.hint}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {linkOpen ? (
                <div
                  className="nodrag nopan mm-slash-menu"
                  aria-label={t("canvas.menu.linkToTopic")}
                >
                  {linkItems.map((cand, i) => (
                    <button
                      key={cand.id}
                      type="button"
                      aria-pressed={i === linkIndex}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setLinkIndex(i)}
                      onClick={() => selectLink(cand)}
                      data-active={i === linkIndex || undefined}
                      className="mm-slash-item"
                    >
                      <span>{cand.label}</span>
                      <span className="mm-slash-hint">🔗</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {tagOpen ? (
                <div className="nodrag nopan mm-slash-menu" aria-label={t("common.addTag")}>
                  {tagItems.map((tag, i) => {
                    // The first row for a brand-new (not-yet-existing) tag reads as "create".
                    const isNew =
                      i === 0 &&
                      tag.trim().length > 0 &&
                      !(editing?.tagCandidates() ?? []).some(
                        (t) => t.toLowerCase() === tag.toLowerCase(),
                      );
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={i === tagIndex}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setTagIndex(i)}
                        onClick={() => selectTag(tag)}
                        data-active={i === tagIndex || undefined}
                        className="mm-slash-item"
                      >
                        <span>
                          {isNew ? t("canvas.slash.newTagPrefix") : ""}#{tag}
                        </span>
                        <span className="mm-slash-hint">🏷️</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </span>
          ) : richHtml ? (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: richHtml is sanitised in io/richText
            <span dangerouslySetInnerHTML={{ __html: richHtml }} />
          ) : (
            topic
          )}
          {hyperlink ? (
            <button
              type="button"
              className="nodrag nopan"
              title={t("canvas.node.followLink", { url: hyperlink })}
              onClick={(e) => {
                e.stopPropagation();
                editing?.openLink(hyperlink);
              }}
              style={{
                marginLeft: 4,
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                font: "inherit",
              }}
            >
              🔗
            </button>
          ) : null}
          {note?.trim() ? (
            <button
              type="button"
              className="nodrag nopan"
              title={t("canvas.node.showNote")}
              aria-label={t("canvas.node.showNote")}
              onClick={(e) => {
                e.stopPropagation();
                editing?.openNote(id);
              }}
              onMouseEnter={() => setPeekNote(true)}
              onMouseLeave={() => setPeekNote(false)}
              style={{
                marginLeft: 4,
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                font: "inherit",
                opacity: 0.55,
              }}
            >
              📝
            </button>
          ) : null}
          {locked ? (
            <span
              title={t("canvas.node.positionLocked")}
              aria-label={t("canvas.node.positionLockedShort")}
              style={{ marginLeft: 4, opacity: 0.55, fontSize: "0.85em" }}
            >
              🔒
            </span>
          ) : null}
          {rollup ? (
            <span
              title={
                rollupTitle
                  ? t("canvas.node.rollUpMirrors", { title: rollupTitle })
                  : t("canvas.node.rollUpMirrorsUnknown")
              }
              aria-label={t("canvas.node.rollUpSource")}
              style={{ marginLeft: 4, opacity: 0.6, fontSize: "0.85em" }}
            >
              ⤵
            </span>
          ) : null}
        </span>
        {peekNote && note?.trim() ? (
          // Hover-peek: read the note without opening the inspector. Clamped + scrollable for long notes.
          <output
            className="nodrag nopan"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 6,
              maxWidth: 280,
              maxHeight: 160,
              overflow: "auto",
              padding: "8px 10px",
              borderRadius: 8,
              background: "#fffef7",
              border: "1px solid #e7dca8",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
              fontSize: 12,
              lineHeight: 1.45,
              color: "#3a3320",
              whiteSpace: "pre-wrap",
              zIndex: 7,
            }}
          >
            {note.trim().slice(0, 600)}
            {note.trim().length > 600 ? "…" : ""}
          </output>
        ) : null}
        {progress || due || attachmentCount || priority ? (
          <div
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {priority ? (
              editing ? (
                <button
                  type="button"
                  className="nodrag nopan"
                  title={t("panel.priorityNamedCycle", { level: priorityLabel(priority) })}
                  onClick={(e) => {
                    e.stopPropagation();
                    editing.cyclePriority(id);
                  }}
                  style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
                >
                  <Badge bg={priorityColor(priority)} color="#fff" fontWeight={600}>
                    {priorityLabel(priority)}
                  </Badge>
                </button>
              ) : (
                <Badge
                  title={t("panel.priorityNamed", { level: priorityLabel(priority) })}
                  bg={priorityColor(priority)}
                  color="#fff"
                  fontWeight={600}
                >
                  {priorityLabel(priority)}
                </Badge>
              )
            ) : null}
            {due ? (
              <DateChip due={due} overdue={isOverdue(due, progress?.progress ?? 0, todayISO())} />
            ) : null}
            {attachmentCount ? (
              <Badge
                title={
                  attachmentNames?.length
                    ? `Attachments:\n${attachmentNames.join("\n")}`
                    : `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`
                }
              >
                📎 {attachmentCount}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {taskInfo ? (
          <div style={{ marginTop: 3, fontSize: 11, opacity: 0.65, whiteSpace: "pre-wrap" }}>
            {taskInfo}
          </div>
        ) : null}
        {tags?.length ? (
          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {tags.map((t) => (
              <span key={t} style={chipStyle}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {hasChildren ? (
        <button
          type="button"
          className="mm-collapse-toggle nodrag nopan"
          title={collapsed ? t("canvas.expand") : t("canvas.collapse")}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? `Expand${hiddenCount ? ` (${hiddenCount} hidden)` : ""}` : "Collapse"
          }
          onClick={(e) => {
            e.stopPropagation();
            editing?.toggleCollapse(id);
          }}
          onMouseEnter={() => setPeekCollapsed(true)}
          onMouseLeave={() => setPeekCollapsed(false)}
          style={{
            position: "absolute",
            // Leaf-facing edge: left for a left-growing branch (two-sided left half / all-left), else
            // right — so the toggle sits at the branch tip like MindManager, not toward the root.
            ...(tipLeft ? { left: -8 } : { right: -8 }),
            bottom: -8,
            // Size/shape/font live in CSS (.mm-collapse-toggle) so the touch (coarse-pointer) escalation
            // actually applies — inline width would otherwise outrank the @media rule. Only the dynamic
            // branch-coloured border/text stays inline.
            border: `1px solid ${branchColor}`,
            background: "var(--mm-node-bg, #fff)",
            color: branchColor,
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          {collapsed ? (hiddenCount ?? "+") : "−"}
        </button>
      ) : null}
      {/* Hover-peek the hidden children of a collapsed branch — decide whether to expand without a
          re-layout. Mirrors the note hover-peek; canvas-only (not authored into exports). */}
      {peekCollapsed && collapsed && childTitles?.length ? (
        <output
          className="nodrag nopan"
          style={{
            position: "absolute",
            top: "100%",
            ...(tipLeft ? { left: 0 } : { right: 0 }),
            marginTop: 6,
            maxWidth: 240,
            padding: "6px 10px",
            borderRadius: 8,
            background: "#fffef7",
            border: "1px solid #e7dca8",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#3a3320",
            zIndex: 7,
          }}
        >
          {/* `title`, not `t` — the loop variable used to shadow the translation function, which made
              `t("…")` unreachable inside this block. */}
          {childTitles.map((title, i) => (
            <div
              key={`${i}:${title}`}
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {title.trim() || t("common.untitled")}
            </div>
          ))}
          {(hiddenCount ?? 0) > childTitles.length ? (
            <div style={{ opacity: 0.6 }}>
              {t("canvas.node.moreChildren", { n: (hiddenCount ?? 0) - childTitles.length })}
            </div>
          ) : null}
        </output>
      ) : null}
      {/* Branch creation intentionally lives in the topic's context menu. Keeping the node itself free
          of hover/selection ＋ buttons avoids accidental activation and leaves the map visually calm. */}
      {hovered && !isEditing && !editHintSeen ? (
        <span className="mm-node-hint nodrag nopan">
          <span className="mm-hint-mouse">{t("canvas.coach.editMouse")}</span>
          <span className="mm-hint-touch">{t("canvas.coach.editTouch")}</span>
        </span>
      ) : null}
      {/* Drag-to-relate coach (C7) — shown after the edit hint is retired, until the grip is grabbed.
          Non-root only (the root has no grip); hidden on touch via CSS (the grip is hidden there too). */}
      {hovered && !isRoot && !isEditing && editHintSeen && !relateHintSeen ? (
        <span className="mm-relate-hint nodrag nopan">{t("canvas.coach.relate")}</span>
      ) : null}
    </div>
  );
}

export const TopicNode = memo(TopicNodeImpl);
