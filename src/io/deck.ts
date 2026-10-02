// Standalone HTML slide-deck export: the Walk-Through presentation as a single
// self-contained .html file you can open or share — no app, no network, offline.
// Reuses the same slide model the in-app Presentation renders (overview slide +
// one slide per top-level branch). Pure + deterministic so it's unit-testable;
// only escaped topic text is interpolated into the document (the nav script is
// static), so there is no scripting surface from map content.

import { getLocale, t } from "../i18n/registry";
import "./messages";
import type { MapNode, MindMapDoc } from "../model/types";
import { renderNote } from "../noteFormat";
import { resolveSlides, slideKey } from "../present/slides";
// Quote-safe (attr-level): deck text lands in element content here, but escaping quotes too keeps it
// safe if it is ever moved into an attribute, and costs nothing.
import { escapeHtmlAttr as escapeHtml } from "./htmlEscape";

function bulletsHtml(node: MapNode): string {
  if (node.children.length === 0) return "";
  const items = node.children
    .map((child) => `<li>${escapeHtml(child.topic)}${bulletsHtml(child)}</li>`)
    .join("");
  return `<ul>${items}</ul>`;
}

function slideHtml(heading: string, body: string, note: string): string {
  // Speaker notes: hidden by default, revealed with the N key / footer toggle (reveal.js convention).
  // `note` is already sanitised HTML from renderNote (escaped Markdown subset) — no scripting surface.
  const notes = note ? `<section class="speaker-notes">${note}</section>` : "";
  return `<section class="slide"><h1>${escapeHtml(heading)}</h1>${body}${notes}</section>`;
}

const DECK_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; background: #1f1b4d; color: #f5f4ff;
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .deck { display: flex; flex-direction: column; height: 100vh; }
  #stage { flex: 1; overflow: auto; cursor: pointer; }
  .slide { display: none; flex-direction: column; justify-content: center;
    min-height: 100%; max-width: 1000px; margin: 0 auto; width: 100%;
    padding: 48px clamp(24px, 8vw, 120px); }
  .slide h1 { font-size: clamp(28px, 5vw, 48px); margin: 0 0 0.4em; color: #fff; }
  /* Live-map slide (item 1): the branch rendered as its own SVG fills the slide body, framed to its
     bounds. Falls back to the bullet outline when no canvas image was captured at export time. */
  .slide figure.map { margin: 0; display: flex; align-items: center; justify-content: center; }
  .slide figure.map svg { max-width: 100%; max-height: 66vh; width: auto; height: auto; }
  .slide ul { line-height: 1.7; color: #e8e6f7; }
  .slide ul.overview { font-size: clamp(16px, 2.4vw, 24px); color: #cecbf6; line-height: 1.9; }
  .slide ul ul { font-size: 0.92em; color: #cecbf6; }
  footer { display: flex; align-items: center; gap: 12px; padding: 12px 20px;
    border-top: 1px solid #4a4490; }
  button { font: 600 13px/1 inherit; color: #f5f4ff; border: 1px solid #4a4490;
    background: #2a2560; border-radius: 8px; padding: 8px 14px; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  #counter { font-size: 13px; color: #cecbf6; }
  .hint { flex: 1; text-align: right; font-size: 12px; color: #8a86c4; }
  button[aria-pressed="true"] { background: #4a4490; }
  /* Speaker notes: hidden until toggled; only the active slide's notes show (others are display:none). */
  .speaker-notes { display: none; margin: 24px auto 0; max-width: 900px; width: 100%;
    padding: 12px 16px; border-top: 1px solid #4a4490; font-size: clamp(13px, 1.8vw, 17px);
    line-height: 1.6; color: #cecbf6; }
  .deck.notes-on .slide .speaker-notes { display: block; }
  .speaker-notes p { margin: 0 0 0.5em; } .speaker-notes p:last-child { margin: 0; }
  .speaker-notes ul, .speaker-notes ol { margin: 0 0 0 18px; padding: 0; }
  .speaker-notes ul { list-style: disc; } .speaker-notes ol { list-style: decimal; }
  .speaker-notes h1, .speaker-notes h2, .speaker-notes h3 { font-size: 1em; margin: 0 0 0.3em; color: #fff; }
  .speaker-notes code { font-family: ui-monospace, monospace; }
`;

// Static — no map content is interpolated here, so there is no XSS surface.
const DECK_SCRIPT = `
  (function () {
    var slides = [].slice.call(document.querySelectorAll('.slide'));
    var prev = document.getElementById('prev');
    var next = document.getElementById('next');
    var counter = document.getElementById('counter');
    var deck = document.querySelector('.deck');
    var notesBtn = document.getElementById('notes-toggle');
    function toggleNotes() {
      var on = deck.classList.toggle('notes-on');
      if (notesBtn) notesBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (notesBtn) notesBtn.addEventListener('click', toggleNotes);
    var i = 0;
    function show(n) {
      i = Math.max(0, Math.min(n, slides.length - 1));
      for (var k = 0; k < slides.length; k++) slides[k].style.display = k === i ? 'flex' : 'none';
      counter.textContent = (i + 1) + ' / ' + slides.length;
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    }
    prev.addEventListener('click', function () { show(i - 1); });
    next.addEventListener('click', function () { show(i + 1); });
    document.getElementById('stage').addEventListener('click', function () { show(i + 1); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); show(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); toggleNotes(); }
    });
    show(0);
  })();
`;

/**
 * The standalone HTML slide deck. When `branchSvgs` is supplied (item 1) — a map from each slide's
 * `slideKey` to its already-sanitised, self-contained SVG rendered from the live canvas — each slide
 * shows that branch's map image instead of the bullet outline, so the deck reads as a walk over the
 * actual map (MindManager-style live-map slides). Absent (no live canvas at export time) ⇒ the classic
 * bullet deck, unchanged and fully deterministic. A slide with no entry in the map also falls back to
 * bullets, so a partial capture degrades gracefully per slide.
 */
export function buildDeckHtml(doc: MindMapDoc, branchSvgs?: Map<string, string>): string {
  const slides = resolveSlides(doc);
  const sections = slides
    .map((slide) => {
      const svg = branchSvgs?.get(slideKey(slide));
      // SVG is already sanitised (sanitizeSvg strips scripts/handlers) upstream — safe to inline.
      const body = svg
        ? `<figure class="map">${svg}</figure>`
        : slide.isOverview
          ? `<ul class="overview">${doc.root.children
              .map((child) => `<li>${escapeHtml(child.topic)}</li>`)
              .join("")}</ul>`
          : bulletsHtml(slide.node);
      // A per-slide SlideRef note (custom deck) overrides the topic's own note — same resolution as the
      // presenter view. Markdown → sanitised HTML via renderNote.
      const noteMd = (slide.note ?? slide.node.note ?? "").trim();
      return slideHtml(slide.heading, body, noteMd ? renderNote(noteMd) : "");
    })
    .join("\n");

  const title = doc.title || doc.root.topic || "Mind map";

  return `<!doctype html>
<html lang="${getLocale()}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${DECK_CSS}</style>
</head>
<body>
<div class="deck">
<main id="stage" aria-label="${escapeHtml(t("io.deck.slides"))}">
${sections}
</main>
<footer>
<button type="button" id="prev">${escapeHtml(t("common.prev"))}</button>
<span id="counter"></span>
<button type="button" id="next">${escapeHtml(t("common.next"))}</button>
<button type="button" id="notes-toggle" aria-pressed="false" title="${escapeHtml(t("io.deck.toggleNotes"))}">${escapeHtml(t("panel.tab.notes"))}</button>
<span class="hint">${escapeHtml(t("io.deck.navigationHint"))}</span>
</footer>
</div>
<script>${DECK_SCRIPT}</script>
</body>
</html>
`;
}
