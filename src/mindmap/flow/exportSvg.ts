import { t } from "../../i18n/registry";
import { markerImage } from "../../icons";
import { buildLegend } from "../../legend";
import type { MapNode, MindMapDoc } from "../../model/types";
import { priorityColor, priorityLabel } from "../../priority";
import { checkPath, piePath } from "../../progress";
import { formatDateShort, isOverdue, taskInfoLine } from "../../taskDate";
import type { LayoutKind } from "../contract";
import { arrowHeadPath } from "./arrowhead";
import { backdropGeometry } from "./backdrop";
import { type BraceGroup, braceGeometry, bracePath } from "./brace";
import { canvasShapeGeometry } from "./canvasShapes";
import {
  type AttachSide,
  type Box,
  attachSideFor,
  axisForLayoutKind,
  bowToClear,
  branchRender,
  computeAxisByParent,
  crosslinkBezier,
  floatingPoints,
  isTaperBranch,
} from "./floating";
import { type Rect, boundaryPath, dashArray, matchBorderColor, r2 } from "./geometry";
import { type HopSegment, hopPath } from "./lineJumps";
import { project } from "./project";
import { isGeometric, shapeInset, shapeOverlayPath, shapePath } from "./shapes";
import {
  BOUNDARY_PAD,
  BRACE_STROKE,
  SUMMARY_BRACKET_W,
  SUMMARY_GAP,
  SUMMARY_PAD,
  TOPIC_SHADOW_SVG_DEF,
  boundaryLabel,
  levelFontSize,
  readableTextOn,
  resolveBoundaryStyle,
  resolveCalloutStyle,
  resolveLevelBox,
  resolveLinkStyle,
  resolveSummaryStyle,
  resolveTopicFill,
  summaryLabel,
} from "./style";
import { widthUnits, wrapText } from "./text";
import type { TopicNode } from "./types";

// Author a clean, standalone SVG of the map directly from the canonical model + the live
// node rects — emitting native <text> from the start (no foreignObject), so it renders
// everywhere and flows through useMapExports.cleanSvg() (sanitizeSvg stays the XSS guard,
// inlineSvgText becomes a harmless pass-through). It reuses the canvas's own tapered-ribbon
// and floating-edge geometry — and the boundary/cross-link colours from ./style — so the
// export matches the screen, and it carries arrow + boundary *labels* (which a foreignObject-
// based export drops).

/** A node's on-screen box, the export's input (alias of the shared Rect). */
export type NodeRect = Rect;

// Exporter-specific spacing: text/image insets inside a node box, and the viewBox margin.
const PAD = 12;
const ROOT_PAD = 18;
/** Padding around the map bounds in the export viewBox; shared with the on-canvas background-image
 *  layer (BackgroundImage.tsx) so the screen and the export cover the same region — canvas == export. */
export const EXPORT_MARGIN = 40;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A task-completion pie as an SVG string (mirrors the on-canvas ProgressPie via piePath). */
function pieSvg(cx: number, cy: number, r: number, fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  const fill = f >= 1 ? "#27852f" : "#3b8bd4";
  const base = `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="#fff" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>`;
  if (f >= 1) {
    const tick = `<path d="${checkPath(cx, cy, r)}" fill="none" stroke="#fff" stroke-width="${r2(Math.max(1.2, r * 0.3))}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `${base}<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${fill}"/>${tick}`;
  }
  if (f <= 0) return base;
  return `${base}<path d="${piePath(cx, cy, r, f)}" fill="${fill}"/>`;
}

function boxOf(rect: NodeRect): Box {
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, w: rect.w, h: rect.h };
}

/** Parse a CSS border shorthand ("2px solid #e23") into width + colour. */
function parseBorder(border: string | undefined): { width: number; color: string } | null {
  if (!border) return null;
  const width = Number.parseFloat(border) || 2;
  const color = matchBorderColor(border);
  return color ? { width, color } : null;
}

/** A multi-line <text> centred vertically between top..bottom; left-aligned at x, or centred on x
 *  when `anchor` is "middle" (used for the root topic, whose label is horizontally centred). */
function textBlock(
  lines: string[],
  x: number,
  top: number,
  bottom: number,
  fontSize: number,
  color: string,
  weight?: string,
  fontFamily?: string,
  anchor: "start" | "middle" = "start",
  dimPrefix?: string,
): string {
  if (lines.length === 0) return "";
  const lineHeight = fontSize * 1.2;
  const centre = (top + bottom) / 2 + fontSize * 0.34;
  const firstBaseline = centre - ((lines.length - 1) * lineHeight) / 2;
  const w =
    weight && weight !== "400" && weight !== "normal" ? ` font-weight="${esc(weight)}"` : "";
  const anchorAttr = anchor === "middle" ? ` text-anchor="middle"` : "";
  const attrs = `x="${r2(x)}"${anchorAttr} font-family="${esc(fontFamily || "sans-serif")}" font-size="${fontSize}" fill="${esc(color)}"${w}`;
  // A leading outline number is de-emphasised (matches the canvas span at opacity 0.55).
  const lead = dimPrefix ? `<tspan opacity="0.55">${esc(dimPrefix)} </tspan>` : "";
  if (lines.length === 1) {
    return `<text ${attrs} y="${r2(firstBaseline)}">${lead}${esc(lines[0])}</text>`;
  }
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${r2(x)}"${i > 0 ? ` dy="${r2(lineHeight)}"` : ""}>${i === 0 ? lead : ""}${esc(line)}</tspan>`,
    )
    .join("");
  return `<text ${attrs} y="${r2(firstBaseline)}">${tspans}</text>`;
}

interface CalloutBox {
  ax: number; // node anchor (right-centre)
  ay: number;
  x: number; // bubble rect
  y: number;
  w: number;
  h: number;
  text: string;
  /** Wrapped text lines (the canvas bubble wraps at max-width 180; the export mirrors it). */
  lines: string[];
  /** Per-callout colour override (resolved at emit time so canvas == export). */
  color?: string;
}

/** Walk the model for callouts and resolve each to a bubble box anchored to its node's rect. */
function collectCallouts(doc: MindMapDoc, rects: Map<string, NodeRect>): CalloutBox[] {
  const out: CalloutBox[] = [];
  const walk = (n: MapNode): void => {
    const r = rects.get(n.id);
    if (r) {
      for (const c of n.callouts ?? []) {
        const text = c.text || "…";
        // Wrap like the canvas bubble (max-width 180, padding 8, font 12) and grow the bubble height
        // to the wrapped line count — so a multi-line callout isn't clipped to one strip in the export.
        const lines = wrapText(text, 164, 12);
        const longest = Math.max(1, ...lines.map((l) => widthUnits(l)));
        out.push({
          ax: r.x + r.w,
          ay: r.y + r.h / 2,
          x: r.x + r.w + c.dx,
          y: r.y + r.h / 2 + c.dy,
          w: Math.max(36, Math.min(180, longest * 6.6 + 16)),
          h: lines.length * 16 + 8,
          text,
          lines,
          color: c.color,
        });
      }
    }
    for (const child of n.children) walk(child);
  };
  walk(doc.root);
  for (const f of doc.floatingTopics ?? []) walk(f);
  return out;
}

/** SVG for every boundary enclosure (shape path + soft gradient + title-tab), sized to its members'
 *  rects — the same geometry + resolver the canvas overlay uses (canvas == export). */
function emitBoundaries(doc: MindMapDoc, rects: Map<string, NodeRect>): string[] {
  const out: string[] = [];
  for (const b of doc.boundaries ?? []) {
    let bx = Number.POSITIVE_INFINITY;
    let by = Number.POSITIVE_INFINITY;
    let bX = Number.NEGATIVE_INFINITY;
    let bY = Number.NEGATIVE_INFINITY;
    let found = 0;
    for (const id of b.nodeIds) {
      const r = rects.get(id);
      if (!r) continue;
      bx = Math.min(bx, r.x);
      by = Math.min(by, r.y);
      bX = Math.max(bX, r.x + r.w);
      bY = Math.max(bY, r.y + r.h);
      found += 1;
    }
    if (found === 0) continue;
    const x = bx - BOUNDARY_PAD;
    const y = by - BOUNDARY_PAD;
    const w = bX - bx + 2 * BOUNDARY_PAD;
    const h = bY - by + 2 * BOUNDARY_PAD;
    const bs = resolveBoundaryStyle(b.color, doc.meta?.accentColor);
    const gid = `bgrad-${b.id}`;
    const da = dashArray(b.dash);
    const dashAttr = da ? ` stroke-dasharray="${da}"` : "";
    out.push(
      `<defs><linearGradient id="${esc(gid)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${esc(bs.fillTop)}"/><stop offset="1" stop-color="${esc(bs.fillBottom)}"/></linearGradient></defs>`,
      `<path d="${boundaryPath(b.shape, x, y, w, h)}" fill="url(#${esc(gid)})" stroke="${esc(bs.stroke)}" stroke-width="1.5"${dashAttr}/>`,
    );
    const label = boundaryLabel(b.label);
    if (label) {
      out.push(
        `<rect x="${r2(x + 14)}" y="${r2(y - 19)}" width="${r2(widthUnits(label) * 6.6 + 14)}" height="19" rx="6" fill="${esc(bs.stroke)}"/>`,
        `<text x="${r2(x + 20)}" y="${r2(y - 5.5)}" font-family="sans-serif" font-size="11.5" font-weight="600" fill="#ffffff">${esc(label)}</text>`,
      );
    }
  }
  return out;
}

/** SVG for every summary bracket (a "[" / "]" spine + label beside a node subtree), sized to its
 *  members' rects and sided relative to the root — the same resolver the canvas uses (canvas == export). */
function emitSummaries(doc: MindMapDoc, rects: Map<string, NodeRect>): string[] {
  const out: string[] = [];
  const rootRect = rects.get(doc.root.id);
  const rootCenterX = rootRect ? rootRect.x + rootRect.w / 2 : 0;
  for (const s of doc.summaries ?? []) {
    let sx = Number.POSITIVE_INFINITY;
    let sy = Number.POSITIVE_INFINITY;
    let sX = Number.NEGATIVE_INFINITY;
    let sY = Number.NEGATIVE_INFINITY;
    let found = 0;
    for (const id of s.nodeIds) {
      const r = rects.get(id);
      if (!r) continue;
      sx = Math.min(sx, r.x);
      sy = Math.min(sy, r.y);
      sX = Math.max(sX, r.x + r.w);
      sY = Math.max(sY, r.y + r.h);
      found += 1;
    }
    if (found === 0) continue;
    const onLeft = (sx + sX) / 2 < rootCenterX;
    const y0 = sy - SUMMARY_PAD;
    const y1 = sY + SUMMARY_PAD;
    const spineX = onLeft ? sx - SUMMARY_GAP : sX + SUMMARY_GAP;
    const capX = onLeft ? spineX + SUMMARY_BRACKET_W : spineX - SUMMARY_BRACKET_W;
    const ss = resolveSummaryStyle(s.color);
    out.push(
      `<path d="M ${r2(capX)} ${r2(y0)} L ${r2(spineX)} ${r2(y0)} L ${r2(spineX)} ${r2(y1)} L ${r2(capX)} ${r2(y1)}" fill="none" stroke="${esc(ss.stroke)}" stroke-width="2"/>`,
    );
    const label = summaryLabel(s.label);
    const midY = (y0 + y1) / 2;
    const lw = widthUnits(label) * 7 + 12;
    const lx = onLeft ? spineX - 6 - lw : spineX + 6;
    out.push(
      `<rect x="${r2(lx)}" y="${r2(midY - 10)}" width="${r2(lw)}" height="20" rx="8" fill="${esc(ss.labelBg)}" stroke="${esc(ss.labelBorder)}"/>`,
      `<text x="${r2(lx + 6)}" y="${r2(midY + 4)}" font-family="sans-serif" font-size="12" font-weight="600" fill="${esc(ss.labelColor)}">${esc(label)}</text>`,
    );
  }
  return out;
}

/** SVG for the diagram backdrop frame (onion / funnel / Venn), behind everything. */
function emitBackdrop(bd: ReturnType<typeof backdropGeometry>): string[] {
  return bd.shapes.map((s) =>
    s.type === "circle"
      ? `<circle cx="${r2(s.cx ?? 0)}" cy="${r2(s.cy ?? 0)}" r="${r2(s.r ?? 0)}" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="2"/>`
      : `<path d="${s.d ?? ""}" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="2"/>`,
  );
}

/** SVG for the free background shapes + smart containers (items 23 + 22), behind the topics. Shares the
 *  canvasShapes geometry the on-canvas overlay uses, so the export matches the screen (canvas == export). */
function emitShapes(doc: MindMapDoc): string[] {
  const out: string[] = [];
  for (const shape of doc.shapes ?? []) {
    for (const p of canvasShapeGeometry(shape).prims) {
      if (p.t === "rect")
        out.push(
          `<rect x="${r2(p.x)}" y="${r2(p.y)}" width="${r2(p.w)}" height="${r2(p.h)}" rx="${p.rx}" fill="${esc(p.fill)}" stroke="${esc(p.stroke)}" stroke-width="2"/>`,
        );
      else if (p.t === "ellipse")
        out.push(
          `<ellipse cx="${r2(p.cx)}" cy="${r2(p.cy)}" rx="${r2(p.rx)}" ry="${r2(p.ry)}" fill="${esc(p.fill)}" stroke="${esc(p.stroke)}" stroke-width="2"/>`,
        );
      else if (p.t === "path")
        out.push(
          `<path d="${p.d}" fill="${esc(p.fill)}" stroke="${esc(p.stroke)}" stroke-width="2"/>`,
        );
      else if (p.t === "line")
        out.push(
          `<line x1="${r2(p.x1)}" y1="${r2(p.y1)}" x2="${r2(p.x2)}" y2="${r2(p.y2)}" stroke="${esc(p.stroke)}" stroke-width="1.5"/>`,
        );
      else
        out.push(
          `<text x="${r2(p.x)}" y="${r2(p.y)}" font-family="sans-serif" font-size="14" font-weight="600" fill="${esc(p.fill)}" text-anchor="${p.anchor}">${esc(p.s)}</text>`,
        );
    }
  }
  return out;
}

/** SVG for the anchored callout bubbles (dashed connector + sticky-note bubble + wrapped text),
 *  drawn on top — the same per-callout resolver the canvas uses (canvas == export). */
function emitCallouts(callouts: CalloutBox[]): string[] {
  const out: string[] = [];
  for (const c of callouts) {
    const cs = resolveCalloutStyle(c.color);
    const tspans = c.lines
      .map((l, i) => `<tspan x="${r2(c.x + 8)}"${i > 0 ? ` dy="16"` : ""}>${esc(l)}</tspan>`)
      .join("");
    out.push(
      `<line x1="${r2(c.ax)}" y1="${r2(c.ay)}" x2="${r2(c.x)}" y2="${r2(c.y + 10)}" stroke="${esc(cs.connector)}" stroke-width="1.5" stroke-dasharray="3 3"/>`,
      `<rect x="${r2(c.x)}" y="${r2(c.y)}" width="${r2(c.w)}" height="${r2(c.h)}" rx="8" fill="${esc(cs.bg)}" stroke="${esc(cs.stroke)}"/>`,
      `<text x="${r2(c.x + 8)}" y="${r2(c.y + 15)}" font-family="sans-serif" font-size="12" fill="${esc(cs.text)}">${tspans}</text>`,
    );
  }
  return out;
}

export function buildFlowSvg(
  doc: MindMapDoc,
  rects: Map<string, NodeRect>,
  palette: string[],
  cssVar: Record<string, string>,
  numbered = false,
  today = "",
  braces?: BraceGroup[],
  kind: LayoutKind = "side",
): string {
  const { nodes, edges } = project(doc, palette, numbered, kind);
  const callouts = collectCallouts(doc, rects);
  const bd = doc.backdrop ? backdropGeometry(doc.backdrop) : null;
  const nodeBg = cssVar["--bgcolor"] ?? "#ffffff";
  const color = cssVar["--color"] ?? "#2c2c2a";
  const rootBg = cssVar["--root-bgcolor"] ?? "#1b8a5e"; // match TopicNode's var(--mm-root-bg, …) fallback
  const rootColor = cssVar["--root-color"] ?? "#ffffff";
  const pageBg = doc.meta?.background || cssVar["--main-bgcolor"] || "#ffffff";

  // Overall bounds (nodes + boundaries + callouts), padded.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rects.values()) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  for (const c of callouts) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w);
    maxY = Math.max(maxY, c.y + c.h);
  }
  if (bd && bd.shapes.length > 0) {
    minX = Math.min(minX, bd.bbox.x);
    minY = Math.min(minY, bd.bbox.y);
    maxX = Math.max(maxX, bd.bbox.x + bd.bbox.w);
    maxY = Math.max(maxY, bd.bbox.y + bd.bbox.h);
  }
  for (const shape of doc.shapes ?? []) {
    minX = Math.min(minX, shape.pos.x);
    minY = Math.min(minY, shape.pos.y);
    maxX = Math.max(maxX, shape.pos.x + shape.size.w);
    maxY = Math.max(maxY, shape.pos.y + shape.size.h);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }
  const vbX = minX - EXPORT_MARGIN;
  const vbY = minY - EXPORT_MARGIN;
  const vbW = maxX - minX + 2 * EXPORT_MARGIN;
  const vbH = maxY - minY + 2 * EXPORT_MARGIN;

  const parts: string[] = [];

  // Dedicated diagram backdrop (onion / funnel / Venn frame), behind everything else.
  if (bd) parts.push(...emitBackdrop(bd));

  // Free background shapes + smart containers, above the backdrop but behind boundaries + topics.
  parts.push(...emitShapes(doc));

  // Boundaries (behind everything), then summary brackets — extracted emitters; the same geometry +
  // resolvers the canvas overlays use, so the bytes are identical (canvas == export).
  parts.push(...emitBoundaries(doc, rects));
  parts.push(...emitSummaries(doc, rects));

  // Line-jumps: when on, every relationship line is drawn as its chord with semicircular hops cut
  // in at crossings — from the shared helper the canvas edge also uses (canvas == export). Build all
  // relationship chords up front, in the same crosslink order the canvas sees (doc.links order, the
  // order project() emits them), so the deterministic hopper choice matches the screen.
  const lineJumps = Boolean(doc.meta?.lineJumps);
  const hopSegments: HopSegment[] = [];
  if (lineJumps) {
    let order = 0;
    for (const e of edges) {
      if (!e.data?.crosslink) continue;
      const sr = rects.get(e.source);
      const tr = rects.get(e.target);
      if (!sr || !tr) continue;
      const { sx, sy, tx, ty } = floatingPoints(boxOf(sr), boxOf(tr));
      hopSegments.push({
        id: e.id,
        order: order++,
        sx,
        sy,
        tx,
        ty,
        fromId: e.source,
        toId: e.target,
      });
    }
  }

  // Branch attach-side per parent — one shared origin per side so sibling branches fan without
  // crossing. The SAME computation the canvas uses in sync() (canvas == export).
  const axisByParent = computeAxisByParent(
    edges,
    (id) => {
      const r = rects.get(id);
      return r ? boxOf(r) : undefined;
    },
    axisForLayoutKind(kind),
  );
  // All node boxes — obstacle-aware routing bows a branch around any box in its straight path
  // (the SAME computation FlowMindMap.sync() stashes on data.attachBow → canvas == export).
  const allBranchBoxes = [...rects.entries()].map(([id, r]) => ({ id, box: boxOf(r) }));

  // Edges.
  for (const e of edges) {
    const sr = rects.get(e.source);
    const tr = rects.get(e.target);
    if (!sr || !tr) continue;
    const { sx, sy, tx, ty } = floatingPoints(boxOf(sr), boxOf(tr));
    if (e.data?.crosslink) {
      // Resolve colour / width / dash + arrow placement from the SAME helper the canvas edge uses,
      // so a styled relationship exports byte-for-byte identically (canvas == export).
      const {
        color: clColor,
        width: clWidth,
        dasharray,
        arrowAtTarget,
        arrowAtSource,
      } = resolveLinkStyle(e.data, doc.meta?.accentColor);
      // Hopped chord when line-jumps is on; otherwise the gentle S-bezier from the SAME helper the
      // canvas edge uses, so the relationship bows identically on screen and here (canvas == export).
      const self = lineJumps ? hopSegments.find((seg) => seg.id === e.id) : undefined;
      const linePath = self
        ? hopPath(self, hopSegments)
        : crosslinkBezier(sx, sy, tx, ty, e.data?.curve).path;
      const dashAttr = dasharray ? ` stroke-dasharray="${dasharray}"` : "";
      parts.push(
        `<path d="${linePath}" fill="none" stroke="${esc(clColor)}" stroke-width="${clWidth}"${dashAttr}/>`,
      );
      // Directional arrowhead(s) — same builder the canvas uses, at whichever end(s) carry one.
      // Arrowhead scales with the line weight (a thick relationship gets a proportionally larger head).
      const headSize = 6 + clWidth * 2;
      if (arrowAtTarget)
        parts.push(`<path d="${arrowHeadPath(tx, ty, sx, sy, headSize)}" fill="${esc(clColor)}"/>`);
      if (arrowAtSource)
        parts.push(`<path d="${arrowHeadPath(sx, sy, tx, ty, headSize)}" fill="${esc(clColor)}"/>`);
      const label = typeof e.label === "string" ? e.label : "";
      if (label) {
        parts.push(
          `<text x="${r2((sx + tx) / 2)}" y="${r2((sy + ty) / 2 - 4)}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${esc(clColor)}">${esc(label)}</text>`,
        );
      }
    } else if (!braces) {
      // Brace map replaces the tapered ribbons with "{" forks (drawn below), so skip them here.
      const parent = boxOf(sr);
      const child = boxOf(tr);
      const side: AttachSide = attachSideFor(parent, child, axisByParent.get(e.source) ?? "h");
      // Same shared decision + the SAME obstacle bow the canvas computes in sync() → canvas == export.
      // Only the tapered ribbon honours the bow, so skip it for the other styles (as sync does).
      const bow = isTaperBranch(e.data ?? {})
        ? bowToClear(parent, child, side, allBranchBoxes, e.source, e.target)
        : 0;
      // A filled ribbon for the organic taper; a uniform stroke for elbow/curved/straight/dashed.
      const br = branchRender(parent, child, side, e.data ?? {}, bow);
      if (br.fill) {
        parts.push(`<path d="${br.d}" fill="${esc(br.fill)}"/>`);
      } else {
        const dashAttr = br.dash ? ` stroke-dasharray="${br.dash}"` : "";
        parts.push(
          `<path d="${br.d}" fill="none" stroke="${esc(br.stroke ?? "")}" stroke-width="${br.width}" stroke-linejoin="round"${dashAttr}/>`,
        );
      }
    }
  }

  // Brace-map fork connectors (one per parent), from the shared geometry — canvas == export.
  if (braces) {
    for (const b of braces) {
      const parent = rects.get(b.parentId);
      const kids = b.childIds.map((id) => rects.get(id)).filter((rr): rr is NodeRect => !!rr);
      if (!parent || kids.length === 0) continue;
      parts.push(
        `<path d="${bracePath(braceGeometry(parent, kids))}" fill="none" stroke="${BRACE_STROKE}" stroke-width="2"/>`,
      );
    }
  }

  // Each node's SVG, emitted into `parts`: the level-styled box / fill / underline, an image, the
  // marker row, the wrapped title, the task chips + info line, and the collapsed-count glyph. Pulled
  // into one named local (capturing the resolved theme colours computed above) so the main flow below
  // reads as a tight loop. Mirrors the canvas TopicNode (canvas == export).
  const emitNode = (n: TopicNode, r: NodeRect): void => {
    const d = n.data;
    // Conditional-formatting style sits under the node's own style (manual wins) — matches the canvas.
    const st = d.condStyle ? { ...d.condStyle, ...d.style } : d.style;
    const pad = d.isRoot ? ROOT_PAD : PAD;
    // Geometric shapes (diamond/ellipse/…) paint an SVG path — the same builder the canvas
    // uses — so the export matches the screen; the rest stay rounded rects. Insets keep text
    // inside a narrowing outline.
    const shape = d.isRoot ? undefined : st?.shape;
    const geom = isGeometric(shape);
    // Level-based styling — mirrors the canvas TopicNode (canvas == export): depth-1 mains are FILLED
    // with the branch colour; depth-3+ leaves drop the box for a branch-colour underline. Manual style
    // (a set background / border) wins and reverts the node to a normal bordered card.
    const { filledMain, underlineLeaf } = resolveLevelBox({
      isRoot: d.isRoot,
      geom,
      depth: d.depth,
      style: st,
    });
    // Branch-derived fill (tint/gradient); a gradient emits a per-node <linearGradient> def, the
    // canvas paints the same stops via a CSS linear-gradient (canvas == export).
    const tf = d.isRoot
      ? null
      : resolveTopicFill({
          mode: st?.fill,
          background: st?.background,
          branchColor: d.branchColor,
        });
    const gradId = tf?.gradient ? `nfill-${esc(n.id)}` : null;
    if (tf?.gradient && gradId) {
      parts.push(
        `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${esc(tf.gradient.top)}"/><stop offset="1" stop-color="${esc(tf.gradient.bottom)}"/></linearGradient></defs>`,
      );
    }
    const fill = d.isRoot
      ? rootBg
      : tf
        ? gradId
          ? `url(#${gradId})`
          : tf.solid
        : filledMain
          ? d.branchColor
          : underlineLeaf
            ? "none"
            : (st?.background ?? nodeBg);
    // Image fill: a picture covers the whole card (rounded-clipped), with a scrim so the title reads.
    const imageFill =
      !d.isRoot && !isGeometric(shape) && !underlineLeaf ? st?.fillImage : undefined;
    const textColor = d.isRoot
      ? rootColor
      : imageFill
        ? (st?.color ?? "#ffffff")
        : (st?.color ?? tf?.text ?? (filledMain ? readableTextOn(d.branchColor) : color));
    const radius = d.isRoot
      ? 16
      : underlineLeaf
        ? 0
        : Number.parseFloat(st?.borderRadius ?? "11") || 11;
    const border = st?.border
      ? parseBorder(st.border)
      : d.isRoot || filledMain || underlineLeaf
        ? null
        : { width: 1.5, color: d.branchColor };
    const strokeAttr = border
      ? ` stroke="${esc(border.color)}" stroke-width="${border.width}"`
      : "";
    const ins = isGeometric(shape) ? shapeInset(shape) : { left: 0, right: 0, top: 0, bottom: 0 };
    // Raised topic (#4): reference the shared drop-shadow filter on the card fill (canvas == export).
    const shadowAttr = st?.shadow ? ' filter="url(#mm-topic-shadow)"' : "";
    if (isGeometric(shape)) {
      parts.push(
        `<path d="${shapePath(shape, r.x, r.y, r.w, r.h)}" fill="${esc(fill)}"${strokeAttr}${shadowAttr}/>`,
      );
      const ov = shapeOverlayPath(shape, r.x, r.y, r.w, r.h);
      if (ov) parts.push(`<path d="${ov}" fill="none"${strokeAttr}/>`);
    } else if (underlineLeaf) {
      // No box — a short branch-colour underline under the text (matches the canvas border-bottom).
      parts.push(
        `<line x1="${r2(r.x + 2)}" y1="${r2(r.y + r.h - 1)}" x2="${r2(r.x + r.w - 2)}" y2="${r2(r.y + r.h - 1)}" stroke="${esc(d.branchColor)}" stroke-width="2"/>`,
      );
    } else if (imageFill) {
      // Backing card + a rounded-clipped cover image + a dark scrim (matches the canvas textShadow),
      // then the border on top so it isn't hidden by the picture.
      const clip = `nclip-${esc(n.id)}`;
      const rect = `x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.w)}" height="${r2(r.h)}" rx="${radius}"`;
      parts.push(
        `<defs><clipPath id="${clip}"><rect ${rect}/></clipPath></defs>`,
        `<rect ${rect} fill="${esc(nodeBg)}"${shadowAttr}/>`,
        `<image x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.w)}" height="${r2(r.h)}" href="${esc(imageFill)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`,
        `<rect ${rect} fill="rgba(0,0,0,0.32)" clip-path="url(#${clip})"/>`,
        `<rect ${rect} fill="none"${strokeAttr || ` stroke="${esc(d.branchColor)}" stroke-width="1.5"`}/>`,
      );
    } else {
      parts.push(
        `<rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.w)}" height="${r2(r.h)}" rx="${radius}" fill="${esc(fill)}"${strokeAttr}${shadowAttr}/>`,
      );
    }

    let textTop = r.y + ins.top;
    if (d.image) {
      // Clamp to the same caps the canvas uses (max 200×140, and never wider than the box) so the
      // image renders at the same size on screen and in the export (canvas == export).
      const iw = Math.min(d.image.width ?? 120, 200, r.w - 2 * pad);
      const ih = Math.min(d.image.height ?? 120, 140);
      parts.push(
        `<image x="${r2(r.x + pad)}" y="${r2(r.y + pad)}" width="${r2(iw)}" height="${r2(ih)}" href="${esc(d.image.url)}" preserveAspectRatio="xMidYMid meet"/>`,
      );
      textTop = r.y + pad + ih;
    }

    // Markers as fixed-size tiles in a centred row above the title (matches the canvas marker row →
    // canvas == export): vector markers draw as <image>, an emoji / unknown marker draws as its glyph
    // in the SAME row (it used to fall into the title text — a placement + sizing mismatch).
    const markers = d.icons ?? [];
    if (markers.length) {
      const stride = 16;
      const rowW = markers.length * stride - 2;
      let mx = r.x + r.w / 2 - rowW / 2;
      for (const ic of markers) {
        const url = markerImage(ic);
        if (url) {
          parts.push(
            `<image x="${r2(mx)}" y="${r2(textTop)}" width="14" height="14" href="${esc(url)}"/>`,
          );
        } else {
          parts.push(
            `<text x="${r2(mx + 7)}" y="${r2(textTop + 12)}" font-family="sans-serif" font-size="13" text-anchor="middle">${esc(ic)}</text>`,
          );
        }
        mx += stride;
      }
      textTop += 18;
    }

    // The priority/progress/due chips sit in a reserved strip at the bottom; the inline task-info line
    // (start ▸ duration ▸ resources) sits just above them. Both reserved so the title doesn't overlap.
    const taskInfo = taskInfoLine({
      start: d.start,
      durationDays: d.durationDays,
      resources: d.resources,
    });
    const chipRow = d.progress || d.due || d.priority || d.attachmentCount ? 20 : 0;
    const pieReserve = chipRow + (taskInfo ? 15 : 0);

    const fontSize =
      Number.parseFloat(st?.fontSize ?? "") || levelFontSize(d.depth) * (d.fontScale ?? 1);
    // Wrap to the box's content width — the SAME wrap the canvas gets from CSS max-width — so a long
    // label stays inside its box in the export instead of overflowing (canvas == export).
    // Underline leaves use a tighter 8px horizontal padding on the canvas (vs PAD=12); match it so the
    // wrap width is the same and a leaf label doesn't break a line earlier in the export.
    const hpad = underlineLeaf ? 8 : pad;
    const contentW = Math.max(16, r.w - 2 * hpad - ins.left - ins.right);
    const lines = wrapText(d.topic, contentW, fontSize);
    // The outline number prefixes the title, drawn de-emphasised via textBlock (markers — incl. emoji
    // — now all draw in the marker row above, so they no longer prefix the title text).
    const numberPrefix = d.number ? String(d.number) : "";
    const nonEmpty = lines.filter((l) => l.length > 0);
    // Note / hyperlink indicators inline after the title (mirrors the canvas), so the export keeps the
    // "has a note / link" cue it used to drop.
    const ind = `${d.hyperlink ? " 🔗" : ""}${d.note?.trim() ? " 📝" : ""}`;
    if (ind) {
      if (nonEmpty.length > 0) nonEmpty[nonEmpty.length - 1] += ind;
      else nonEmpty.push(ind.trim());
    }
    if (nonEmpty.length > 0) {
      parts.push(
        textBlock(
          nonEmpty,
          r.x + r.w / 2,
          textTop,
          r.y + r.h - pieReserve - ins.bottom,
          fontSize,
          textColor,
          d.isRoot ? "700" : (st?.fontWeight ?? (filledMain ? "600" : undefined)),
          st?.fontFamily ?? d.fontFamily,
          "middle",
          numberPrefix,
        ),
      );
    }
    let badgeX = r.x + pad + ins.left;
    if (d.priority) {
      const label = priorityLabel(d.priority);
      const w = widthUnits(label) * 6.4 + 8;
      parts.push(
        `<rect x="${r2(badgeX)}" y="${r2(r.y + r.h - 20)}" width="${r2(w)}" height="16" rx="5" fill="${priorityColor(d.priority)}"/>`,
        `<text x="${r2(badgeX + 4)}" y="${r2(r.y + r.h - 8)}" font-family="sans-serif" font-size="10.5" font-weight="600" fill="#ffffff">${esc(label)}</text>`,
      );
      badgeX += w + 4;
    }
    if (d.progress) {
      parts.push(pieSvg(badgeX + 8, r.y + r.h - 12, 8, d.progress.progress));
      badgeX += 22;
    }
    if (d.due) {
      const over = isOverdue(d.due, d.progress?.progress ?? 0, today);
      const label = `📅 ${formatDateShort(d.due)}`; // match the canvas DateChip (Badge.tsx) — keep the glyph
      const chipW = widthUnits(label) * 6.2 + 10;
      const chipY = r.y + r.h - 20;
      parts.push(
        `<rect x="${r2(badgeX)}" y="${r2(chipY)}" width="${r2(chipW)}" height="16" rx="5" fill="${over ? "#fde2e2" : "rgba(0,0,0,0.06)"}"/>`,
        `<text x="${r2(badgeX + 5)}" y="${r2(chipY + 12)}" font-family="sans-serif" font-size="10.5" fill="${over ? "#b42318" : esc(textColor)}">${esc(label)}</text>`,
      );
      badgeX += chipW + 4;
    }
    if (d.attachmentCount) {
      // Attachment count chip — drawn in the export too (the canvas had it; the export dropped it).
      const label = `📎 ${d.attachmentCount}`;
      const chipW = widthUnits(label) * 6.6 + 8;
      const chipY = r.y + r.h - 20;
      parts.push(
        `<rect x="${r2(badgeX)}" y="${r2(chipY)}" width="${r2(chipW)}" height="16" rx="5" fill="rgba(0,0,0,0.06)"/>`,
        `<text x="${r2(badgeX + 5)}" y="${r2(chipY + 12)}" font-family="sans-serif" font-size="10.5" fill="${esc(textColor)}">${esc(label)}</text>`,
      );
      badgeX += chipW + 4;
    }
    // Inline task-info line (start ▸ duration ▸ resources), just above the chip strip — mirrors the
    // canvas TopicNode line (canvas == export).
    if (taskInfo) {
      parts.push(
        `<text x="${r2(r.x + r.w / 2)}" y="${r2(r.y + r.h - chipRow - 5)}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${esc(textColor)}" opacity="0.65">${esc(taskInfo)}</text>`,
      );
    }
    // Collapsed-branch indicator: a small circle showing the hidden-subtopic count at the box's
    // bottom-right corner — matches the canvas affordance, so an export shows that content is folded
    // away (a collapsed branch no longer looks like a leaf).
    if (d.collapsed && d.hasChildren) {
      const cx = r.x + r.w;
      const cy = r.y + r.h;
      const label = d.hiddenCount ? String(d.hiddenCount) : "+";
      parts.push(
        `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="9" fill="${esc(nodeBg)}" stroke="${esc(d.branchColor)}" stroke-width="1"/>`,
        `<text x="${r2(cx)}" y="${r2(cy + 3.5)}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${esc(d.branchColor)}">${esc(label)}</text>`,
      );
    }
  };
  for (const n of nodes) {
    const r = rects.get(n.id);
    if (r) emitNode(n, r);
  }

  // Callouts (anchored bubbles, drawn on top) — extracted emitter (canvas == export).
  parts.push(...emitCallouts(callouts));

  // Per-map background image (a data: URL): an <image> covering the whole viewBox, on top of the
  // page-background rect but beneath every node/edge/boundary — mirrors the on-canvas layer so
  // png/svg/html/pdf all carry it. preserveAspectRatio "slice" = CSS object-fit:cover (canvas == export).
  const bgImage = doc.meta?.backgroundImage
    ? `<image x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" href="${esc(doc.meta.backgroundImage)}" preserveAspectRatio="xMidYMid slice"/>`
    : "";

  // Map legend (top-left), drawn on top of everything when meta.legend is on — the same rows the
  // on-canvas LegendPanel shows (shared buildLegend), so the legend reads the same on screen + export.
  const legend = doc.meta?.legend ? emitLegend(doc, vbX, vbY) : "";

  // Inject the drop-shadow filter def once, only when a topic actually uses it (#4) — keeps the export
  // byte-stable + minimal for maps with no raised topics.
  const shadowDef = parts.some((p) => p.includes("url(#mm-topic-shadow)"))
    ? TOPIC_SHADOW_SVG_DEF
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}" width="${r2(vbW)}" height="${r2(vbH)}"><rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${esc(pageBg)}"/>${shadowDef}${bgImage}${parts.join("")}${legend}</svg>`;
}

/** SVG for the map legend box anchored at the viewBox's top-left — one row per marker / tag / rule
 *  (the shared buildLegend rows). Markers draw their vector tile; tags/rules a coloured swatch. */
function emitLegend(doc: MindMapDoc, vbX: number, vbY: number): string {
  const entries = buildLegend(doc);
  if (entries.length === 0) return "";
  const x = vbX + 12;
  const y = vbY + 12;
  const rowH = 17;
  const longest = Math.max(6, ...entries.map((e) => e.label.length));
  const w = Math.min(240, 28 + longest * 6.2);
  const h = 22 + entries.length * rowH;
  const out: string[] = [
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="6" fill="#ffffff" stroke="rgba(0,0,0,0.18)" stroke-width="1"/>`,
    `<text x="${r2(x + 9)}" y="${r2(y + 15)}" font-family="sans-serif" font-size="11" font-weight="600" fill="#6b6b6b">${esc(t("toolbar.legend"))}</text>`,
  ];
  entries.forEach((e, i) => {
    const ry = y + 24 + i * rowH;
    const img = e.icon ? markerImage(e.icon) : null;
    if (e.kind === "marker" && img) {
      out.push(`<image x="${r2(x + 9)}" y="${r2(ry)}" width="12" height="12" href="${esc(img)}"/>`);
    } else if (e.kind === "marker" && e.icon) {
      out.push(
        `<text x="${r2(x + 9)}" y="${r2(ry + 10)}" font-family="sans-serif" font-size="11">${esc(e.icon)}</text>`,
      );
    } else {
      const fill = e.color ?? "#1b8a5e";
      const rx = e.kind === "tag" ? 5 : 2;
      out.push(
        `<rect x="${r2(x + 9)}" y="${r2(ry)}" width="11" height="11" rx="${rx}" fill="${esc(fill)}"/>`,
      );
    }
    out.push(
      `<text x="${r2(x + 25)}" y="${r2(ry + 10)}" font-family="sans-serif" font-size="11" fill="#23211c">${esc(e.label)}</text>`,
    );
  });
  return out.join("");
}
