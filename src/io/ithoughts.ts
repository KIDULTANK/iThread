import { t } from "../i18n/registry";
import "./messages";
import { XMLParser } from "fast-xml-parser";
import { strFromU8 } from "fflate";
import type { CrossLink, MapNode, MindMapDoc } from "../model/types";
import { isDangerousUrl } from "./urlSafety";
import { unzipOrThrow } from "./zip";

// iThoughts `.itmz` -> canonical model (import only).
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
// NOTE: not verified against a real .itmz file from the app — schema confirmed from
// open-source iThoughts converters and community documentation. Validate with a real
// .itmz export when one is available (same caveat as .smmx and .mmap importers).
//
// Sources:
//   • https://gist.github.com/ttscoff/bbf5a04b25c5dd04d9658e728da26cd7  (Cursor/iThoughts gist)
//   • https://gist.github.com/ttscoff/58a3f7d69fff63caa11766f23647f888  (iThoughts→Mermaid gist)

const MAPDATA_PATH = "mapdata.xml";

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
      if (mime?.startsWith("image/")) node.image = { url: dataUrl };
      else node.attachments = [{ name: attachmentName, dataUrl, size: bytes.length }];
    }
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
