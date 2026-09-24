import { t } from "../i18n/registry";
import "./messages";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, strToU8, zipSync } from "fflate";
import type { CrossLink, MapNode, MindMapDoc } from "../model/types";
import { isDangerousUrl } from "./urlSafety";
import { escapeXmlAttr as escapeXml } from "./xml";
import { unzipOrThrow } from "./zip";

// SimpleMind `.smmx` <-> canonical model.
//
// A `.smmx` is a ZIP holding `document/mindmap.xml`. SimpleMind stores topics as a FLAT list
// (`mindmap/topics/topic`) joined by `parent` id references (the central topic has parent="-1"),
// with `relations` (source/target) for cross-links. We map `text` <-> topic, the parent graph
// <-> the tree, `<note>` <-> note, `<link urllink>` <-> hyperlink, and relations <-> cross-links;
// the exporter also writes a simple tidy x/y layout so the map opens readably.
// **Validated against a real SimpleMind export (a 101-topic map, owner-confirmed 2026-06-19): the
// flat topics/parent-ref model, the `simplemind-mindmaps > mindmap` root, and `@_text`/`@_id`/
// `@_parent` attributes all match the real app's output, and every topic + the full hierarchy + the
// title import with zero content loss.** Out of scope (SimpleMind app-state / styling, dropped by
// design): per-topic palette/colorinfo/x-y, `<node-groups>` (visual groups), rich-note markup, and
// images. fflate does the zip/unzip.

const MINDMAP_PATH = "document/mindmap.xml";

// biome-ignore lint/suspicious/noExplicitAny: tolerant shape from the XML parser
type Xml = any;

function asList<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function guid(): string {
  const c = globalThis.crypto;
  return c?.randomUUID ? c.randomUUID() : `g-${Math.random().toString(36).slice(2)}`;
}

// --- import ----------------------------------------------------------------

function noteOf(t: Xml): string {
  const n = asList(t?.note)[0];
  if (typeof n === "string" || typeof n === "number") return String(n).trim();
  if (n && typeof n === "object") return String(n["#text"] ?? n["@_text"] ?? "").trim();
  return "";
}

function linkOf(t: Xml): string {
  for (const l of asList(t?.link)) {
    const url = l?.["@_urllink"];
    if (typeof url === "string" && url && !isDangerousUrl(url)) return url;
  }
  return "";
}

export function fromSmmx(bytes: Uint8Array): MindMapDoc {
  const files = unzipOrThrow(bytes, ".smmx");
  const xml = files[MINDMAP_PATH];
  if (!xml) throw new Error(`Unsupported .smmx: no ${MINDMAP_PATH}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const tree = parser.parse(strFromU8(xml));
  const mindmap = asList(tree?.["simplemind-mindmaps"]?.mindmap ?? tree?.mindmap)[0];
  const topics = asList(mindmap?.topics?.topic);
  if (topics.length === 0) throw new Error(t("io.err.smmxNoTopics"));

  // Pass 1: build a node per topic, keyed by its SimpleMind id, remembering its parent ref.
  const byId = new Map<string, { node: MapNode; parent: string }>();
  for (const t of topics) {
    const id = String(t["@_id"] ?? "");
    if (!id) continue;
    const node: MapNode = { id: `sm-${id}`, topic: String(t["@_text"] ?? "").trim(), children: [] };
    const note = noteOf(t);
    if (note) node.note = note;
    const url = linkOf(t);
    if (url) node.hyperlink = url;
    byId.set(id, { node, parent: String(t["@_parent"] ?? "-1") });
  }

  // Pass 2: attach children to parents; topics with no resolvable parent are roots.
  const roots: MapNode[] = [];
  for (const { node, parent } of byId.values()) {
    const at = byId.get(parent);
    if (at && at.node !== node) at.node.children.push(node);
    else roots.push(node);
  }
  const root = roots[0] ?? { id: "sm-root", topic: t("io.title.importedSimpleMind"), children: [] };
  const floatingTopics = roots.slice(1);

  // Relations -> cross-links (only those whose endpoints both exist).
  const links: CrossLink[] = [];
  asList(mindmap?.relations?.relation).forEach((r: Xml, i: number) => {
    const from = String(r?.["@_source"] ?? "");
    const to = String(r?.["@_target"] ?? "");
    if (!byId.has(from) || !byId.has(to)) return;
    const label = String(r?.["@_label"] ?? r?.label?.["#text"] ?? r?.label ?? "").trim();
    links.push({
      id: `sm-rel-${i}`,
      from: `sm-${from}`,
      to: `sm-${to}`,
      ...(label ? { label } : {}),
    });
  });

  const title = String(
    mindmap?.meta?.title?.["@_text"] ?? root.topic ?? t("io.title.importedSimpleMind"),
  );
  return {
    schemaVersion: 1,
    id: `sm-${guid()}`,
    title,
    root,
    ...(links.length > 0 ? { links } : {}),
    ...(floatingTopics.length > 0 ? { floatingTopics } : {}),
    meta: { source: "smmx" },
  };
}

// --- export ----------------------------------------------------------------

interface Row {
  id: number;
  parent: number;
  text: string;
  x: number;
  y: number;
  note?: string;
  href?: string;
}

/** Canonical model -> a `.smmx` ZIP (document/mindmap.xml), flat topics + a simple tidy layout. */
export function toSmmx(doc: MindMapDoc): Uint8Array {
  const rows: Row[] = [];
  const idMap = new Map<string, number>();
  let nextId = 0;
  let leaf = 0;

  // Place a subtree, returning its vertical centre; x by depth, y by leaf order (a tidy tree).
  const place = (node: MapNode, parent: number, depth: number): number => {
    const id = nextId++;
    idMap.set(node.id, id);
    const childYs = node.children.map((c) => place(c, id, depth + 1));
    const y = childYs.length > 0 ? (Math.min(...childYs) + Math.max(...childYs)) / 2 : leaf++ * 56;
    const row: Row = { id, parent, text: node.topic, x: depth * 240, y };
    if (node.note) row.note = node.note;
    if (node.hyperlink && !isDangerousUrl(node.hyperlink)) row.href = node.hyperlink;
    rows.push(row);
    return y;
  };
  place(doc.root, -1, 0);
  for (const f of doc.floatingTopics ?? []) place(f, -1, 0); // floating -> extra parent="-1" roots

  const relations = (doc.links ?? [])
    .filter((l) => idMap.has(l.from) && idMap.has(l.to))
    .map((l) => ({ source: idMap.get(l.from), target: idMap.get(l.to), label: l.label }));

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<simplemind-mindmaps doc-version="6" generator="iThread">');
  lines.push("<mindmap>");
  lines.push(`<meta><title text="${escapeXml(doc.title || "Mind map")}"/></meta>`);
  lines.push("<topics>");
  for (const r of rows.sort((a, b) => a.id - b.id)) {
    const attrs = `id="${r.id}" parent="${r.parent}" guid="${guid()}" x="${Math.round(r.x)}" y="${Math.round(r.y)}" text="${escapeXml(r.text)}"`;
    const inner: string[] = [];
    if (r.note) inner.push(`<note>${escapeXml(r.note)}</note>`);
    if (r.href) inner.push(`<link urllink="${escapeXml(r.href)}"/>`);
    lines.push(
      inner.length > 0 ? `<topic ${attrs}>${inner.join("")}</topic>` : `<topic ${attrs}/>`,
    );
  }
  lines.push("</topics>");
  if (relations.length > 0) {
    lines.push("<relations>");
    for (const rel of relations) {
      const label = rel.label ? ` label="${escapeXml(rel.label)}"` : "";
      lines.push(`<relation source="${rel.source}" target="${rel.target}"${label}/>`);
    }
    lines.push("</relations>");
  }
  lines.push("</mindmap>");
  lines.push("</simplemind-mindmaps>");

  return zipSync({ [MINDMAP_PATH]: strToU8(lines.join("\n")) });
}
