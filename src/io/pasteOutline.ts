import type { MapNode } from "../model/types";
import { parseInlineMarkdown } from "./richText";

// Parse a pasted text block into a forest of topics — the "Paste text → map" capture path.
// Forgiving by design, because people paste all sorts of outlines:
//   - Markdown headings (#, ##, ###…) → depth from the heading level
//   - bullet lists (-, *, +, •, ‣, ◦) and numbered lists (1. / 1)) → depth from indentation
//   - plain indented lines (spaces or tabs) → depth from indentation
// A unified stack key (`#`-count for headings; 100 + indent-width for everything else) keeps list
// items nested under the nearest heading while ordering headings and list items each among
// themselves. Pure + deterministic (counter ids) so it's unit-testable; the graft op re-ids.

let pid = 0;
function nextId(): string {
  pid += 1;
  return `p${pid}`;
}

// Inline-markdown shorthand on a single outline line (after the heading/list marker is stripped):
//   - `[ ] task` / `[x] done`  → a task at 0% / 100% (the leading `- ` was already removed upstream)
//   - `[text](url)` spanning the whole line → topic text + a hyperlink (safe http(s)/mailto/tel only)
//   - `**bold**` / `==highlight==` / `__underline__` → restored as rich topic text
// Pure; keeps the paste path forgiving without a full markdown parser.
export function parseMdShorthand(body: string): {
  topic: string;
  topicRich?: string;
  hyperlink?: string;
  task?: { progress: number };
} {
  let topic = body;
  let task: { progress: number } | undefined;
  let hyperlink: string | undefined;
  const cb = topic.match(/^\[([ xX])\]\s+(.*)$/);
  if (cb) {
    task = { progress: cb[1].toLowerCase() === "x" ? 1 : 0 };
    topic = cb[2].trim();
  }
  const link = topic.match(/^\[([^\]]+)\]\((\S+)\)$/);
  if (link && /^(https?:\/\/|mailto:|tel:)/i.test(link[2])) {
    hyperlink = link[2];
    topic = link[1].trim();
  }
  const parsed = parseInlineMarkdown(topic);
  return {
    topic: parsed.plain,
    ...(parsed.rich ? { topicRich: parsed.rich } : {}),
    hyperlink,
    task,
  };
}

export function parseOutline(text: string): MapNode[] {
  pid = 0;
  const forest: MapNode[] = [];
  const stack: { node: MapNode; key: number }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)(.*)$/);
    const indentStr = m?.[1] ?? "";
    let body = (m?.[2] ?? "").trim();

    let key: number;
    const heading = body.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      key = heading[1].length; // # = 1, ## = 2, …
      body = heading[2].trim();
    } else {
      const indent = indentStr.replace(/\t/g, "  ").length;
      key = 100 + indent; // list/plain lines always sit below any heading
      body = body.replace(/^([-*+•‣◦]|\d+[.)])\s+/, "").trim();
    }
    if (!body) continue;

    const md = parseMdShorthand(body);
    if (!md.topic) continue; // e.g. a lone "[x]" with no text
    const node: MapNode = { id: nextId(), topic: md.topic, children: [] };
    if (md.topicRich) node.topicRich = md.topicRich;
    if (md.hyperlink) node.hyperlink = md.hyperlink;
    if (md.task) node.task = md.task;
    while (stack.length > 0 && stack[stack.length - 1].key >= key) stack.pop();
    const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
    if (parent) parent.children.push(node);
    else forest.push(node);
    stack.push({ node, key });
  }

  return forest;
}
