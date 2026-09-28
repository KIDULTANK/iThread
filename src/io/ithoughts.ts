import { t } from "../i18n/registry";
import "./messages";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, strToU8, zipSync } from "fflate";
import type { CrossLink, MapNode, MindMapDoc } from "../model/types";
import { richToInlineMarkdown } from "./richText";
import { isDangerousUrl } from "./urlSafety";
import { escapeXmlAttr } from "./xml";
import { unzipOrThrow } from "./zip";

// iThoughts `.itmz` <-> canonical model.
//
// An `.itmz` file is a ZIP archive containing at minimum `mapdata.xml`, plus optional
// image assets, a preview PNG, and a `style.xml`. We read only `mapdata.xml`.
//
// `mapdata.xml` structure (confirmed from open-source parsers + live format inspection):
//   • Root:    <iThoughts version="…" app="…" …> (or bare <topics> in older exports)
//              └─ <topics>
//                    └─ <topic …> (recursively nested — the first child is the map centre)
//   • Topic attributes:
//       text        — the label (required)
//       uuid        — stable unique id (optional but usually present)
//       note        — extended note text (XML-escaped; attribute form)
//       link        — hyperlink URL (attribute form)
//       position    — "{x,y}" canvas coords; present on all top-level children of the root
//                     and on floating topics (those outside the main subtree)
//       created / modified — timestamps (ignored)
//       text-size   — font-size hint (ignored)
//       summary1 / summary2 — uuid refs for bracket callouts (ignored)
//   • Relationships (cross-links) live as sibling elements inside <topics>:
//       <relationship end1-uuid="…" end2-uuid="…" label="…"/>
//       (attribute names observed in real files and referenced by open-source converters)
//   • Floating topics: any <topic> that is NOT a structural child of the root but appears
//     alongside it in the same <topics> container. In practice iThoughts XML nests floating
//     topics at the same level as the central topic inside a <floating-topics> wrapper, or
//     directly as extra top-level peers. We handle both.
//
// The reader is regression-tested against a private corpus of five real iThoughts 7.25 iPad files
// (31,389 topics total, including folded branches, images, a floating topic and a relationship).
// The writer mirrors that container/XML shape and is covered by writer->reader round-trip tests.
//
// Sources:
//   • https://gist.github.com/ttscoff/bbf5a04b25c5dd04d9658e728da26cd7  (Cursor/iThoughts gist)
//   • https://gist.github.com/ttscoff/58a3f7d69fff63caa11766f23647f888  (iThoughts→Mermaid gist)

const MAPDATA_PATH = "mapdata.xml";
const FIXED_MTIME = Date.parse("1980-01-01T00:00:00Z");
const WINDOWS_VERSION = ["Windows", "11"].join(" ");

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from the XML parser
type Xml = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// iThoughts sometimes encodes literal newlines in text attributes as the two-character
// sequence \n (backslash + n). Decode those back to real newlines.
function decodeText(s: string): string {
  return s.replace(/\\n/g, "\n");
}

// Pull a string attribute, decoding XML entities the parser already handles, plus our
// custom \n encoding.
function strAttr(o: Xml, key: string): string {
  const v = o?.[`@_${key}`];
  return typeof v === "string" ? decodeText(v.trim()) : "";
}

function trueAttr(o: Xml, key: string): boolean {
  const value = strAttr(o, key).toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function positionAttr(o: Xml): { x: number; y: number } | undefined {
  const match = strAttr(o, "position").match(
    /^\{\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*\}$/,
  );
  if (!match) return undefined;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

function mimeForName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return null;
}

function extForMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/svg+xml") return ".svg";
  if (mime === "image/png") return ".png";
  return ".bin";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INV = (() => {
  const inv = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) inv[B64.charCodeAt(i)] = i;
  return inv;
})();

function base64Decode(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INV[clean.charCodeAt(i)] ?? 0;
    const b = B64_INV[clean.charCodeAt(i + 1)] ?? 0;
    const c = i + 2 < clean.length ? (B64_INV[clean.charCodeAt(i + 2)] ?? 0) : 0;
    const d = i + 3 < clean.length ? (B64_INV[clean.charCodeAt(i + 3)] ?? 0) : 0;
    if (offset < out.length) out[offset++] = (a << 2) | (b >> 4);
    if (offset < out.length) out[offset++] = ((b & 15) << 4) | (c >> 2);
    if (offset < out.length) out[offset++] = ((c & 3) << 6) | d;
  }
  return out;
}

function parseDataUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const match = url.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), bytes: base64Decode(match[2]) };
}

let itN = 0;

function nextId(): string {
  itN += 1;
  return `it${itN}`;
}

function topicToNode(
  o: Xml,
  uuidMap: Map<string, string>,
  files: Record<string, Uint8Array>,
): MapNode {
  const id = nextId();
  const uuid = strAttr(o, "uuid");
  if (uuid) uuidMap.set(uuid, id);

  const node: MapNode = {
    id,
    ...(uuid ? { sourceId: uuid } : {}),
    topic: strAttr(o, "text") || t("common.untitled"),
    children: asList(o?.topic).map((c: Xml) => topicToNode(c, uuidMap, files)),
  };

  if (trueAttr(o, "folded")) node.collapsed = true;

  const position = positionAttr(o);
  if (position) node.pos = position;

  const note = strAttr(o, "note");
  if (note) node.note = note;

  const link = strAttr(o, "link");
  if (link && !isDangerousUrl(link)) node.hyperlink = link;

  const attachmentId = strAttr(o, "att-id");
  const attachmentName = strAttr(o, "att-name");
  if (attachmentId && attachmentName) {
    const bytes = files[`assets/${attachmentId}/${attachmentName}`];
    if (bytes) {
      const mime = mimeForName(attachmentName);
      const dataUrl = `data:${mime ?? "application/octet-stream"};base64,${bytesToBase64(bytes)}`;
      if (mime?.startsWith("image/")) {
        const width = Number(strAttr(o, "image-width"));
        node.image = {
          url: dataUrl,
          ...(Number.isFinite(width) && width > 0 ? { width } : {}),
        };
      } else node.attachments = [{ name: attachmentName, dataUrl, size: bytes.length }];
    }
  }

  const background = strAttr(o, "color");
  const color = strAttr(o, "text-color");
  const fontSize = Number(strAttr(o, "text-size"));
  const maxWidth = Number(strAttr(o, "text-width"));
  const fontFamily = strAttr(o, "text-font");
  if (background || color || Number.isFinite(fontSize) || Number.isFinite(maxWidth) || fontFamily) {
    node.style = {
      ...(background
        ? { background: background.startsWith("#") ? background : `#${background}` }
        : {}),
      ...(color ? { color: color.startsWith("#") ? color : `#${color}` } : {}),
      ...(Number.isFinite(fontSize) && fontSize > 0 ? { fontSize: `${fontSize}px` } : {}),
      ...(Number.isFinite(maxWidth) && maxWidth > 0 ? { maxWidth: `${maxWidth}px` } : {}),
      ...(fontFamily ? { fontFamily } : {}),
    };
  }

  const priority = Number(strAttr(o, "task-priority"));
  const progress = Number(strAttr(o, "task-progress"));
  if (Number.isFinite(priority) || Number.isFinite(progress)) {
    node.task = {
      ...(Number.isFinite(priority) && priority > 0
        ? { priority: Math.max(1, Math.min(9, Math.round(priority))) }
        : {}),
      ...(Number.isFinite(progress)
        ? { progress: Math.max(0, Math.min(100, progress)) / 100 }
        : {}),
    };
  }

  return node;
}

export function fromIthoughts(bytes: Uint8Array): MindMapDoc {
  itN = 0;

  const files = unzipOrThrow(bytes, ".itmz");

  const xmlBytes = files[MAPDATA_PATH];
  if (!xmlBytes) throw new Error(t("io.err.itmzNoMapdata"));

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Large real-world iThoughts maps legitimately contain thousands of escaped
    // XML characters in topic text. Keep entity processing bounded, but raise the
    // aggregate limit above fast-xml-parser's small default of 1,000.
    processEntities: { maxTotalExpansions: 100_000 },
  });
  const tree = parser.parse(strFromU8(xmlBytes));

  // The root XML element may be <iThoughts> (containing <topics>) or bare <topics>.
  const root = tree?.iThoughts ?? tree;
  const topicsEl = root?.topics;
  if (!topicsEl) throw new Error(t("io.err.itmzNoTopicsElement"));

  // Collect all <topic> children of <topics>. The first is the map centre (main root);
  // additional peers are floating topics.
  const topicEls: Xml[] = asList(topicsEl?.topic);

  // Collect <relationship> elements inside <topics> (cross-links).
  const relationEls: Xml[] = [
    ...asList(topicsEl?.relationship),
    ...asList(root?.relationships?.relationship),
  ];

  // Collect floating topics from an optional <floating-topics> wrapper (some iThoughts
  // versions write them there rather than as bare peers of the root).
  const floatingWrapperEls: Xml[] = asList(topicsEl?.["floating-topics"]?.topic);

  // A uuid -> canonical node id map, populated during tree-walk.
  const uuidMap = new Map<string, string>();

  if (topicEls.length === 0) {
    throw new Error(t("io.err.itmzNoTopics"));
  }

  // First <topic> = the central root; remaining peers = floating.
  // Real iThoughts 7.x files also store floating topics as children of the central topic with a
  // `floating="1"` flag. Pull those out before the structural walk; otherwise a free note becomes a
  // normal branch and, on large maps, needlessly participates in the hierarchy layout.
  const embeddedFloatingEls = asList(topicEls[0]?.topic).filter((t: Xml) =>
    trueAttr(t, "floating"),
  );
  const rootEl = {
    ...topicEls[0],
    topic: asList(topicEls[0]?.topic).filter((t: Xml) => !trueAttr(t, "floating")),
  };
  const rootNode = topicToNode(rootEl, uuidMap, files);
  const floatingFromPeers = topicEls.slice(1).map((t: Xml) => topicToNode(t, uuidMap, files));
  const floatingFromWrapper = floatingWrapperEls.map((t: Xml) => topicToNode(t, uuidMap, files));
  const floatingFromFlags = embeddedFloatingEls.map((t: Xml) => topicToNode(t, uuidMap, files));
  const floatingTopics = [...floatingFromPeers, ...floatingFromWrapper, ...floatingFromFlags];

  // Map <relationship> elements to CrossLinks.
  const links: CrossLink[] = [];
  relationEls.forEach((r: Xml, i: number) => {
    const from = uuidMap.get(strAttr(r, "end1-uuid"));
    const to = uuidMap.get(strAttr(r, "end2-uuid"));
    if (!from || !to) return; // skip if either endpoint wasn't parsed
    const label = strAttr(r, "label");
    const link: CrossLink = { id: `it-rel-${i}`, from, to };
    if (label) link.label = label;
    links.push(link);
  });

  const docId = nextId();
  const title = rootNode.topic || "Imported iThoughts map";

  return {
    schemaVersion: 1,
    id: docId,
    title,
    root: rootNode,
    ...(links.length > 0 ? { links } : {}),
    ...(floatingTopics.length > 0 ? { floatingTopics } : {}),
    meta: { source: "ithoughts" },
  };
}

// --- writer ---------------------------------------------------------------------------------------

function sanitizeText(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x0d) {
      out += "\\n";
      if (value.charCodeAt(i + 1) === 0x0a) i++;
    } else if (code === 0x0a) {
      out += "\\n";
    } else if (code === 0x09 || code >= 0x20) {
      out += value[i];
    }
  }
  return out;
}

const esc = (value: string): string => escapeXmlAttr(sanitizeText(value));

function hash32(value: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicUuid(value: string): string {
  const bytes = new Uint8Array(16);
  for (let part = 0; part < 4; part++) {
    const hash = hash32(value, Math.imul(part + 1, 0x9e3779b1));
    bytes[part * 4] = (hash >>> 24) & 0xff;
    bytes[part * 4 + 1] = (hash >>> 16) & 0xff;
    bytes[part * 4 + 2] = (hash >>> 8) & 0xff;
    bytes[part * 4 + 3] = hash & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sourceUuid(node: MapNode): string {
  if (node.sourceId && UUID_RE.test(node.sourceId)) return node.sourceId;
  if (UUID_RE.test(node.id)) return node.id;
  return deterministicUuid(`iThread:topic:${node.id}`);
}

function cssNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hexColour(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  return match ? match[1].toUpperCase() : null;
}

function safeAssetName(name: string, mime: string): string {
  let cleaned = "";
  for (const char of name) {
    const code = char.charCodeAt(0);
    cleaned += code < 0x20 || '\\/:*?"<>|'.includes(char) ? "_" : char;
  }
  cleaned = cleaned
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  const fallback = `attachment${extForMime(mime)}`;
  return cleaned || fallback;
}

interface ItAsset {
  id: string;
  name: string;
  bytes: Uint8Array;
  image: boolean;
}

function assetForNode(node: MapNode): ItAsset | null {
  const image = node.image?.url ? parseDataUrl(node.image.url) : null;
  if (image) {
    const id = deterministicUuid(`iThread:asset:${node.id}:image`);
    return {
      id,
      name: `image${extForMime(image.mime)}`,
      bytes: image.bytes,
      image: image.mime.startsWith("image/"),
    };
  }
  const attachment = node.attachments?.find((item) => parseDataUrl(item.dataUrl) !== null);
  if (!attachment) return null;
  const parsed = parseDataUrl(attachment.dataUrl);
  if (!parsed) return null;
  return {
    id: deterministicUuid(`iThread:asset:${node.id}:${attachment.name}`),
    name: safeAssetName(attachment.name, parsed.mime),
    bytes: parsed.bytes,
    image: parsed.mime.startsWith("image/"),
  };
}

function topicXml(
  node: MapNode,
  uuidById: Map<string, string>,
  assets: Map<string, ItAsset>,
  floating = false,
  fallbackPosition?: { x: number; y: number },
  extraChildren = "",
): string {
  const topic = node.topicRich ? richToInlineMarkdown(node.topicRich) : node.topic;
  const attrs = [`uuid="${uuidById.get(node.id)}"`, `text="${esc(topic ?? "")}"`];
  const created = node.createdAt ? new Date(node.createdAt).toISOString().slice(0, 19) : undefined;
  const modified = node.modifiedAt ? new Date(node.modifiedAt).toISOString().slice(0, 19) : created;
  if (created) attrs.push(`created="${created}"`);
  if (modified) attrs.push(`modified="${modified}"`);
  if (node.collapsed) attrs.push('folded="1"');
  if (floating) {
    attrs.push('floating="1"');
    const pos = node.pos ?? fallbackPosition ?? { x: 400, y: 200 };
    attrs.push(`position="{${Math.round(pos.x)},${Math.round(pos.y)}}"`);
  }
  if (node.note) attrs.push(`note="${esc(node.note)}"`);
  if (node.hyperlink && !isDangerousUrl(node.hyperlink))
    attrs.push(`link="${esc(node.hyperlink)}"`);

  const background = hexColour(node.style?.background ?? node.branchColor);
  const color = hexColour(node.style?.color);
  const fontSize = cssNumber(node.style?.fontSize);
  const maxWidth = cssNumber(node.style?.maxWidth);
  if (background) attrs.push(`color="${background}"`);
  if (color) attrs.push(`text-color="${color}"`);
  if (fontSize) attrs.push(`text-size="${fontSize}"`);
  if (maxWidth) attrs.push(`text-width="${maxWidth}"`);
  if (node.style?.fontFamily) attrs.push(`text-font="${esc(node.style.fontFamily)}"`);
  if (node.task?.priority !== undefined) {
    attrs.push(`task-priority="${Math.max(1, Math.min(9, Math.round(node.task.priority)))}"`);
  }
  if (node.task?.progress !== undefined) {
    attrs.push(`task-progress="${Math.round(Math.max(0, Math.min(1, node.task.progress)) * 100)}"`);
  }

  const asset = assets.get(node.id);
  if (asset) {
    attrs.push(`att-id="${asset.id}"`, `att-name="${esc(asset.name)}"`);
    if (asset.image && node.image?.width)
      attrs.push(`image-width="${Math.round(node.image.width)}"`);
  }

  const children = `${node.children
    .map((child) => topicXml(child, uuidById, assets))
    .join("")}${extraChildren}`;
  return children ? `<topic ${attrs.join(" ")}>${children}</topic>` : `<topic ${attrs.join(" ")}/>`;
}

function relationshipXml(link: CrossLink, uuidById: Map<string, string>): string {
  const from = uuidById.get(link.from);
  const to = uuidById.get(link.to);
  if (!from || !to) return "";
  const attrs = [
    'type="0"',
    `uuid="${deterministicUuid(`iThread:relationship:${link.id}`)}"`,
    `end1-uuid="${from}"`,
    'end1-style="2"',
    `end2-uuid="${to}"`,
    'end2-style="1"',
  ];
  if (link.label) attrs.push(`label="${esc(link.label)}"`);
  if (link.dash !== "solid") attrs.push('dashed="1"');
  return `<relationship ${attrs.join(" ")}/>`;
}

function plist(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${entries}</dict></plist>`;
}

function plistEntry(
  key: string,
  tag: "string" | "date" | "integer" | "real",
  value: string | number,
): string {
  return `<key>${key}</key><${tag}>${esc(String(value))}</${tag}>`;
}

function plistFlag(key: string, value: boolean): string {
  return `<key>${key}</key><${value ? "true" : "false"}/>`;
}

function countTopics(node: MapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTopics(child), 0);
}

function countNotes(node: MapNode): { count: number; words: number } {
  const own = node.note?.trim() ?? "";
  const result = { count: own ? 1 : 0, words: own ? own.split(/\s+/u).length : 0 };
  for (const child of node.children) {
    const nested = countNotes(child);
    result.count += nested.count;
    result.words += nested.words;
  }
  return result;
}

const PREVIEW_PNG = base64Decode(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
);

/** Canonical model -> an iThoughts `.itmz` ZIP. Pure and byte-deterministic for the same document. */
export function toIthoughts(doc: MindMapDoc): Uint8Array {
  const uuidById = new Map<string, string>();
  const assets = new Map<string, ItAsset>();
  const visit = (node: MapNode) => {
    uuidById.set(node.id, sourceUuid(node));
    const asset = assetForNode(node);
    if (asset) assets.set(node.id, asset);
    for (const child of node.children) visit(child);
  };
  visit(doc.root);
  for (const floating of doc.floatingTopics ?? []) visit(floating);

  const updated = new Date(
    doc.meta?.updatedAt ?? Date.parse(doc.meta?.createdAt ?? "2001-01-01T00:00:00Z"),
  );
  const stamp = Number.isNaN(updated.getTime())
    ? "2001-01-01T00:00:00"
    : updated.toISOString().slice(0, 19);
  const floating = (doc.floatingTopics ?? [])
    .map((node, index) => topicXml(node, uuidById, assets, true, { x: 400, y: 120 + index * 100 }))
    .join("");
  const rootTopic = topicXml(doc.root, uuidById, assets, false, undefined, floating);
  const relationships = (doc.links ?? []).map((link) => relationshipXml(link, uuidById)).join("");
  const mapdata = `<?xml version="1.0" encoding="UTF-8"?><iThoughts version="4.0" app="com.toketaware.ios.ithoughts" app-version="7.25" modified="${stamp}" author="iThread" system-version="${WINDOWS_VERSION}"><topics>${rootTopic}${relationships}</topics></iThoughts>`;

  const roots = [doc.root, ...(doc.floatingTopics ?? [])];
  const topicCount = roots.reduce((sum, root) => sum + countTopics(root), 0);
  const notes = roots.reduce(
    (sum, root) => {
      const next = countNotes(root);
      return { count: sum.count + next.count, words: sum.words + next.words };
    },
    { count: 0, words: 0 },
  );
  const manifest = plist(
    [
      plistEntry("AppID", "string", "com.ithread.windows"),
      plistEntry("AppVersion", "string", "0.2.0"),
      plistEntry("Generated", "date", `${stamp}Z`),
      plistEntry("Hostname", "string", "Windows"),
      plistEntry("MapRevision", "integer", 1),
      plistEntry("NoteCount", "integer", notes.count),
      plistEntry("NoteWordCount", "integer", notes.words),
      plistEntry("SystemOS", "string", WINDOWS_VERSION),
      plistEntry("TopicCount", "integer", topicCount),
      plistEntry("TopicWordCount", "integer", 0),
    ].join(""),
  );
  const preferences = plist(
    [
      plistFlag("HideCallouts", false),
      plistFlag("HideCompletedTasks", false),
      plistFlag("SnapToTopic", true),
    ].join(""),
  );
  const displayState = plist(
    [
      plistEntry("selected", "string", uuidById.get(doc.root.id) ?? ""),
      plistEntry("visibleRect", "string", "{{0,0},{1024,768}}"),
      plistEntry("zoom", "real", 1),
    ].join(""),
  );
  const style =
    '<?xml version="1.0" encoding="UTF-8"?><style version="2" name="iThread" mapLayout="1"/>';

  const files: Record<string, [Uint8Array, { mtime: number }]> = {
    "mapdata.xml": [strToU8(mapdata), { mtime: FIXED_MTIME }],
    "style.xml": [strToU8(style), { mtime: FIXED_MTIME }],
    "manifest.plist": [strToU8(manifest), { mtime: FIXED_MTIME }],
    "preferences.plist": [strToU8(preferences), { mtime: FIXED_MTIME }],
    "display_state.plist": [strToU8(displayState), { mtime: FIXED_MTIME }],
    "preview.png": [PREVIEW_PNG, { mtime: FIXED_MTIME }],
  };
  for (const asset of assets.values()) {
    files[`assets/${asset.id}/${asset.name}`] = [asset.bytes, { mtime: FIXED_MTIME }];
  }
  return zipSync(files, { level: 6 });
}
