import { t } from "../i18n/registry";
import type { MindMapDoc } from "../model/types";
import { parseDoc } from "./json";

// Route an imported file to the right parser by extension, returning the parsed doc plus any lossy-
// import warnings. Every non-native format is code-split (dynamic import) so a parser's deps only load
// when that format is actually opened. `.mmap` is injected (the heaviest importer — fast-xml-parser +
// fflate) so the caller controls when that chunk loads. Pure: file in, { doc, warnings } out — no app
// state — so the whole extension matrix is unit-testable.

// Per-format "what didn't come across" notes. Every non-native importer converts a foreign model into
// our schema and necessarily drops something (styling, relationships, images, layout); surfacing a
// single honest line per format sets correct expectations so a user doesn't trust a faithful round-trip
// and delete their source. `.json`/`.mmst` are our own lossless schema (no note); `.mmap` returns its
// own richer, content-specific warnings (so it's not in this table).
// A FUNCTION, not a const: a module-scope t() freezes at import, and these are the one line a user
// reads about what their import lost.
type LossyKind =
  | "markmap"
  | "mermaid"
  | "opml"
  | "freemind"
  | "xmind"
  | "smmx"
  | "docx"
  | "xlsx"
  | "ithoughts"
  | "mindmeister"
  | "mindmup"
  | "textbundle";

// ASYNC, and it loads the io catalogue itself.
//
// This module is reached from the EAGER graph (App.tsx imports parseImport), so a static
// `import "./messages"` here would pull the whole io catalogue into the entry chunk — which is
// exactly how this batch first broke the size gate, +1.3 kB. These twelve notes are the longest
// strings in it and nothing needs them until a user actually opens a foreign file. `parseImport` is
// already async, so awaiting the catalogue costs a caller nothing.
async function lossyNote(kind: LossyKind): Promise<string> {
  await import("./messages");
  const notes: Record<LossyKind, string> = {
    markmap: t("io.warn.fromMarkdown"),
    mermaid: t("io.warn.fromMermaid"),
    opml: t("io.warn.fromOpml"),
    freemind: t("io.warn.fromFreemind"),
    xmind: t("io.warn.fromXmind"),
    smmx: t("io.warn.fromSimpleMind"),
    docx: t("io.warn.fromWord"),
    xlsx: t("io.warn.fromExcel"),
    ithoughts: t("io.warn.fromIthoughts"),
    mindmeister: t("io.warn.fromMindmeister"),
    mindmup: t("io.warn.fromMindmup"),
    textbundle: t("io.warn.fromTextBundle"),
  };
  return notes[kind];
}

export async function parseImport(
  file: File,
  importMmap: () => Promise<typeof import("../import/mmap")>,
): Promise<{ doc: MindMapDoc; warnings: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    // Markmap files are Markdown (optionally with a `---` frontmatter block); fromMarkmap strips
    // any frontmatter then delegates to the Markdown parser, so plain .md still imports fine.
    const { fromMarkmap } = await import("./markmap");
    return { doc: fromMarkmap(await file.text()), warnings: [await lossyNote("markmap")] };
  }
  if (name.endsWith(".mmd") || name.endsWith(".mermaid")) {
    const { fromMermaid } = await import("./mermaid");
    return { doc: fromMermaid(await file.text()), warnings: [await lossyNote("mermaid")] };
  }
  if (name.endsWith(".json") || name.endsWith(".mmst")) {
    // `.mmst` is iThread's native file — the same lossless schema-v1 JSON (no lossy note).
    return { doc: parseDoc(await file.text()), warnings: [] };
  }
  if (name.endsWith(".opml")) {
    const { fromOpml } = await import("./opml");
    return { doc: fromOpml(await file.text()), warnings: [await lossyNote("opml")] };
  }
  if (name.endsWith(".mm")) {
    const { fromFreemind } = await import("./freemind");
    return { doc: fromFreemind(await file.text()), warnings: [await lossyNote("freemind")] };
  }
  if (name.endsWith(".xmind")) {
    const { fromXmind } = await import("./xmind");
    return {
      doc: fromXmind(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("xmind")],
    };
  }
  if (name.endsWith(".smmx")) {
    const { fromSmmx } = await import("./smmx");
    return {
      doc: fromSmmx(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("smmx")],
    };
  }
  if (name.endsWith(".docx")) {
    const { fromDocx } = await import("./docx");
    return {
      doc: fromDocx(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("docx")],
    };
  }
  if (name.endsWith(".xlsx")) {
    const { fromXlsx } = await import("./xlsx");
    return {
      doc: fromXlsx(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("xlsx")],
    };
  }
  if (name.endsWith(".itmz")) {
    const { fromIthoughts } = await import("./ithoughts");
    return {
      doc: fromIthoughts(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("ithoughts")],
    };
  }
  if (name.endsWith(".mind")) {
    const { fromMind } = await import("./mindmeister");
    return {
      doc: fromMind(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("mindmeister")],
    };
  }
  if (name.endsWith(".mup")) {
    const { fromMindMup } = await import("./mindmup");
    return { doc: fromMindMup(await file.text()), warnings: [await lossyNote("mindmup")] };
  }
  if (name.endsWith(".textpack") || name.endsWith(".textbundle")) {
    const { fromTextBundle } = await import("./textbundle");
    return {
      doc: fromTextBundle(new Uint8Array(await file.arrayBuffer())),
      warnings: [await lossyNote("textbundle")],
    };
  }
  const { parseMmap } = await importMmap();
  const result = parseMmap(new Uint8Array(await file.arrayBuffer()));
  return { doc: result.doc, warnings: result.warnings };
}
