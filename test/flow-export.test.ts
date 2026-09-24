// @vitest-environment jsdom
//
// Phase F go/no-go: the React Flow SVG exporter. buildFlowSvg() authors a standalone,
// native-<text> SVG straight from the canonical model + the live node rects (no
// foreignObject), so it renders everywhere and flows cleanly through the same
// useMapExports.cleanSvg() pipeline (sanitizeSvg) that drives
// png/svg/html/pdf. This pins two things: (1) the SVG carries every visible element —
// topics (incl. multi-line), markers, images, branch + cross-link paths, boundary box —
// AND the labels a foreignObject-based export drops (cross-link + boundary); (2) all of
// that survives the export pipeline unchanged.
import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../src/io/svgSanitize";
import { arrowHeadPath } from "../src/mindmap/flow/arrowhead";
import { EXPORT_MARGIN, type NodeRect, buildFlowSvg } from "../src/mindmap/flow/exportSvg";
import { crosslinkBezier, floatingPoints } from "../src/mindmap/flow/floating";
import { shapePath } from "../src/mindmap/flow/shapes";
import {
  CROSSLINK_COLOR,
  resolveBoundaryStyle,
  resolveCalloutStyle,
  resolveLevelBox,
  resolveSummaryStyle,
} from "../src/mindmap/flow/style";
import { widthUnits } from "../src/mindmap/flow/text";
import type { CrossLink, MindMapDoc } from "../src/model/types";
import { STICKERS, stickerImage } from "../src/stickers";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      // Multi-line topic + a marker icon + a custom border colour.
      {
        id: "a",
        topic: "Multi\nLine",
        icons: ["⭐"],
        style: { border: "2px solid #e23" },
        callouts: [{ id: "co1", text: "Review me", dx: 48, dy: -20 }],
        children: [],
      },
      // An image node.
      { id: "b", topic: "Picture", image: { url: PNG, width: 64, height: 64 }, children: [] },
      { id: "c", topic: "Plain", side: "left", style: { fontFamily: "serif" }, children: [] },
    ],
  },
  links: [{ id: "l1", from: "a", to: "c", label: "depends on" }],
  boundaries: [{ id: "bd1", nodeIds: ["b", "c"], label: "Theme group" }],
};

const rects = new Map<string, NodeRect>([
  ["r", { x: 400, y: 300, w: 120, h: 50 }],
  ["a", { x: 620, y: 200, w: 140, h: 60 }],
  ["b", { x: 620, y: 380, w: 160, h: 150 }],
  ["c", { x: 180, y: 380, w: 110, h: 50 }],
]);

const palette = ["#E8593C", "#3B8BD4", "#27500A"];
const cssVar: Record<string, string> = {
  "--bgcolor": "#ffffff",
  "--color": "#2c2c2a",
  "--root-bgcolor": "#26215c",
  "--root-color": "#ffffff",
  "--main-bgcolor": "#faf9f5",
};

describe("map-wide accent recolours relationships + boundaries (#6)", () => {
  it("uses meta.accentColor for an unstyled cross-link + boundary, not the purple default", () => {
    const accented: MindMapDoc = { ...doc, meta: { accentColor: "#2e86ab" } };
    const out = buildFlowSvg(accented, rects, palette, cssVar);
    expect(out).toContain("#2e86ab"); // the accent reaches the SVG
    expect(out).not.toContain(CROSSLINK_COLOR); // the relationship no longer uses the purple default
  });

  it("leaves the historical default when no accent is set", () => {
    expect(buildFlowSvg(doc, rects, palette, cssVar)).toContain(CROSSLINK_COLOR);
  });
});

describe("raised topic drop shadow (#4)", () => {
  it("emits the shadow filter def + a filter ref only for a topic with style.shadow", () => {
    // Baseline map has no shadowed topic → no filter in the output.
    expect(buildFlowSvg(doc, rects, palette, cssVar)).not.toContain("mm-topic-shadow");
    const shadowed: MindMapDoc = {
      ...doc,
      root: {
        id: "r",
        topic: "Root",
        children: [{ id: "a", topic: "Raised", style: { shadow: true }, children: [] }],
      },
      links: [],
      boundaries: [],
    };
    const r = new Map<string, NodeRect>([
      ["r", { x: 400, y: 300, w: 120, h: 50 }],
      ["a", { x: 620, y: 200, w: 140, h: 60 }],
    ]);
    const out = buildFlowSvg(shadowed, r, palette, cssVar);
    expect(out).toContain('<filter id="mm-topic-shadow"');
    expect(out).toContain('filter="url(#mm-topic-shadow)"');
  });
});

describe("flow exportSvg (model + rects → native-text SVG)", () => {
  const svg = buildFlowSvg(doc, rects, palette, cssVar);

  it("emits a sized viewBox and a page background", () => {
    expect(svg).toMatch(/<svg[^>]*viewBox="[-\d. ]+"/);
    expect(svg).toContain("#faf9f5");
  });

  it("stays byte-stable + free of the redesign's canvas-only chrome (no export leakage)", () => {
    // Deterministic given a fixed `today` (the only time-dependent input), so the UX-pass additions
    // can't perturb the exported bytes. PNG/SVG/HTML/PDF all derive from this string via cleanSvg();
    // the model-backed Office exports keep their own byte-determinism tests (docx/pptx/xlsx/ooxml).
    const a = buildFlowSvg(doc, rects, palette, cssVar, false, "2026-01-01");
    const b = buildFlowSvg(doc, rects, palette, cssVar, false, "2026-01-01");
    expect(a).toBe(b);
    // Coachmarks, edit microcopy, drop indicators, the first-run card and selection chrome
    // are React/DOM-only — buildFlowSvg never walks them, so none can reach an export.
    for (const leak of [
      "Make child of", // #11 drop-target label
      "Start your map", // #1 empty-map coachmark
      "Double-click to edit", // #5 first-hover microcopy
      "3 things to try", // #13 first-run card
      "mm-node-bar", // #3 on-topic hover action bar
      "mm-coachmark", // #1
      "mm-firstrun", // #13
      "dropTarget", // #11 flag
    ]) {
      expect(a).not.toContain(leak);
    }
  });

  it("uses a per-map background colour over the theme default", () => {
    const withBg = buildFlowSvg(
      { ...doc, meta: { background: "#abcdef" } },
      rects,
      palette,
      cssVar,
    );
    expect(withBg).toContain('fill="#abcdef"');
    expect(withBg).not.toContain("#faf9f5"); // the theme page bg is overridden
  });

  it("emits a background <image> over the viewBox when meta.backgroundImage is set", () => {
    const BG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const withImg = buildFlowSvg({ ...doc, meta: { backgroundImage: BG } }, rects, palette, cssVar);
    // The exact viewBox the page-bg rect uses, so the image covers the whole map (slice = cover).
    const vb = withImg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
    expect(vb).not.toBeNull();
    const [, vx, vy, vw, vh] = vb as RegExpMatchArray;
    expect(withImg).toContain(
      `<image x="${vx}" y="${vy}" width="${vw}" height="${vh}" href="${BG}" preserveAspectRatio="xMidYMid slice"/>`,
    );
    // It sits on top of the page-background rect, beneath the rest (the first node/path).
    const rectEnd = withImg.indexOf("/>") + 2; // end of the page-bg rect
    expect(withImg.indexOf(BG)).toBeGreaterThan(rectEnd);
  });

  it("omits the background <image> when meta.backgroundImage is unset", () => {
    // No "slice" image anywhere; node images use "meet", so the bg layer is what's gated here.
    expect(svg).not.toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it("renders every topic as native <text> (no foreignObject)", () => {
    expect(svg).not.toMatch(/foreignObject/);
    expect(svg).toMatch(/<text[^>]*>Root<\/text>/);
  });

  it("renders a multi-line topic as stacked <tspan> lines + the marker as a vector tile", () => {
    expect(svg).toMatch(/<tspan[^>]*>Multi<\/tspan>/);
    expect(svg).toMatch(/<tspan[^>]*dy="[0-9.]+"[^>]*>Line<\/tspan>/);
    // the ⭐ marker now renders as a flat vector <image> tile, not an emoji glyph in the text
    expect(svg).toContain('href="data:image/svg+xml,');
    expect(svg).not.toMatch(/<tspan[^>]*>⭐/);
  });

  it("draws a node border from the style shorthand colour", () => {
    expect(svg).toContain('stroke="#e23"');
  });

  it("applies a per-topic font family (and defaults to sans-serif)", () => {
    expect(svg).toContain('font-family="serif"'); // node "c" is styled serif
    expect(svg).toContain('font-family="sans-serif"'); // unstyled topics keep the default
  });

  it("embeds an image node with its data URL", () => {
    expect(svg).toMatch(/<image[\s>]/);
    expect(svg).toContain("data:image/png;base64,");
  });

  it("embeds a built-in sticker (SVG data URL) as a node <image> with a positive size", () => {
    // A sticker is just node.image with a data:image/svg+xml URL, so it must flow through the very
    // same <image> path as a file image — proving stickers render in every export with no new code.
    const sticker = stickerImage(STICKERS[0]);
    const withSticker = buildFlowSvg(
      {
        ...doc,
        root: {
          ...doc.root,
          children: [{ id: "s", topic: "Star it", image: sticker, children: [] }],
        },
      },
      new Map<string, NodeRect>([
        ["r", { x: 400, y: 300, w: 120, h: 50 }],
        ["s", { x: 600, y: 380, w: 120, h: 120 }],
      ]),
      palette,
      cssVar,
    );
    const m = withSticker.match(
      /<image x="[-\d.]+" y="[-\d.]+" width="([\d.]+)" height="([\d.]+)" href="(data:image\/svg\+xml,[^"]+)"/,
    );
    expect(m).not.toBeNull();
    const [, w, , href] = m as RegExpMatchArray;
    expect(Number(w)).toBeGreaterThan(0); // sized node → positive image box (shared image math)
    // …and the href round-trips back to the sticker's own SVG.
    expect(decodeURIComponent(href.slice("data:image/svg+xml,".length))).toBe(STICKERS[0].svg);
  });

  it("draws branch ribbons (filled <path>) and a dashed cross-link", () => {
    expect(svg).toMatch(/<path d="[^"]+" fill="#/); // tapered branch ribbon
    expect(svg).toMatch(/stroke-dasharray=/); // cross-link
  });

  it("carries the cross-link label (dropped by the old export)", () => {
    expect(svg).toContain("depends on");
  });

  it("draws the relationship as the SHARED crosslink S-bezier (canvas == export)", () => {
    // The exporter now builds the visible relationship line from crosslinkBezier — the same helper the
    // live CrosslinkEdge uses — so the curve bows along the same (horizontal) axis on screen and here.
    const toBox = (r: NodeRect) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w, h: r.h });
    const { sx, sy, tx, ty } = floatingPoints(
      toBox(rects.get("a") as NodeRect),
      toBox(rects.get("c") as NodeRect),
    );
    expect(svg).toContain(crosslinkBezier(sx, sy, tx, ty).path);
  });

  it("exports an imported priority 4–9 as its number on a badge — never '?'", () => {
    const pdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "p",
      title: "P",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "hi", topic: "Hi", task: { priority: 5 }, children: [] }],
      },
    };
    const prects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 80, h: 40 }],
      ["hi", { x: 200, y: 0, w: 80, h: 40 }],
    ]);
    const out = buildFlowSvg(pdoc, prects, palette, cssVar);
    expect(out).toMatch(/>5<\/text>/); // the priority badge shows the number
    expect(out).not.toContain(">?<"); // and never the old "?" fallback
  });

  it("draws an emoji / non-vector marker in the marker row, not as a title-text prefix", () => {
    const edoc: MindMapDoc = {
      schemaVersion: 1,
      id: "em",
      title: "E",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "hi", topic: "Hi", icons: ["👍"], children: [] }], // 👍 has no vector tile
      },
    };
    const erects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 80, h: 40 }],
      ["hi", { x: 200, y: 0, w: 120, h: 60 }],
    ]);
    const out = buildFlowSvg(edoc, erects, palette, cssVar);
    // the emoji is its OWN centred <text> tile (the marker row), not concatenated into the title text
    expect(out).toMatch(/<text[^>]*text-anchor="middle"[^>]*>👍<\/text>/);
    expect(out).not.toMatch(/>👍 Hi</); // not prefixed onto the title
  });

  it("keeps the 📅 glyph on the due-date chip (canvas == export parity)", () => {
    const ddoc: MindMapDoc = {
      schemaVersion: 1,
      id: "due",
      title: "D",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "hi", topic: "Hi", task: { due: "2026-06-20" }, children: [] }],
      },
    };
    const drects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 80, h: 40 }],
      ["hi", { x: 200, y: 0, w: 80, h: 40 }],
    ]);
    const out = buildFlowSvg(ddoc, drects, palette, cssVar);
    expect(out).toContain("📅"); // the calendar glyph the canvas DateChip shows must survive into the export
    // The chip is sized from its label's width, and 📅 is a surrogate pair: charging it as two narrow
    // characters under-sized the pill against the glyph's real 1.373em advance. Pin the corrected
    // width so the emoji can't silently start overflowing its own chip again.
    const label = "📅 20 Jun";
    expect(widthUnits(label)).toBeGreaterThan(label.length); // the pill grew, it didn't shrink
    expect(out).toContain(`width="${Number((widthUnits(label) * 6.2 + 10).toFixed(2))}"`);
  });

  it("renders a completed task as a filled pie with a check tick, a partial one as a wedge", () => {
    const mk = (p: number): MindMapDoc => ({
      schemaVersion: 1,
      id: "pr",
      title: "Pr",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "t", topic: "T", task: { progress: p }, children: [] }],
      },
    });
    const prects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 80, h: 40 }],
      ["t", { x: 200, y: 0, w: 80, h: 40 }],
    ]);
    const done = buildFlowSvg(mk(1), prects, palette, cssVar);
    expect(done).toContain('fill="#27852f"'); // the "complete" green fill
    expect(done).toMatch(/<path d="M[^"]*" fill="none" stroke="#fff"/); // the check tick
    const half = buildFlowSvg(mk(0.5), prects, palette, cssVar);
    expect(half).toContain('fill="#3b8bd4"'); // the in-progress blue wedge
    expect(half).not.toContain('stroke="#fff"'); // no tick on a partial pie
  });

  it("shows the note/link indicator even on a node whose title is blank", () => {
    const ndoc: MindMapDoc = {
      schemaVersion: 1,
      id: "ind",
      title: "I",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "n", topic: "  ", note: "hidden", children: [] }],
      },
    };
    const nrects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 80, h: 40 }],
      ["n", { x: 200, y: 0, w: 80, h: 40 }],
    ]);
    const out = buildFlowSvg(ndoc, nrects, palette, cssVar);
    expect(out).toContain("📝"); // the note cue survives even with no title text to append to
  });

  it("draws a funnel backdrop as path bands (not just circles)", () => {
    const fdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "fn",
      title: "F",
      root: { id: "r", topic: "R", children: [] },
      backdrop: { kind: "funnel", rings: 3 },
    };
    const frects = new Map<string, NodeRect>([["r", { x: -20, y: -20, w: 40, h: 40 }]]);
    const out = buildFlowSvg(fdoc, frects, palette, cssVar);
    expect(out).toMatch(/<path d="M [^"]*Z" fill=/); // funnel band paths emitted
  });

  it("falls back to a default viewBox when there are no node rects", () => {
    const empty = new Map<string, NodeRect>();
    const out = buildFlowSvg(doc, empty, palette, cssVar);
    // minX stays non-finite → the 0..100 fallback, padded by EXPORT_MARGIN on each side.
    expect(out).toContain(
      `viewBox="${-EXPORT_MARGIN} ${-EXPORT_MARGIN} ${100 + 2 * EXPORT_MARGIN} ${100 + 2 * EXPORT_MARGIN}"`,
    );
  });

  it("draws a directional arrowhead on the cross-link (a filled triangle at the target)", () => {
    // a 3-vertex triangle filled with the cross-link colour — the relationship's arrowhead
    // (branch ribbons fill with branch colours; the dashed line uses stroke, not fill)
    expect(svg).toMatch(
      new RegExp(
        `<path d="M -?[\\d.]+ -?[\\d.]+ L -?[\\d.]+ -?[\\d.]+ L -?[\\d.]+ -?[\\d.]+ Z" fill="${CROSSLINK_COLOR}"`,
      ),
    );
  });

  it("line-jumps: draws a hop arc on exactly one crossing relationship (canvas == export)", () => {
    // Four nodes at the corners of a square; two diagonal relationships cross in the middle.
    const ldoc: MindMapDoc = {
      schemaVersion: 1,
      id: "lj",
      title: "LJ",
      meta: { lineJumps: true },
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "tl", topic: "TL", children: [] },
          { id: "tr", topic: "TR", children: [] },
          { id: "bl", topic: "BL", children: [] },
          { id: "br", topic: "BR", children: [] },
        ],
      },
      links: [
        { id: "d1", from: "tl", to: "br" }, // ↘
        { id: "d2", from: "tr", to: "bl" }, // ↙ — crosses d1
      ],
    };
    const lrects = new Map<string, NodeRect>([
      ["r", { x: 240, y: 240, w: 40, h: 20 }],
      ["tl", { x: 0, y: 0, w: 80, h: 40 }],
      ["tr", { x: 440, y: 0, w: 80, h: 40 }],
      ["bl", { x: 0, y: 440, w: 80, h: 40 }],
      ["br", { x: 440, y: 440, w: 80, h: 40 }],
    ]);
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    // Exactly one relationship hops (one elliptical-arc command on a dashed line).
    const hopLines =
      out.match(
        /<path d="[^"]*A [^"]*" fill="none" stroke="[^"]*" stroke-width="[^"]*" stroke-dasharray=/g,
      ) ?? [];
    expect(hopLines).toHaveLength(1);
    // …and turning the flag off removes the hop (plain S-bezier relationships).
    const off = buildFlowSvg({ ...ldoc, meta: {} }, lrects, palette, cssVar);
    expect(off).not.toMatch(/<path d="[^"]*A [^"]*" fill="none"[^>]*stroke-dasharray=/);
  });

  it("draws the boundary outline (path) and carries its label (dropped by the old export)", () => {
    expect(svg).toMatch(/<path[^>]*stroke="#8b87e0"/); // the boundary outline path (default accent)
    expect(svg).toContain("Theme group"); // the title-tab label
  });

  it("emits a geometric node as the shared shapePath (canvas == export), not a rect", () => {
    const sdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "s",
      title: "Shapes",
      root: {
        id: "r",
        topic: "Root",
        children: [
          {
            id: "dia",
            topic: "Decision",
            style: { shape: "diamond", background: "#fde2e2" },
            children: [],
          },
        ],
      },
    };
    const srects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 100, h: 40 }],
      ["dia", { x: 200, y: 0, w: 120, h: 50 }],
    ]);
    const out = buildFlowSvg(sdoc, srects, palette, cssVar);
    // The exact path the canvas paints — same builder — filled with the node's own background.
    expect(out).toContain(`<path d="${shapePath("diamond", 200, 0, 120, 50)}"`);
    expect(out).toContain('fill="#fde2e2"');
  });

  it("exports the extended vector shapes (cloud / star / document …) via the same path builder", () => {
    const shapes = ["trapezoid", "octagon", "document", "callout", "star", "cloud"] as const;
    const sdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "x",
      title: "Extended",
      root: {
        id: "r",
        topic: "Root",
        children: shapes.map((shape, i) => ({
          id: shape,
          topic: shape,
          style: { shape },
          // alternate sides so the layout rects below stay simple
          side: i % 2 === 0 ? ("right" as const) : ("left" as const),
          children: [],
        })),
      },
    };
    const xrects = new Map<string, NodeRect>([["r", { x: 0, y: 0, w: 100, h: 40 }]]);
    shapes.forEach((shape, i) => xrects.set(shape, { x: 200, y: i * 70, w: 130, h: 56 }));
    const out = buildFlowSvg(sdoc, xrects, palette, cssVar);
    // Each shape lands in the export as the exact path the canvas paints (same builder).
    for (const shape of shapes) {
      const r = xrects.get(shape) as NodeRect;
      expect(out, shape).toContain(`<path d="${shapePath(shape, r.x, r.y, r.w, r.h)}"`);
    }
  });

  it("draws the diagram backdrop (concentric circles) and extends the viewBox to include it", () => {
    const odoc: MindMapDoc = {
      schemaVersion: 1,
      id: "o",
      title: "O",
      backdrop: { kind: "onion", rings: 2 },
      root: { id: "r", topic: "R", children: [] },
    };
    const orects = new Map<string, NodeRect>([["r", { x: -20, y: -20, w: 40, h: 40 }]]);
    const out = buildFlowSvg(odoc, orects, palette, cssVar);
    expect((out.match(/<circle /g) ?? []).length).toBe(2); // 2 onion rings
    expect(out).toContain('stroke="#9a93d6"'); // BACKDROP_STROKE
    const vbW = Number(out.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"/)?.[1] ?? 0);
    expect(vbW).toBeGreaterThanOrEqual(600); // bounds extended to the 600-wide onion
  });

  it("escapes user-set colours in every emitted attribute (no SVG attribute breakout)", () => {
    // Colours come from the model and can carry a hand-edited/imported value. They land in quoted SVG
    // attributes the export builds by hand, so a value with a quote would break out and inject markup.
    // The canvas is safe (React escapes), but the export string must escape too — defence in depth on
    // top of svgSanitize. esc() is a no-op for real colours, so canvas == export is unchanged.
    const MAL = '#f00"/><script>alert(1)</script>';
    const malDoc: MindMapDoc = {
      schemaVersion: 1,
      id: "mal",
      title: "Mal",
      root: {
        id: "r",
        topic: "Root",
        children: [
          {
            id: "a",
            topic: "A",
            branchColor: MAL, // → branch ribbon fill/stroke
            callouts: [{ id: "co", text: "hi", dx: 40, dy: 0, color: MAL }],
            children: [],
          },
          { id: "b", topic: "B", side: "left", children: [] },
        ],
      },
      links: [{ id: "lk", from: "a", to: "b", label: "rel", color: MAL }], // → crosslink stroke/fill/text
      boundaries: [{ id: "bd", nodeIds: ["a", "b"], label: "grp", color: MAL }], // → gradient/stroke/tab
      summaries: [{ id: "sm", nodeIds: ["a", "b"], label: "sum", color: MAL }], // → bracket/label
      backdrop: { kind: "onion", rings: 2, color: MAL }, // → backdrop fill/stroke
    };
    const malRects = new Map<string, NodeRect>([
      ["r", { x: 400, y: 300, w: 120, h: 50 }],
      ["a", { x: 600, y: 200, w: 100, h: 40 }],
      ["b", { x: 180, y: 380, w: 100, h: 40 }],
    ]);
    const out = buildFlowSvg(malDoc, malRects, palette, cssVar);
    expect(out).not.toContain("<script>"); // no injected element
    expect(out).not.toContain('"/><script'); // no attribute breakout of the raw payload
    expect(out).toContain("&lt;script&gt;"); // the colour DID reach the export — and was neutralised
  });

  it("brace mode emits fork connectors (stroked path) and drops the tapered ribbons", () => {
    const bdoc: MindMapDoc = {
      schemaVersion: 1,
      id: "br",
      title: "B",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", children: [] },
          { id: "c", topic: "C", children: [] },
        ],
      },
    };
    const brects = new Map<string, NodeRect>([
      ["r", { x: 0, y: 50, w: 100, h: 40 }],
      ["a", { x: 200, y: 0, w: 80, h: 40 }],
      ["c", { x: 200, y: 100, w: 80, h: 40 }],
    ]);
    const braces = [{ parentId: "r", childIds: ["a", "c"] }];
    const filled = (s: string) =>
      (s.match(/<path d="[^"]*" fill="#[0-9a-f]{3,8}"\/>/gi) ?? []).length;
    const withRibbons = buildFlowSvg(bdoc, brects, palette, cssVar);
    const withBraces = buildFlowSvg(bdoc, brects, palette, cssVar, false, "", braces);
    expect(withBraces).toContain('stroke="#6b7280"'); // the fork
    expect(filled(withBraces)).toBeLessThan(filled(withRibbons)); // ribbons gone in brace mode
  });

  it("draws a summary bracket (path) + its label, side-aware", () => {
    // Isolated doc so the shared-doc path count above stays branch+crosslink only.
    const withSummary = buildFlowSvg(
      { ...doc, summaries: [{ id: "su1", nodeIds: ["b"], label: "Phase 1" }] },
      rects,
      palette,
      cssVar,
    );
    expect(withSummary).toMatch(/<path[^>]*stroke="#27852f"/); // the bracket polyline
    expect(withSummary).toContain("Phase 1");
    // The bracket adds exactly one extra <path> over the no-summary export.
    const base = (svg.match(/<path[\s>]/g) ?? []).length;
    const withCount = (withSummary.match(/<path[\s>]/g) ?? []).length;
    expect(withCount).toBe(base + 1);
  });

  it("renders callouts (sticky bubble + dashed connector + text)", () => {
    expect(svg).toContain("Review me");
    expect(svg).toContain('fill="#fff8c5"'); // sticky-note bubble
    expect(svg).toMatch(/stroke-dasharray="3 3"/); // callout connector (distinct from cross-link)
  });

  it("escapes XML special characters in topics", () => {
    const tricky = buildFlowSvg(
      { ...doc, root: { id: "r", topic: "A & B <c>", children: [] } },
      new Map([["r", { x: 0, y: 0, w: 100, h: 40 }]]),
      palette,
      cssVar,
    );
    // (the narrow fixed rect wraps it across two tspans, but every special char is still escaped)
    expect(tricky).toContain("A &amp; B");
    expect(tricky).toContain("&lt;c&gt;");
    expect(tricky).not.toContain("<c>");
  });
});

describe("flow exportSvg — styled relationship fidelity (canvas == export)", () => {
  // The export resolves per-link colour/width/dash + arrow placement through the SAME helper the
  // canvas edge uses (resolveLinkStyle), so a styled relationship must round-trip into the SVG.
  const styledDoc = (over: Partial<CrossLink>): MindMapDoc => ({
    schemaVersion: 1,
    id: "s",
    title: "S",
    root: {
      id: "r",
      topic: "R",
      children: [
        { id: "a", topic: "A", children: [] },
        { id: "b", topic: "B", children: [] },
      ],
    },
    links: [{ id: "l", from: "a", to: "b", ...over }],
  });
  const rr = new Map<string, NodeRect>([
    ["r", { x: 0, y: 0, w: 80, h: 40 }],
    ["a", { x: 200, y: 0, w: 80, h: 40 }],
    ["b", { x: 200, y: 200, w: 80, h: 40 }],
  ]);
  const build = (over: Partial<CrossLink>) => buildFlowSvg(styledDoc(over), rr, palette, cssVar);

  it("applies a custom colour + width + dotted dash to the relationship stroke", () => {
    expect(build({ color: "#ff0000", width: 3, dash: "dotted" })).toMatch(
      /stroke="#ff0000" stroke-width="3" stroke-dasharray="2 4"/,
    );
  });

  it("a solid relationship omits the dash attribute entirely", () => {
    // No callouts/boundaries here, so the ONLY potential dasharray is the (now solid) relationship.
    expect(build({ dash: "solid" })).not.toMatch(/stroke-dasharray/);
  });

  it("arrow 'both' draws two arrowheads and 'none' draws zero (arrowheads fill with the colour)", () => {
    const both = build({ arrow: "both", color: "#123456" });
    expect([...both.matchAll(/ fill="#123456"/g)]).toHaveLength(2); // one head per end
    expect(build({ arrow: "none", color: "#654321" })).not.toMatch(/ fill="#654321"/);
  });
});

describe("flow exportSvg — styled overlay fidelity (canvas == export)", () => {
  // Each overlay (boundary / summary / callout / backdrop) resolves its per-object colour through the
  // SAME resolver the canvas component uses, so a recoloured overlay must export byte-identically and
  // an uncoloured one must keep the historical default constants.
  const orects = new Map<string, NodeRect>([
    ["r", { x: 0, y: 0, w: 80, h: 40 }],
    ["a", { x: 200, y: 0, w: 80, h: 40 }],
    ["b", { x: 200, y: 200, w: 80, h: 40 }],
  ]);
  const ovDoc = (over: Partial<MindMapDoc>): MindMapDoc => ({
    schemaVersion: 1,
    id: "o",
    title: "O",
    root: {
      id: "r",
      topic: "R",
      children: [
        {
          id: "a",
          topic: "A",
          children: [],
          callouts: [{ id: "co", text: "Note", dx: 20, dy: 0 }],
        },
        { id: "b", topic: "B", children: [] },
      ],
    },
    ...over,
  });
  const buildOv = (over: Partial<MindMapDoc>) => buildFlowSvg(ovDoc(over), orects, palette, cssVar);

  it("re-tints a boundary's stroke + fill + label chip from the resolver (canvas == export)", () => {
    const s = resolveBoundaryStyle("#3f9e6e");
    const out = buildOv({
      boundaries: [{ id: "bd", nodeIds: ["a", "b"], label: "Grp", color: "#3f9e6e" }],
    });
    // outline path strokes in the resolved colour; gradient stops + the title-tab use the resolver too
    expect(out).toMatch(new RegExp(`<path[^>]*stroke="${s.stroke}"`));
    expect(out).toContain(`stop-color="${s.fillTop}"`);
    expect(out).toContain(`stop-color="${s.fillBottom}"`);
    expect(out).toContain(`fill="${s.stroke}"`); // the title-tab fill
  });

  it("an uncoloured boundary keeps the default accent constants", () => {
    const out = buildOv({ boundaries: [{ id: "bd", nodeIds: ["a", "b"], label: "Grp" }] });
    expect(out).toMatch(/<path[^>]*stroke="#8b87e0"/);
  });

  it("renders a boundary's shape (cloud) + dashed outline", () => {
    const out = buildOv({
      boundaries: [{ id: "bd", nodeIds: ["a", "b"], label: "Grp", shape: "cloud", dash: "dashed" }],
    });
    expect(out).toMatch(/<path d="M [^"]*Q[^"]*" fill="url\(#bgrad-bd\)"/); // cloud bumps + gradient
    expect(out).toContain('stroke-dasharray="6 5"'); // dashed outline
  });

  it("re-tints a summary bracket + chip from the resolver", () => {
    const s = resolveSummaryStyle("#e0697f");
    const out = buildOv({
      summaries: [{ id: "su", nodeIds: ["a"], label: "Phase 1", color: "#e0697f" }],
    });
    expect(out).toMatch(new RegExp(`<path[^>]*stroke="${s.stroke}"`));
    expect(out).toContain(`fill="${s.labelBg}" stroke="${s.labelBorder}"`);
  });

  it("re-tints a callout bubble + connector + text from the resolver", () => {
    const s = resolveCalloutStyle("#d98a2b");
    const out = buildOv({
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            children: [],
            callouts: [{ id: "co", text: "Note", dx: 20, dy: 0, color: "#d98a2b" }],
          },
          { id: "b", topic: "B", children: [] },
        ],
      },
    });
    expect(out).toContain(`fill="${s.bg}" stroke="${s.stroke}"`);
    expect(out).toContain(`stroke="${s.connector}" stroke-width="1.5" stroke-dasharray="3 3"`);
    expect(out).toContain(`fill="${s.text}"`);
  });

  it("re-tints a diagram backdrop's stroke + fill (and absent → default #9a93d6)", () => {
    const onion = buildOv({ backdrop: { kind: "onion", rings: 2, color: "#3b82c4" } });
    expect(onion).toContain('stroke="#3b82c4"');
    const plain = buildOv({ backdrop: { kind: "onion", rings: 2 } });
    expect(plain).toContain('stroke="#9a93d6"'); // BACKDROP_STROKE default
  });
});

describe("flow exportSvg survives the cleanSvg pipeline (sanitizeSvg)", () => {
  // The export gate: a native-text SVG must pass through cleanSvg unchanged (sanitizeSvg keeps
  // the safe element vocabulary), so png/svg/html/pdf still work.
  const out = sanitizeSvg(buildFlowSvg(doc, rects, palette, cssVar));

  it("keeps every topic + multi-line tspan", () => {
    expect(out).toContain("Root");
    expect(out).toMatch(/<tspan[^>]*>Multi<\/tspan>/);
    expect(out).toContain("Line");
  });

  it("keeps the cross-link and boundary labels", () => {
    expect(out).toContain("depends on");
    expect(out).toContain("Theme group");
  });

  it("keeps callout text", () => {
    expect(out).toContain("Review me");
  });

  it("keeps the marker (vector tile) and the image data URL", () => {
    expect(out).toContain("data:image/svg+xml,"); // the ⭐ marker now renders as a vector <image>
    expect(out).toContain("data:image/png;base64,"); // the topic image
  });

  it("keeps all path geometry (3 branches + 1 crosslink line + 1 arrowhead + 1 boundary outline)", () => {
    expect((out.match(/<path[\s>]/g) ?? []).length).toBe(6);
  });

  it("introduced no foreignObject and no script", () => {
    expect(out).not.toMatch(/foreignObject/);
    expect(out).not.toMatch(/<script/i);
  });
});

describe("flow exportSvg — level styling, task-info, org elbows (canvas == export)", () => {
  // r(0) → m(1, a task) → s(2) → leaf(3): one node per level so the depth-driven box treatments fire.
  const ldoc: MindMapDoc = {
    schemaVersion: 1,
    id: "lv",
    title: "LV",
    root: {
      id: "r",
      topic: "Root",
      children: [
        {
          id: "m",
          topic: "Main",
          task: { start: "2026-03-03", durationDays: 5, resources: ["Ann", "Bo"] },
          children: [
            { id: "s", topic: "Sub", children: [{ id: "leaf", topic: "Leaf", children: [] }] },
          ],
        },
      ],
    },
  };
  const lrects = new Map<string, NodeRect>([
    ["r", { x: 0, y: 0, w: 120, h: 50 }],
    ["m", { x: 200, y: 0, w: 120, h: 44 }],
    ["s", { x: 400, y: 0, w: 120, h: 36 }],
    ["leaf", { x: 600, y: 0, w: 120, h: 36 }],
  ]);

  it("fills the depth-1 main topic with its branch colour (no white card, no border)", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    expect(out).toContain('<rect x="200" y="0" width="120" height="44" rx="11" fill="#E8593C"/>');
  });

  it("renders a depth-3+ leaf as a branch-colour underline, not a bordered box", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    expect(out).toContain(
      '<line x1="602" y1="35" x2="718" y2="35" stroke="#E8593C" stroke-width="2"/>',
    );
    expect(out).not.toContain('<rect x="600"'); // the leaf draws no card rect
  });

  it("renders a depth-2 node as a bordered card (branch-colour 1.5px stroke, white fill)", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    expect(out).toContain(
      '<rect x="400" y="0" width="120" height="36" rx="11" fill="#ffffff" stroke="#E8593C" stroke-width="1.5"/>',
    );
  });

  it("resolveLevelBox classifies depth/style identically for canvas + export (one source)", () => {
    const at = (depth: number, extra = {}) =>
      resolveLevelBox({ isRoot: false, geom: false, depth, ...extra });
    expect(resolveLevelBox({ isRoot: true, geom: false, depth: 0 })).toEqual({
      filledMain: false,
      underlineLeaf: false,
    });
    expect(at(1)).toEqual({ filledMain: true, underlineLeaf: false });
    expect(at(1, { style: { background: "#eee" } })).toEqual({
      filledMain: false,
      underlineLeaf: false,
    }); // a manual background reverts to a normal card
    expect(at(2)).toEqual({ filledMain: false, underlineLeaf: false }); // bordered card
    expect(at(3)).toEqual({ filledMain: false, underlineLeaf: true });
    expect(at(3, { style: { border: "1px solid #000" } })).toEqual({
      filledMain: false,
      underlineLeaf: false,
    }); // a manual border reverts the leaf to a card
    expect(resolveLevelBox({ isRoot: false, geom: true, depth: 1 })).toEqual({
      filledMain: false,
      underlineLeaf: false,
    }); // a geometric shape opts out of level styling
  });

  it("draws the inline task-info line (start ▸ duration ▸ resources)", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    expect(out).toContain("▶");
    expect(out).toContain("5d");
    expect(out).toContain("@Ann, Bo");
  });

  it("centres the root label (text-anchor=middle) at the larger root size", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    expect(out).toMatch(
      /<text x="60"[^>]*text-anchor="middle"[^>]*font-size="20"[^>]*>Root<\/text>/,
    );
  });

  it("renders org-chart layouts with uniform right-angle elbows, not tapered ribbons", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar, false, "", undefined, "org-down");
    // an elbow is a fill:none stroked path with rounded corners (the organic ribbon is a FILLED path)
    expect(out).toMatch(
      /<path d="M [^"]*Q[^"]*" fill="none" stroke="#E8593C" stroke-width="[\d.]+"/,
    );
  });

  it("keeps the organic taper (a filled branch path) for the default side layout", () => {
    const out = buildFlowSvg(ldoc, lrects, palette, cssVar);
    expect(out).toMatch(/<path d="M [^"]*" fill="#E8593C"\/>/); // filled ribbon, no stroke
  });
});

describe("flow exportSvg — canvas == export parity (wrap, callouts, indicators, collapse, image)", () => {
  const rr = (id: string, w: number, h: number) =>
    new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 120, h: 50 }],
      [id, { x: 200, y: 0, w, h }],
    ]);

  it("word-wraps a long topic into multiple <tspan> lines (no overflow)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "w",
      title: "W",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A deliberately long single-line topic that must wrap in its box",
            children: [],
          },
        ],
      },
    };
    const out = buildFlowSvg(d, rr("a", 160, 120), palette, cssVar);
    expect((out.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it("grows a multi-line callout bubble + emits stacked tspans (not a single clipped strip)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "c",
      title: "C",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            callouts: [
              {
                id: "co",
                text: "a fairly long callout note that wraps onto several lines",
                dx: 40,
                dy: 0,
              },
            ],
            children: [],
          },
        ],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    // the callout text (CALLOUT_TEXT #3b2f00) carries multiple tspans
    expect(out).toMatch(/fill="#3b2f00"><tspan/);
    expect((out.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it("draws note + hyperlink indicators in the export (no longer dropped)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "i",
      title: "I",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "a", topic: "A", note: "hello", hyperlink: "https://x", children: [] }],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toContain("🔗");
    expect(out).toContain("📝");
  });

  it("draws the attachment-count chip in the export", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "at",
      title: "AT",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            attachments: [{ name: "f", dataUrl: PNG, size: 1 }],
            children: [],
          },
        ],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toContain("📎 1");
  });

  it("draws a collapsed-branch circle + hidden-subtopic count in the export", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "col",
      title: "COL",
      root: {
        id: "r",
        topic: "R",
        children: [
          {
            id: "a",
            topic: "A",
            collapsed: true,
            children: [
              { id: "a1", topic: "A1", children: [] },
              { id: "a2", topic: "A2", children: [] },
            ],
          },
        ],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toMatch(/<circle cx="320" cy="44" r="9"/); // node a's bottom-right corner
    expect(out).toMatch(/>2<\/text>/); // two hidden subtopics
  });

  it("clamps an oversized topic image to 200×140 in the export (matches the canvas cap)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "img",
      title: "IMG",
      root: {
        id: "r",
        topic: "R",
        children: [
          { id: "a", topic: "A", image: { url: PNG, width: 600, height: 400 }, children: [] },
        ],
      },
    };
    const out = buildFlowSvg(d, rr("a", 240, 180), palette, cssVar);
    expect(out).toMatch(/<image x="[\d.]+" y="[\d.]+" width="200" height="140"/);
  });
});

describe("flow exportSvg — branch-derived topic fills (canvas == export)", () => {
  const rr = (id: string, w: number, h: number) =>
    new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 120, h: 50 }],
      [id, { x: 200, y: 0, w, h }],
    ]);

  it("emits a per-node <linearGradient> + url(#) fill for a gradient-filled topic", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "g",
      title: "G",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "a", topic: "A", style: { fill: "gradient" }, children: [] }],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toContain('<linearGradient id="nfill-a"');
    expect(out).toContain('fill="url(#nfill-a)"');
  });

  it("paints a tint as a flat colour (no gradient def)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "t",
      title: "T",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "a", topic: "A", style: { fill: "tint" }, children: [] }],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).not.toContain("linearGradient");
    expect(out).toMatch(/<rect[^>]*fill="#[0-9a-f]{6}"/i);
  });

  it("renders an image-fill topic as a rounded-clipped cover <image> + scrim", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "if",
      title: "IF",
      root: {
        id: "r",
        topic: "R",
        children: [{ id: "a", topic: "A", style: { fillImage: PNG }, children: [] }],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toContain('<clipPath id="nclip-a">');
    expect(out).toMatch(
      /<image[^>]*preserveAspectRatio="xMidYMid slice"[^>]*clip-path="url\(#nclip-a\)"/,
    );
    expect(out).toContain('fill="rgba(0,0,0,0.32)"'); // readability scrim
    expect(out).toContain(PNG); // the data URL is embedded
  });
});

describe("flow exportSvg — map legend", () => {
  const rr = (id: string, w: number, h: number) =>
    new Map<string, NodeRect>([
      ["r", { x: 0, y: 0, w: 120, h: 50 }],
      [id, { x: 200, y: 0, w, h }],
    ]);

  it("draws a legend box with a row per marker / tag / rule when meta.legend is on", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "lg",
      title: "L",
      meta: { legend: true },
      root: {
        id: "r",
        topic: "R",
        icons: ["⭐"],
        tags: ["q3"],
        children: [{ id: "a", topic: "A", children: [] }],
      },
      rules: [{ id: "x", kind: "tag", value: "q3", style: { background: "#fee2e2" } }],
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toContain(">Legend</text>");
    expect(out).toContain(">q3</text>"); // the tag row
    expect(out).toContain(">tag q3</text>"); // the rule row (describeRule)
    expect(out).toContain('fill="#fee2e2"'); // the rule's colour swatch
  });

  it("omits the legend when meta.legend is unset", () => {
    expect(buildFlowSvg(doc, rects, palette, cssVar)).not.toContain(">Legend</text>");
  });

  it("draws an emoji marker in the legend as a text glyph (no vector tile)", () => {
    const d: MindMapDoc = {
      schemaVersion: 1,
      id: "lg2",
      title: "L",
      meta: { legend: true },
      root: {
        id: "r",
        topic: "R",
        icons: ["👍"],
        children: [{ id: "a", topic: "A", children: [] }],
      },
    };
    const out = buildFlowSvg(d, rr("a", 120, 44), palette, cssVar);
    expect(out).toContain(">Legend</text>");
    expect(out).toMatch(/font-size="11">👍<\/text>/); // glyph fallback row, not an <image> tile
  });
});

describe("arrowHeadPath (shared relationship arrowhead)", () => {
  it("builds a 3-vertex triangle with its tip at the target, pointing away from the source", () => {
    const d = arrowHeadPath(100, 0, 0, 0, 9); // horizontal, pointing +x
    expect(d.startsWith("M 100 0 L")).toBe(true); // tip exactly at the target
    expect(d.endsWith("Z")).toBe(true);
    expect((d.match(/L/g) ?? []).length).toBe(2); // 3 vertices
    // base sits `size` back from the tip along the axis
    expect(d).toContain("L 91 "); // bx = 100 - 9
  });

  it("scales the head with the size argument (the caller passes 6 + width*2)", () => {
    expect(arrowHeadPath(100, 0, 0, 0, 8)).toContain("L 92 "); // base 8 back
    expect(arrowHeadPath(100, 0, 0, 0, 16)).toContain("L 84 "); // base 16 back → bigger head
  });
});
