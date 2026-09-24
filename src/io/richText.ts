// Sanitiser for inline rich-text topics (the React Flow canvas lets you bold/italic/underline
// part of a topic via Ctrl+B/I/U). We keep a tiny allowlist of inline formatting elements +
// safe style props and drop everything else — no library (TipTap/DOMPurify would threaten the
// bundle budget). Mirrors the hand-rolled, DOM-walk approach of io/svgSanitize.ts. Browser/
// jsdom only (DOMParser); unit-tested under jsdom.
//
// `MapNode.topic` always holds the plain-text fallback (search / outline / every io/* exporter
// read it), so rich text is a canvas-only enhancement that never affects the flat formats.

// Inline formatting elements kept verbatim; everything else is unwrapped (its text survives).
const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "MARK",
  "CODE",
  "SPAN",
  "BR",
]);

// Elements dropped WITH their content (so script/style source never surfaces as visible text).
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED"]);

// Style declarations kept on a surviving element (e.g. execCommand emits styled spans).
const ALLOWED_STYLE = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "color",
  "background-color",
]);

const NBSP = String.fromCharCode(160);

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** A CSS colour value safe to inline: hex, rgb()/rgba(), or a bare keyword. No url()/expression. */
function safeColor(v: string): boolean {
  if (/url\(|expression|javascript:|[<>]/i.test(v)) return false;
  return (
    /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d.,\s%]+\)$/i.test(v) || /^[a-z][a-z-]*$/i.test(v)
  );
}

/** Keep only allowlisted, value-safe style declarations from a `style` attribute. */
function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!val || !ALLOWED_STYLE.has(prop)) continue;
    if (/url\(|expression|javascript:|[<>]/i.test(val)) continue;
    if ((prop === "color" || prop === "background-color") && !safeColor(val)) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join("; ");
}

function cleanNode(node: Node): string {
  if (node.nodeType === 3) return escapeText(node.textContent ?? ""); // text
  if (node.nodeType !== 1) return ""; // drop comments / others
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP_TAGS.has(tag)) return ""; // drop script/style/etc. with their content
  const inner = Array.from(el.childNodes).map(cleanNode).join("");
  if (tag === "BR") return "<br>";
  if (!ALLOWED_TAGS.has(tag)) return inner; // unwrap a disallowed element, keep its text
  const styleAttr = el.getAttribute("style");
  const style = styleAttr ? cleanStyle(styleAttr) : "";
  const lower = tag.toLowerCase();
  return style
    ? `<${lower} style="${escapeAttr(style)}">${inner}</${lower}>`
    : `<${lower}>${inner}</${lower}>`;
}

/** Return a safe inline-HTML subset of `html` (allowlisted tags + style; scripts/handlers gone). */
export function sanitizeRich(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).map(cleanNode).join("");
}

/** The plain-text equivalent of a rich-text fragment (for the `topic` fallback). */
export function richToPlain(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Contenteditable inserts non-breaking spaces; normalise them to plain spaces.
  return (doc.body.textContent ?? "").split(NBSP).join(" ");
}

/** True if sanitised HTML carries any real inline formatting (else the plain topic suffices). */
export function hasFormatting(cleanHtml: string): boolean {
  return /<(?:b|strong|i|em|u|s|strike|mark|code|span|br)\b/i.test(cleanHtml);
}

const INLINE_MARKERS = [
  { marker: "**", tag: "strong" },
  { marker: "==", tag: "mark" },
  { marker: "__", tag: "u" },
  { marker: "~~", tag: "s" },
  { marker: "`", tag: "code" },
  { marker: "*", tag: "em" },
  { marker: "_", tag: "em" },
] as const;

// Markdown permits inline HTML. A few real iThoughts libraries contain literal `<mark>` / `<u>`
// topic fragments, so recognise only exact, attribute-free formatting tags and escape everything
// else. Normalising aliases here keeps the stored rich subset small and predictable.
const INLINE_HTML_TAGS = [
  { source: "strong", tag: "strong" },
  { source: "b", tag: "strong" },
  { source: "mark", tag: "mark" },
  { source: "u", tag: "u" },
  { source: "em", tag: "em" },
  { source: "i", tag: "em" },
  { source: "del", tag: "s" },
  { source: "strike", tag: "s" },
  { source: "s", tag: "s" },
  { source: "code", tag: "code" },
] as const;

/** Parse the small inline-Markdown subset supported inside a topic. `__text__` intentionally means
 * underline here (rather than Markdown's second spelling for bold), matching iThoughts-style topic
 * formatting and the editor's B/I/U controls. Raw HTML is escaped before any generated tags exist. */
export function parseInlineMarkdown(text: string): { plain: string; rich?: string } {
  let formatted = false;
  const render = (source: string): { html: string; plain: string } => {
    let html = "";
    let plain = "";
    const lower = source.toLowerCase();
    for (let i = 0; i < source.length; ) {
      if (source[i] === "\\" && i + 1 < source.length) {
        html += escapeText(source[i + 1]);
        plain += source[i + 1];
        i += 2;
        continue;
      }
      const htmlSpec = INLINE_HTML_TAGS.find(({ source: tag }) => lower.startsWith(`<${tag}>`, i));
      if (htmlSpec) {
        const start = i + htmlSpec.source.length + 2;
        const close = `</${htmlSpec.source}>`;
        const end = lower.indexOf(close, start);
        if (end > start) {
          const inner = source.slice(start, end);
          const content =
            htmlSpec.tag === "code" ? { html: escapeText(inner), plain: inner } : render(inner);
          html += `<${htmlSpec.tag}>${content.html}</${htmlSpec.tag}>`;
          plain += content.plain;
          formatted = true;
          i = end + close.length;
          continue;
        }
      }
      const spec = INLINE_MARKERS.find(({ marker }) => source.startsWith(marker, i));
      if (spec) {
        const start = i + spec.marker.length;
        const end = source.indexOf(spec.marker, start);
        if (end > start && source.slice(start, end).trim()) {
          const inner = source.slice(start, end);
          const content =
            spec.tag === "code" ? { html: escapeText(inner), plain: inner } : render(inner);
          html += `<${spec.tag}>${content.html}</${spec.tag}>`;
          plain += content.plain;
          formatted = true;
          i = end + spec.marker.length;
          continue;
        }
      }
      html += escapeText(source[i]);
      plain += source[i];
      i += 1;
    }
    return { html, plain };
  };

  const rendered = render(text);
  return formatted ? { plain: rendered.plain, rich: rendered.html } : { plain: rendered.plain };
}

/** Serialise topic rich text back to the same inline-Markdown subset for a lossless `.md` export. */
export function richToInlineMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeRich(html), "text/html");
  const children = (node: Node): string => Array.from(node.childNodes).map(visit).join("");
  const visit = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";
    const el = node as HTMLElement;
    let inner = children(el);
    switch (el.tagName.toLowerCase()) {
      case "b":
      case "strong":
        return `**${inner}**`;
      case "i":
      case "em":
        return `*${inner}*`;
      case "u":
        return `__${inner}__`;
      case "s":
      case "strike":
        return `~~${inner}~~`;
      case "mark":
        return `==${inner}==`;
      case "code":
        return `\`${inner}\``;
      case "br":
        return " ";
      case "span": {
        const style = el.style;
        if (style.textDecorationLine.includes("underline")) inner = `__${inner}__`;
        if (style.textDecorationLine.includes("line-through")) inner = `~~${inner}~~`;
        if (style.fontStyle === "italic") inner = `*${inner}*`;
        if (style.fontWeight === "bold" || Number(style.fontWeight) >= 600) inner = `**${inner}**`;
        if (style.backgroundColor) inner = `==${inner}==`;
        return inner;
      }
      default:
        return inner;
    }
  };
  return children(doc.body);
}
