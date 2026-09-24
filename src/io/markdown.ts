import type { MapNode, MindMapDoc } from "../model/types";
import { parseInlineMarkdown, richToInlineMarkdown } from "./richText";

// Markdown <-> canonical model.
//
// A map serialises to one H1 (the root topic) followed by a nested bullet list
// of its descendants, two spaces per level. This round-trips the topic tree;
// per-node extras (icons, notes) live on the model, not in the markdown.

// `numbers` (optional) prefixes each topic with its outline number ("1.2", "I.A", …) — used by the
// "bake outline numbers" option for copy/export. Omitted = the plain, round-trippable form.
export function toMarkdown(doc: MindMapDoc, numbers?: ReadonlyMap<string, string>): string {
  // A heading / bullet is a single physical line, so a topic carrying newlines (from a paste or a
  // note→topic conversion) would split the line — and re-import drops the orphaned continuation, since
  // it isn't a bullet. Collapse any whitespace run (incl. newlines) to one space so the tree round-trips.
  const inline = (node: MapNode) =>
    (node.topicRich ? richToInlineMarkdown(node.topicRich) : node.topic)
      .replace(/\s+/g, " ")
      .trim();
  const lines = [`# ${inline(doc.root)}`];
  const prefix = (id: string) => {
    const n = numbers?.get(id);
    return n ? `${n} ` : "";
  };
  const walk = (node: MapNode, depth: number) => {
    for (const child of node.children) {
      lines.push(`${"  ".repeat(depth)}- ${prefix(child.id)}${inline(child)}`);
      walk(child, depth + 1);
    }
  };
  walk(doc.root, 0);
  return `${lines.join("\n")}\n`;
}

let mdId = 0;
function nextId(): string {
  mdId += 1;
  return `md${mdId}`;
}

export function fromMarkdown(md: string): MindMapDoc {
  mdId = 0;
  const root: MapNode = { id: "root", topic: "Untitled map", children: [] };
  let h1Seen = false;
  // headings[level] = the node for that markdown heading level (1-based; headings[1] === root).
  // Used so deeper headings (##, ###) nest correctly — this is what Markmap + real outlines need.
  const headings: MapNode[] = [];
  headings[1] = root;
  // `section` is the node bullets currently hang under (the deepest heading, or the root).
  let section: MapNode = root;
  // bulletStack[d] = the node whose children receive a bullet at depth d+1, within the section.
  let bulletStack: MapNode[] = [root];
  const topicNode = (id: string, source: string): MapNode => {
    const parsed = parseInlineMarkdown(source);
    return {
      id,
      topic: parsed.plain,
      ...(parsed.rich ? { topicRich: parsed.rich } : {}),
      children: [],
    };
  };

  for (const raw of md.split(/\r?\n/)) {
    if (!raw.trim()) continue;

    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && !h1Seen) {
        // The first H1 names the root rather than creating a child.
        h1Seen = true;
        if (text) {
          const parsed = parseInlineMarkdown(text);
          root.topic = parsed.plain;
          if (parsed.rich) root.topicRich = parsed.rich;
        }
        headings.length = 2; // keep [_, root]
        section = root;
        bulletStack = [root];
        continue;
      }
      // Any other heading becomes a node under the nearest shallower heading.
      let parentLevel = level - 1;
      while (parentLevel >= 1 && !headings[parentLevel]) parentLevel -= 1;
      const node = topicNode(nextId(), text);
      (headings[parentLevel] ?? root).children.push(node);
      headings[level] = node;
      headings.length = level + 1; // forget any deeper headings
      section = node;
      bulletStack = [node];
      continue;
    }

    const bullet = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (!bullet) continue;

    const indent = bullet[1].replace(/\t/g, "  ").length;
    const depth = Math.floor(indent / 2) + 1; // top-level bullets sit under the current section
    const node = topicNode(nextId(), bullet[2].trim());
    const parent = bulletStack[depth - 1] ?? section;
    parent.children.push(node);
    bulletStack[depth] = node;
    bulletStack.length = depth + 1; // forget anything deeper than the current line
  }

  return {
    schemaVersion: 1,
    id: nextId(),
    title: root.topic,
    root,
    meta: { source: "markdown" },
  };
}
