// Interactive, self-contained HTML export: the map as a single offline `.html`
// file you can email or open locally — no app, no network, no CDN. When exported
// with a live canvas it opens on the **visual map** (the faithful SVG render,
// pan/zoom) with a toggle to a **collapsible, searchable text outline** — the
// historical output, and the accessible / no-canvas fallback (C1). All driven by
// a small inlined vanilla-JS runtime, so the recipient needs no tooling.
//
// Pure + deterministic so it's unit-testable. Two safety rules govern what is
// interpolated into the document:
//   • Topic text lands in element content AND in the embedded JSON data; both go
//     through escapeHtml (which also escapes quotes and "/", so a "</script>"
//     in a topic can't break out of the data <script>). Notes render through the
//     repo's renderNote (HTML-escaped Markdown subset). No raw user data reaches
//     the document, so map content has no scripting surface.
//   • The runtime <script> and <style> are static string constants — no map
//     content is interpolated into them.

import { getLocale, t } from "../i18n/registry";
import "./messages";
import type { MapNode, MindMapDoc } from "../model/types";
import { renderNote } from "../noteFormat";
// Quote- and slash-safe: escaping `"`/`'` keeps text safe in attributes, and escaping `/` means a
// topic containing "</script>" survives as text rather than closing the embedded data block.
import { escapeHtmlScriptSafe as escapeHtml } from "./htmlEscape";

// One outline row: the topic plus (when present) a note and a hyperlink, then
// its children nested inside a <ul>. A node with children gets a toggle button;
// the runtime wires fold/unfold and search off the resulting DOM. `data-topic`
// carries the plain topic so search can match without re-reading rendered HTML.
function nodeHtml(node: MapNode): string {
  const hasKids = node.children.length > 0;
  const topic = escapeHtml(node.topic);
  const toggle = hasKids
    ? `<button type="button" class="toggle" aria-label="${escapeHtml(t("io.html.toggleChildren"))}">▾</button>`
    : `<span class="bullet" aria-hidden="true">•</span>`;
  // Only http(s)/mailto links are emitted; renderNote/escapeHtml neutralise the rest.
  const link =
    node.hyperlink && /^(?:https?:|mailto:)/i.test(node.hyperlink.trim())
      ? ` <a class="link" href="${escapeHtml(node.hyperlink.trim())}" target="_blank" rel="noopener noreferrer">↗</a>`
      : "";
  const note = node.note?.trim() ? `<div class="note">${renderNote(node.note)}</div>` : "";
  const children = hasKids
    ? `<ul class="children">${node.children.map(nodeHtml).join("")}</ul>`
    : "";
  return `<li class="node"${hasKids ? "" : ' data-leaf="1"'} data-topic="${topic}"><div class="row">${toggle}<span class="topic">${topic}</span>${link}</div>${note}${children}</li>`;
}

// The tree as plain JSON for any consumer that wants the data (and so the file is
// genuinely self-describing). `<` is escaped to < so the serialised string
// can never close the surrounding <script type="application/json"> early.
interface TreeNode {
  topic: string;
  note?: string;
  children: TreeNode[];
}
function toTree(node: MapNode): TreeNode {
  const t: TreeNode = { topic: node.topic, children: node.children.map(toTree) };
  if (node.note?.trim()) t.note = node.note;
  return t;
}
function embedJson(doc: MindMapDoc): string {
  return JSON.stringify({ title: doc.title || doc.root.topic, tree: toTree(doc.root) }).replace(
    /</g,
    "\\u003c",
  );
}

const CSS = `
  :root { color-scheme: light dark; --bg: #faf9f5; --fg: #2b2a26; --muted: #73726c;
    --accent: #4f46e5; --hit: #fde68a; --line: #e2e0d8; --card: #fff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1c1b22; --fg: #ece9f5; --muted: #9c99ad; --accent: #a5b4fc;
      --hit: #7c5e10; --line: #38363f; --card: #26242e; }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  header { position: sticky; top: 0; z-index: 2; display: flex; gap: 12px; align-items: center;
    flex-wrap: wrap; padding: 12px 18px; background: var(--bg); border-bottom: 1px solid var(--line); }
  header h1 { font-size: 17px; margin: 0; font-weight: 650; }
  .spacer { flex: 1; }
  #q { font: inherit; color: var(--fg); background: var(--card); border: 1px solid var(--line);
    border-radius: 8px; padding: 7px 10px; min-width: 180px; }
  #count { font-size: 12px; color: var(--muted); min-width: 70px; }
  button.ctl { font: 600 12px/1 inherit; color: var(--fg); background: var(--card);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 11px; cursor: pointer; }
  button.ctl:hover { border-color: var(--accent); }
  #scroll { height: calc(100vh - 56px); overflow: auto; }
  #pan { transform-origin: 0 0; padding: 20px 24px 80px; will-change: transform; }
  ul { list-style: none; margin: 0; padding: 0; }
  ul.children { margin-left: 18px; padding-left: 14px; border-left: 1px dashed var(--line); }
  li.node { margin: 2px 0; }
  li.collapsed > ul.children { display: none; }
  .row { display: flex; align-items: baseline; gap: 7px; padding: 2px 0; }
  .toggle { font: 11px/1 inherit; color: var(--muted); background: transparent; border: 0;
    cursor: pointer; width: 16px; padding: 0; flex: none; transition: transform .12s; }
  li.collapsed > .row .toggle { transform: rotate(-90deg); }
  .bullet { color: var(--muted); width: 16px; text-align: center; flex: none; }
  .topic { white-space: pre-wrap; }
  .link { text-decoration: none; color: var(--accent); font-size: 12px; }
  .note { margin: 1px 0 4px 23px; padding: 6px 10px; background: var(--card);
    border: 1px solid var(--line); border-radius: 8px; font-size: 13px; color: var(--muted); }
  .note p { margin: 0 0 .4em; } .note p:last-child { margin: 0; }
  .note ul, .note ol { margin: 0 0 0 18px; padding: 0; }
  .note ul { list-style: disc; } .note ol { list-style: decimal; }
  .note del { text-decoration: line-through; }
  .note h1, .note h2, .note h3 { font-size: 13px; margin: 0 0 .3em; color: var(--fg); }
  mark { background: var(--hit); color: inherit; border-radius: 3px; padding: 0 1px; }
  li.dim > .row .topic { opacity: .35; }
  li.hidden { display: none; }
  footer { padding: 8px 18px; font-size: 11px; color: var(--muted);
    border-top: 1px solid var(--line); }
  /* Visual map layer (C1): the faithful SVG render, shown/hidden by the body mode class. The outline
     (#tree) is the other mode; only one shows at a time inside the shared pan/zoom #pan. */
  #visual { display: none; }
  #visual svg { display: block; max-width: none; height: auto; }
  .mode-visual #visual { display: block; }
  .mode-visual #tree { display: none; }
  /* Expand/collapse only act on the outline — hide them in visual mode. Search stays (it switches
     to the outline so hits are visible). */
  .mode-visual #expand, .mode-visual #collapse { display: none; }
  button.ctl[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
`;

// Static runtime — no map content is interpolated here, so there is no XSS surface.
// Collapse: toggle a node's `collapsed` class (and a click on the row's topic).
// Search: walk every node; a node "matches" if its own topic contains the query;
//   matching nodes are highlighted and their ancestors revealed; non-matching
//   branches with no matching descendant are hidden, so the view narrows to hits.
// Pan/zoom: wheel-zoom (Ctrl/⌘+wheel) and drag-to-pan a transform on #pan, cheap.
const SCRIPT = `
(function () {
  var root = document.getElementById('tree');
  var q = document.getElementById('q');
  var count = document.getElementById('count');
  var nodes = [].slice.call(root.querySelectorAll('li.node'));

  // Visual/Outline toggle (C1): flip the body mode class + the button label. Only wired when the file
  // was exported with a visual map (the #mode button is otherwise absent).
  var body = document.body;
  var modeBtn = document.getElementById('mode');
  function setMode(visual) {
    body.classList.toggle('mode-visual', visual);
    body.classList.toggle('mode-outline', !visual);
    if (modeBtn) {
      modeBtn.textContent = visual ? body.dataset.outlineLabel : body.dataset.visualLabel;
      modeBtn.setAttribute('aria-pressed', visual ? 'false' : 'true');
    }
  }
  if (modeBtn) modeBtn.addEventListener('click', function () {
    setMode(body.classList.contains('mode-outline'));
  });

  function setCollapsed(li, on) { li.classList.toggle('collapsed', on); }

  root.addEventListener('click', function (e) {
    var t = e.target;
    var li = t.closest ? t.closest('li.node') : null;
    if (!li) return;
    if (t.classList.contains('toggle') || t.classList.contains('topic')) {
      if (li.querySelector(':scope > ul.children')) setCollapsed(li, !li.classList.contains('collapsed'));
    }
  });

  document.getElementById('expand').addEventListener('click', function () {
    nodes.forEach(function (li) { setCollapsed(li, false); });
  });
  document.getElementById('collapse').addEventListener('click', function () {
    nodes.forEach(function (li) {
      if (li.parentNode.closest('li.node') && li.querySelector(':scope > ul.children')) setCollapsed(li, true);
    });
  });

  function clearMarks(el) {
    var marks = el.querySelectorAll('mark');
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i]; m.replaceWith(document.createTextNode(m.textContent));
    }
    el.normalize();
  }
  function mark(el, needle) {
    var text = el.textContent, low = text.toLowerCase(), idx = low.indexOf(needle), last = 0, html = '';
    while (idx !== -1) {
      html += esc(text.slice(last, idx)) + '<mark>' + esc(text.slice(idx, idx + needle.length)) + '</mark>';
      last = idx + needle.length; idx = low.indexOf(needle, last);
    }
    html += esc(text.slice(last)); el.innerHTML = html;
  }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; }); }

  function runSearch() {
    var needle = q.value.trim().toLowerCase();
    // Search operates on the outline; if we're on the visual map, switch so the hits are visible (C1).
    if (needle && body.classList.contains('mode-visual')) setMode(false);
    nodes.forEach(function (li) {
      li.classList.remove('hidden', 'dim');
      clearMarks(li.querySelector(':scope > .row > .topic'));
    });
    if (!needle) { count.textContent = ''; return; }
    var hits = 0;
    nodes.forEach(function (li) {
      var topic = (li.getAttribute('data-topic') || '').toLowerCase();
      var self = topic.indexOf(needle) !== -1;
      if (self) { hits++; mark(li.querySelector(':scope > .row > .topic'), needle); }
      li._match = self;
    });
    // A node stays visible if it OR any descendant matched; reveal it; dim pure-context nodes.
    nodes.forEach(function (li) {
      var keep = li._match || li.querySelector('li.node') && [].some.call(li.querySelectorAll('li.node'), function (d) { return d._match; });
      if (keep) {
        li.classList.remove('hidden'); setCollapsed(li, false);
        if (!li._match) li.classList.add('dim');
        var p = li.parentNode.closest('li.node');
        while (p) { p.classList.remove('hidden'); setCollapsed(p, false); p = p.parentNode.closest('li.node'); }
      } else {
        li.classList.add('hidden');
      }
    });
    var pattern = hits === 1 ? body.dataset.matchOne : body.dataset.matchOther;
    count.textContent = (pattern || '{n}').replace('{n}', String(hits));
  }
  q.addEventListener('input', runSearch);
  q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; runSearch(); } });

  // Cheap pan/zoom on the #pan layer.
  var pan = document.getElementById('pan'), scroll = document.getElementById('scroll');
  var scale = 1, tx = 0, ty = 0, dragging = false, sx = 0, sy = 0;
  function apply() { pan.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
  scroll.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    var d = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    scale = Math.min(3, Math.max(0.3, scale * d)); apply();
  }, { passive: false });
  scroll.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button, .topic, #q')) return;
    dragging = true; sx = e.clientX - tx; sy = e.clientY - ty; scroll.setPointerCapture(e.pointerId);
  });
  scroll.addEventListener('pointermove', function (e) { if (dragging) { tx = e.clientX - sx; ty = e.clientY - sy; apply(); } });
  scroll.addEventListener('pointerup', function () { dragging = false; });
  document.getElementById('reset').addEventListener('click', function () { scale = 1; tx = 0; ty = 0; apply(); });
})();
`;

/**
 * The interactive, self-contained HTML export. When `svg` is supplied (the canvas's faithful SVG
 * render — the caller passes it already sanitised) the output opens on a **Visual map** view (the
 * actual coloured map, pan/zoom) with a toggle to the **Outline** (the collapsible, searchable text
 * tree — the historical output, and the accessible / no-canvas fallback). Without `svg` (no live
 * canvas) it's the outline only, exactly as before. C1.
 */
export function buildInteractiveHtml(doc: MindMapDoc, svg?: string): string {
  const title = doc.title || doc.root.topic || "Mind map";
  const tree = `<ul id="tree" class="root">${nodeHtml(doc.root)}</ul>`;
  const hasVisual = !!svg?.trim();
  // The SVG is embedded verbatim — the caller sanitises it (io/svgSanitize) and the exporter emits only
  // native <text> (no scripts / handlers / foreignObject), so it carries no scripting surface.
  const visual = hasVisual ? `<div id="visual">${svg}</div>` : "";
  const modeToggle = hasVisual
    ? `<button type="button" class="ctl" id="mode" aria-pressed="false" title="${escapeHtml(t("io.html.modeToggleTitle"))}">${escapeHtml(t("io.html.outlineView"))}</button>`
    : "";
  return `<!doctype html>
<html lang="${getLocale()}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body class="${hasVisual ? "mode-visual" : "mode-outline"}" data-outline-label="${escapeHtml(t("io.html.outlineView"))}" data-visual-label="${escapeHtml(t("io.html.visualMap"))}" data-match-one="${escapeHtml(t("io.html.matchCountOne"))}" data-match-other="${escapeHtml(t("io.html.matchCountOther"))}">
<header>
<h1>${escapeHtml(title)}</h1>
<span class="spacer"></span>
${modeToggle}
<input id="q" type="search" placeholder="${escapeHtml(t("io.html.filterTopicsPlaceholder"))}" aria-label="${escapeHtml(t("io.html.filterTopics"))}" autocomplete="off" />
<span id="count" aria-live="polite"></span>
<button type="button" class="ctl" id="expand">${escapeHtml(t("io.html.expandAll"))}</button>
<button type="button" class="ctl" id="collapse">${escapeHtml(t("io.html.collapseAll"))}</button>
<button type="button" class="ctl" id="reset" title="${escapeHtml(t("io.html.resetPanZoom"))}">${escapeHtml(t("io.html.resetView"))}</button>
</header>
<div id="scroll">
<div id="pan">
${visual}
${tree}
</div>
</div>
<footer>${escapeHtml(hasVisual ? t("io.html.footerWithVisual") : t("io.html.footerOutlineOnly"))}</footer>
<script type="application/json" id="map-data">${embedJson(doc)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
