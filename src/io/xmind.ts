import { t } from "../i18n/registry";
import "./messages";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, strToU8, zipSync } from "fflate";
import type { CrossLink, MapNode, MindMapDoc, NodeStyle } from "../model/types";
import { isDangerousUrl } from "./urlSafety";
import { unzipOrThrow } from "./zip";

// XMind `.xmind` <-> canonical model (two-way).
//
// A `.xmind` file is a ZIP. Modern XMind (2020+) stores the map in `content.json`: an
// array of sheets, each with a `rootTopic` whose `children.attached[]` form the tree.
// We map title -> topic, attached children -> children, `notes.plain.content` -> note,
// `href` -> hyperlink, and `labels[]` -> tags. Older XMind (pre-2020) stores the map in
// `content.xml`: root `<xmap-content>` → `<sheet>` → `<topic>`, with child topics under
// `<children><topics type="attached"><topic>…</topic></topics></children>`, notes under
// `<notes><plain>…</plain></notes>`, hyperlinks via an `xlink:href` attribute (normalised
// to `href` before parsing), and labels under `<labels><label>…</label></labels>`. Both
// paths are supported on import. The exporter writes `content.json` (plus
// `metadata.json`/`manifest.json` XMind expects).
//
// The round trip is closed: tree, notes, hyperlinks, tags, **floating topics**
// (`children.detached`), **cross-links** (sheet `relationships`), **markers**
// (`topic.markers[].markerId` <-> our emoji, via icons.ts) and **per-topic style**
// (`topic.style.properties` <-> NodeStyle) all survive out and back. Relationships reference
// topic ids, and the importer mints its own node ids, so the walk records an
// original-id -> new-id map and resolves the endpoints through it; a relationship whose ends
// don't both resolve is dropped rather than left dangling.
//
// Known-lossy, by design: LEGACY (pre-2020) per-topic *style* lives in a separate `styles.xml`
// keyed by a `style-id` reference — a different subsystem, so legacy imports carry markers and
// structure but not colours. Style properties outside the mapped set (XMind's line/shape/branch
// styling) are not translated in either direction. fflate does the zip/unzip.

// --- XMind marker vocabulary ----------------------------------------------
//
// Mirrors the MindManager pair in icons.ts (MM_ICON_MAP + EMOJI_TO_MM) but lives HERE, next to the
// only code that uses it: icons.ts sits in the eager entry chunk and this adapter is lazy, so
// keeping the tables here costs the initial bundle nothing. XMind ids are lower-kebab and
// group-prefixed with colour baked in, so every colour variant of a shape collapses to one glyph.
// Unknown ids are kept as-is so nothing is silently lost.

const XMIND_MARKER_MAP: Record<string, string> = {
  "priority-1": "1️⃣",
  "priority-2": "2️⃣",
  "priority-3": "3️⃣",
  "priority-4": "4️⃣",
  "priority-5": "5️⃣",
  "priority-6": "6️⃣",
  "priority-7": "7️⃣",
  "priority-8": "8️⃣",
  "priority-9": "9️⃣",
  // XMind's task group is a completion dial; only the ends have a clean emoji equivalent.
  "task-done": "✅",
  "task-start": "⏳",
  "task-oct": "⏳",
  "task-quarter": "⏳",
  "task-3oct": "⏳",
  "task-half": "⏳",
  "task-5oct": "⏳",
  "task-3quar": "⏳",
  "task-7oct": "⏳",
  "task-pause": "⏳",
  "flag-red": "🚩",
  "flag-orange": "🚩",
  "flag-yellow": "🚩",
  "flag-green": "🚩",
  "flag-blue": "🚩",
  "flag-purple": "🚩",
  "flag-black": "🚩",
  "flag-gray": "🚩",
  "flag-dark-blue": "🚩",
  "star-red": "⭐",
  "star-orange": "⭐",
  "star-yellow": "⭐",
  "star-green": "⭐",
  "star-blue": "⭐",
  "star-purple": "⭐",
  "people-red": "👤",
  "people-orange": "👤",
  "people-yellow": "👤",
  "people-green": "👤",
  "people-blue": "👤",
  "people-purple": "👤",
  "symbol-exclam": "❗",
  "symbol-question": "❓",
  "symbol-plus": "➕",
  "symbol-minus": "➖",
  "symbol-right": "✅",
  "symbol-wrong": "❌",
  "symbol-attention": "⚠️",
  "symbol-info": "💬",
  "symbol-pin": "📌",
  "symbol-star": "⭐",
  "symbol-heart": "❤️",
  "smiley-smile": "🙂",
  "smiley-laugh": "🙂",
  "smiley-cry": "🙁",
  "smiley-surprise": "😐",
  "smiley-boring": "😐",
  "arrow-up": "⬆️",
  "arrow-down": "⬇️",
  "arrow-left": "⬅️",
  "arrow-right": "➡️",
};

/** The emoji for an XMind marker id, or the id itself when we have no mapping (kept, not dropped, so
 *  an unknown marker survives the import as a visible glyph). Pure + deterministic. */
export function xmindMarkerToEmoji(id: string): string {
  return XMIND_MARKER_MAP[id.trim().toLowerCase()] ?? id;
}

// Curated inverse for the `.xmind` writer. XMIND_MARKER_MAP is many-to-one (🚩 has 9 source ids, ⏳
// has 9), so the inverse picks one canonical id per emoji — a colour variant collapses to the group's
// most neutral member. Emoji with no XMind stock equivalent are intentionally absent and skipped by
// the writer rather than emitted as junk marker ids. Round-trips via xmindMarkerToEmoji.
const EMOJI_TO_XMIND: Record<string, string> = {
  "1️⃣": "priority-1",
  "2️⃣": "priority-2",
  "3️⃣": "priority-3",
  "4️⃣": "priority-4",
  "5️⃣": "priority-5",
  "6️⃣": "priority-6",
  "7️⃣": "priority-7",
  "8️⃣": "priority-8",
  "9️⃣": "priority-9",
  "✅": "task-done",
  "⏳": "task-half",
  "🚩": "flag-red",
  "⭐": "star-yellow",
  "👤": "people-blue",
  "❗": "symbol-exclam",
  "❓": "symbol-question",
  "➕": "symbol-plus",
  "➖": "symbol-minus",
  "❌": "symbol-wrong",
  "⚠️": "symbol-attention",
  "💬": "symbol-info",
  "📌": "symbol-pin",
  "❤️": "symbol-heart",
  "🙂": "smiley-smile",
  "🙁": "smiley-cry",
  "😐": "smiley-boring",
  "⬆️": "arrow-up",
  "⬇️": "arrow-down",
  "⬅️": "arrow-left",
  "➡️": "arrow-right",
};

/** A canonical XMind marker id for an emoji marker, or null when XMind has no equivalent (the
 *  `.xmind` writer then omits it). Pure + deterministic. */
export function emojiToXmindMarker(emoji: string): string | null {
  return EMOJI_TO_XMIND[emoji.trim()] ?? null;
}

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from arbitrary XMind JSON / XML
type Json = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

let xmId = 0;

// --- style translation (modern content.json only) -------------------------
//
// XMind styles topics with an XSL-FO / SVG property bag; we keep a CSS-ish NodeStyle. Only the
// properties with a clean two-way equivalent are translated — the rest are left alone in both
// directions rather than guessed at.

// XMind sizes are points, ours are CSS px strings (1pt = 4/3 px). Deliberately NOT rounded to whole
// points: a 2px border would round to 2pt and come back as 3px, so thin borders grew on every round
// trip. Both conversions keep the integer numerator (`n * 4 / 3`, not `n * (4/3)`) so exact cases
// stay exact, and `trim` drops the float noise without introducing a rounding step.
const trim = (n: number): string => String(Number(n.toFixed(4)));

function ptToPx(v: string): string | undefined {
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? `${trim((n * 4) / 3)}px` : undefined;
}

function pxToPt(v: string): string {
  const n = Number.parseFloat(String(v));
  return `${Number.isFinite(n) ? trim((n * 3) / 4) : 12}pt`;
}

function styleFromProps(props: Json): NodeStyle | undefined {
  if (!props || typeof props !== "object") return undefined;
  const s: NodeStyle = {};
  const fill = props["svg:fill"];
  if (typeof fill === "string" && fill) s.background = fill;
  const color = props["fo:color"];
  if (typeof color === "string" && color) s.color = color;
  const family = props["fo:font-family"];
  if (typeof family === "string" && family) s.fontFamily = family;
  const size = props["fo:font-size"];
  if (typeof size === "string" && size) {
    const px = ptToPx(size);
    if (px) s.fontSize = px;
  }
  const weight = props["fo:font-weight"];
  if (typeof weight === "string" && weight) s.fontWeight = weight;
  // Border: XMind splits colour + width; we carry the CSS shorthand. Only build one when a colour
  // is present — a width with no colour has nothing meaningful to render.
  const bc = props["border-line-color"];
  const bw = props["border-line-width"];
  if (typeof bc === "string" && bc) {
    const w = typeof bw === "string" && bw ? ptToPx(bw) : undefined;
    s.border = `${w ?? "1px"} solid ${bc}`;
  }
  return Object.keys(s).length > 0 ? s : undefined;
}

/** Split a CSS `border` shorthand back into XMind's width + colour pair. Tolerant: anything that
 *  doesn't parse simply isn't emitted. */
function propsFromStyle(style: NodeStyle | undefined): Json | undefined {
  if (!style) return undefined;
  const p: Json = {};
  if (style.background) p["svg:fill"] = style.background;
  if (style.color) p["fo:color"] = style.color;
  if (style.fontFamily) p["fo:font-family"] = style.fontFamily;
  if (style.fontSize) p["fo:font-size"] = pxToPt(style.fontSize);
  if (style.fontWeight) p["fo:font-weight"] = style.fontWeight;
  if (style.border) {
    const m = /^\s*([\d.]+)px\s+\w+\s+(.+?)\s*$/.exec(style.border);
    if (m) {
      p["border-line-width"] = pxToPt(m[1]);
      p["border-line-color"] = m[2];
    }
  }
  return Object.keys(p).length > 0 ? p : undefined;
}

/** `topicToNode`, recording original XMind topic id -> minted node id so sheet relationships can be
 *  resolved to the ids the imported doc actually uses. */
function topicToNode(t: Json, idMap?: Map<string, string>): MapNode {
  xmId += 1;
  const node: MapNode = {
    id: `xm${xmId}`,
    topic: String(t?.title ?? "").trim(),
    children: (Array.isArray(t?.children?.attached) ? t.children.attached : []).map((c: Json) =>
      topicToNode(c, idMap),
    ),
  };
  if (idMap && typeof t?.id === "string" && t.id) idMap.set(t.id, node.id);
  const note = t?.notes?.plain?.content;
  if (typeof note === "string" && note.trim()) node.note = note.trim();
  const href = t?.href;
  // XMind uses xmind:#<id> for internal jumps and file:/attachment refs — keep only real
  // web links, and drop dangerous schemes exactly like the rest of the app.
  if (typeof href === "string" && href && !href.startsWith("xmind:") && !isDangerousUrl(href)) {
    node.hyperlink = href;
  }
  if (Array.isArray(t?.labels) && t.labels.length > 0) node.tags = t.labels.map(String);
  const markers = asList(t?.markers)
    .map((m: Json) => (typeof m?.markerId === "string" ? xmindMarkerToEmoji(m.markerId) : ""))
    .filter(Boolean);
  if (markers.length > 0) node.icons = markers;
  const style = styleFromProps(t?.style?.properties);
  if (style) node.style = style;
  return node;
}

/** Sheet `relationships[]` -> our cross-links, with both endpoints resolved through `idMap`. A
 *  relationship pointing at a topic we didn't import (or a malformed one) is dropped. */
function relationshipsToLinks(sheet: Json, idMap: Map<string, string>): CrossLink[] {
  return asList(sheet?.relationships)
    .map((r: Json, i: number): CrossLink | null => {
      const from = idMap.get(String(r?.end1Id ?? ""));
      const to = idMap.get(String(r?.end2Id ?? ""));
      if (!from || !to) return null;
      const label = typeof r?.title === "string" && r.title.trim() ? r.title.trim() : undefined;
      return { id: String(r?.id || `xmrel${i + 1}`), from, to, ...(label ? { label } : {}) };
    })
    .filter((l): l is CrossLink => l !== null);
}

// --- legacy content.xml parser --------------------------------------------

// Convert a fast-xml-parser topic element (from legacy content.xml) into a MapNode.
// The parser is configured with ignoreAttributes:false, attributeNamePrefix:"@_".
// xlink:href has been pre-normalised to href in the raw XML before parsing so that
// fast-xml-parser sees a plain attribute (the colon in "xlink:href" would otherwise
// produce "@_xlink:href" which some parsers can't handle cleanly).
function xmlTopicToNode(t: Json, idMap?: Map<string, string>): MapNode {
  xmId += 1;
  // <title> can come back as a string or as { "#text": string } when it has attributes.
  const rawTitle = t?.title;
  const topic =
    typeof rawTitle === "object" && rawTitle !== null
      ? String(rawTitle["#text"] ?? "").trim()
      : String(rawTitle ?? "").trim();

  // Attached children live at: children → topics[@_type="attached"] → topic[]
  const childTopicsContainers = asList(t?.children?.topics);
  const attachedContainer = childTopicsContainers.find((tp: Json) => tp?.["@_type"] === "attached");
  const children = asList(attachedContainer?.topic).map((c: Json) => xmlTopicToNode(c, idMap));

  const node: MapNode = { id: `xm${xmId}`, topic, children };
  if (idMap && typeof t?.["@_id"] === "string" && t["@_id"]) idMap.set(t["@_id"], node.id);

  // Notes: <notes><plain>text</plain></notes>
  const plainNote = t?.notes?.plain;
  const noteText =
    typeof plainNote === "string"
      ? plainNote.trim()
      : typeof plainNote === "object" && plainNote !== null
        ? String(plainNote["#text"] ?? "").trim()
        : "";
  if (noteText) node.note = noteText;

  // Hyperlink: href attribute (pre-normalised from xlink:href)
  const href = t?.["@_href"];
  if (typeof href === "string" && href && !href.startsWith("xmind:") && !isDangerousUrl(href)) {
    node.hyperlink = href;
  }

  // Labels/tags: <labels><label>text</label></labels>
  const labelItems = asList(t?.labels?.label);
  if (labelItems.length > 0) node.tags = labelItems.map(String);

  // Markers: <marker-refs><marker-ref marker-id="priority-1"/></marker-refs>
  const markerRefs = asList(t?.["marker-refs"]?.["marker-ref"])
    .map((m: Json) => {
      const id = m?.["@_marker-id"];
      return typeof id === "string" && id ? xmindMarkerToEmoji(id) : "";
    })
    .filter(Boolean);
  if (markerRefs.length > 0) node.icons = markerRefs;

  return node;
}

function fromXmindXml(xmlBytes: Uint8Array): MindMapDoc {
  let xmlText = strFromU8(xmlBytes);
  // Normalise xlink:href → href so fast-xml-parser sees a plain attribute name.
  // The xlink namespace declaration is harmless after this substitution.
  xmlText = xmlText.replace(/xlink:href=/g, "href=");

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(xmlText);

  // Root element is <xmap-content>; fast-xml-parser keys it as "xmap-content".
  const xmapContent = tree?.["xmap-content"];
  if (!xmapContent) throw new Error(t("io.err.xmindNoRootElement"));

  const sheet = asList(xmapContent?.sheet)[0];
  if (!sheet) throw new Error(t("io.err.xmindNoSheet"));

  const rootTopicEl = asList(sheet?.topic)[0];
  if (!rootTopicEl) throw new Error(t("io.err.xmindSheetNoTopic"));

  const idMap = new Map<string, string>();
  const root = xmlTopicToNode(rootTopicEl, idMap);

  // Detached (floating) topics: children → topics[@_type="detached"] → topic[]
  const detachedContainer = asList(rootTopicEl?.children?.topics).find(
    (tp: Json) => tp?.["@_type"] === "detached",
  );
  const floating = asList(detachedContainer?.topic).map((t: Json) => xmlTopicToNode(t, idMap));

  // Cross-links: <relationships><relationship end1="id" end2="id"><title>…</title></relationship>
  const links = asList(sheet?.relationships?.relationship)
    .map((r: Json, i: number): CrossLink | null => {
      const from = idMap.get(String(r?.["@_end1"] ?? ""));
      const to = idMap.get(String(r?.["@_end2"] ?? ""));
      if (!from || !to) return null;
      const rawTitle = r?.title;
      const label = (
        typeof rawTitle === "object" && rawTitle !== null
          ? String(rawTitle["#text"] ?? "")
          : String(rawTitle ?? "")
      ).trim();
      return {
        id: String(r?.["@_id"] || `xmrel${i + 1}`),
        from,
        to,
        ...(label ? { label } : {}),
      };
    })
    .filter((l): l is CrossLink => l !== null);

  // Sheet title: <title> child of <sheet>, or fall back to root topic text.
  const rawSheetTitle = sheet?.title;
  const sheetTitle =
    typeof rawSheetTitle === "object" && rawSheetTitle !== null
      ? String(rawSheetTitle["#text"] ?? "").trim()
      : String(rawSheetTitle ?? "").trim();

  const title = sheetTitle || root.topic || "Imported XMind map";
  return {
    schemaVersion: 1,
    id: `xm${xmId + 1}`,
    title,
    root,
    ...(links.length > 0 ? { links } : {}),
    ...(floating.length > 0 ? { floatingTopics: floating } : {}),
    meta: { source: "xmind" },
  };
}

// --------------------------------------------------------------------------

export function fromXmind(bytes: Uint8Array): MindMapDoc {
  xmId = 0;
  const files = unzipOrThrow(bytes, ".xmind");

  // Modern XMind (2020+): content.json takes priority.
  const content = files["content.json"];
  if (content) {
    const sheets = JSON.parse(strFromU8(content));
    const sheet = Array.isArray(sheets) ? sheets[0] : sheets;
    const rootTopic = sheet?.rootTopic;
    if (!rootTopic) throw new Error(t("io.err.xmindNoRootTopic"));
    const idMap = new Map<string, string>();
    const root = topicToNode(rootTopic, idMap);
    // Detached topics hang off the root in XMind's model but are top-level in ours.
    const floating = asList(rootTopic?.children?.detached).map((t: Json) => topicToNode(t, idMap));
    const links = relationshipsToLinks(sheet, idMap);
    const title = String(sheet?.title || root.topic || "Imported XMind map");
    return {
      schemaVersion: 1,
      id: `xm${xmId + 1}`,
      title,
      root,
      ...(links.length > 0 ? { links } : {}),
      ...(floating.length > 0 ? { floatingTopics: floating } : {}),
      meta: { source: "xmind" },
    };
  }

  // Legacy XMind (pre-2020): fall back to content.xml.
  const xmlContent = files["content.xml"];
  if (xmlContent) {
    return fromXmindXml(xmlContent);
  }

  throw new Error(t("io.err.xmindUnsupported"));
}

// --- export ---------------------------------------------------------------

function nodeToTopic(node: MapNode): Json {
  const topic: Json = { id: node.id, title: node.topic };
  if (node.children.length > 0) {
    topic.children = { attached: node.children.map(nodeToTopic) };
  }
  if (node.note) topic.notes = { plain: { content: node.note } };
  if (node.hyperlink && !isDangerousUrl(node.hyperlink)) topic.href = node.hyperlink;
  if (node.tags?.length) topic.labels = node.tags.map(String);
  // Markers XMind has no equivalent for are skipped rather than emitted as junk ids.
  const markers = (node.icons ?? [])
    .map(emojiToXmindMarker)
    .filter((id): id is string => id !== null)
    .map((markerId) => ({ markerId }));
  if (markers.length > 0) topic.markers = markers;
  const props = propsFromStyle(node.style);
  if (props) topic.style = { id: `${node.id}-style`, type: "topic", properties: props };
  return topic;
}

/** Canonical model -> a modern (2020+) `.xmind` ZIP (content.json + metadata + manifest). */
export function toXmind(doc: MindMapDoc): Uint8Array {
  const rootTopic = nodeToTopic(doc.root);
  // Floating topics aren't part of the central tree — XMind models them as detached children.
  const floating = (doc.floatingTopics ?? []).map(nodeToTopic);
  if (floating.length > 0) {
    rootTopic.children = { ...(rootTopic.children ?? {}), detached: floating };
  }
  const sheet: Json = {
    id: `${doc.id}-sheet`,
    class: "sheet",
    title: doc.title || "Sheet 1",
    rootTopic,
  };
  // Cross-links -> XMind relationships (referencing topic ids, which are our node ids).
  const rels = (doc.links ?? []).map((l) => ({
    id: l.id,
    end1Id: l.from,
    end2Id: l.to,
    ...(l.label ? { title: l.label } : {}),
  }));
  if (rels.length > 0) sheet.relationships = rels;

  const content = JSON.stringify([sheet]);
  const metadata = JSON.stringify({ creator: { name: "iThread" } });
  const manifest = JSON.stringify({
    "file-entries": { "content.json": {}, "metadata.json": {} },
  });
  return zipSync({
    "content.json": strToU8(content),
    "metadata.json": strToU8(metadata),
    "manifest.json": strToU8(manifest),
  });
}
