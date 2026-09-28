import type { RefObject } from "react";
import { t } from "./i18n";
import { downloadBlob } from "./io/download";
import { buildPrintDoc, wrapSvgHtml } from "./io/html";
import { serializeDoc } from "./io/json";
import { toMarkdown } from "./io/markdown";
import { toMermaid } from "./io/mermaid";
import { buildNotesAppendix } from "./io/notesAppendix";
import type { BranchImage } from "./io/pptx";
import { sanitizeSvg } from "./io/svgSanitize";
import type { MindMapHandle } from "./mindmap";
import type { MindMapDoc } from "./model/types";
import { outlineNumbers } from "./outline";
import { resolveSlides, slideKey } from "./present/slides";

/** PNG raster options (item 6): a resolution multiplier and whether to keep a transparent background. */
export interface PngOptions {
  /** Pixel-density multiplier: 1 (default), 2, 4 — for sharp print / retina / slide use. */
  scale?: number;
  /** Skip the white background fill so the PNG has transparency (paste onto any colour). */
  transparent?: boolean;
}

// Rasterise an SVG string to a PNG via an offscreen canvas. Safe because the exporter emits
// native <text> (no foreignObject) — a foreignObject SVG would taint the canvas, which is
// exactly why an HTML-in-SVG export path produces a blank/broken image. `scale` multiplies the
// output resolution; `transparent` skips the white fill (a transparent PNG).
async function svgToPng(svg: string, opts: PngOptions = {}): Promise<Blob | null> {
  const scale = Math.max(1, Math.min(8, opts.scale ?? 1));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (!opts.transparent) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Scale the drawing so the vector re-rasterises crisply at the higher resolution (not upscaled).
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode a PNG blob's pixel dimensions (for the PDF page fit). */
async function pngPixelSize(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth || 1, height: img.naturalHeight || 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface MapExports {
  exportJson: () => void;
  exportMarkdown: () => void;
  exportMermaid: () => void;
  exportOpml: () => Promise<void>;
  exportFreemind: () => Promise<void>;
  exportXmind: () => Promise<void>;
  exportSmmx: () => Promise<void>;
  exportMmap: () => Promise<void>;
  exportIthoughts: () => Promise<void>;
  exportPng: (opts?: PngOptions) => Promise<void>;
  /** Copy the rendered map to the system clipboard as a PNG image (no file download). */
  copyPng: (opts?: PngOptions) => Promise<void>;
  exportSvg: () => Promise<void>;
  exportHtml: () => Promise<void>;
  exportInteractiveHtml: () => Promise<void>;
  exportDeck: () => Promise<void>;
  /** Print-to-PDF via the browser dialog (the historical path). */
  exportPdf: () => Promise<void>;
  /** Direct PDF file download (item 7): the map rendered + embedded, with page size / orientation. */
  exportPdfFile: (opts?: import("./io/pdf").MapPdfOptions) => Promise<void>;
  exportDocx: () => Promise<void>;
  exportPptx: () => Promise<void>;
  exportXlsx: () => Promise<void>;
}

// Download handlers for every export format, kept out of App so the component
// isn't dominated by I/O plumbing. Renderer-backed formats (png/svg/html/pdf) go
// through the MindMap ref; model-backed ones (json/md) read the current doc.
export function useMapExports(
  mapRef: RefObject<MindMapHandle | null>,
  getDoc: () => MindMapDoc,
  /** When true, the Markdown export bakes in outline numbers (mirrors the on-screen numbering). */
  numbered?: () => boolean,
  /** Surface a one-line hint (toast) — used when an image/PDF export has no live canvas to render. */
  onHint?: (msg: string) => void,
  /** "Export this branch" scope (B4): a node id to render the renderer-backed formats (png/svg/html/
   *  pdf) scoped to that subtree. Model-backed formats scope via a subtree `getDoc`; this only wires the
   *  live-canvas SVG render. Returns null/undefined for the whole map. */
  scopeId?: () => string | null | undefined,
): MapExports {
  const baseName = () => getDoc().title || "mindmap";
  // The renderer-backed formats (png/svg/html/pdf) need a live canvas; when there isn't one (e.g. the
  // command runs while the Board overlay is open, or before the canvas mounts) the SVG is null and the
  // export used to no-op silently. Tell the user instead of doing nothing.
  const noCanvas = () => onHint?.(t("app.openAMapOnThe"));

  // The rendered map as a clean, portable SVG string. The exporter (flow/exportSvg.ts) authors
  // native <text> from the model, so this only needs sanitizeSvg (strip XSS) for the file to
  // render everywhere — opened as a .svg, rasterized to PNG, in a PDF viewer, or placed in
  // Office — not only inline in a browser. null when there is no live map. Shared by png/svg/html/pdf.
  const cleanSvg = async (): Promise<string | null> => {
    const svg = mapRef.current?.exportSvg(scopeId?.() ?? undefined);
    return svg ? sanitizeSvg(await svg.text()) : null;
  };

  // Live-map slides (item 1): render each deck slide's branch to its own clean SVG from the live canvas
  // — the overview slide is the whole map, each branch slide its subtree framed to its bounds — keyed by
  // slideKey so the deck/PPTX builders can match a slide to its image. Returns undefined when there's no
  // live canvas (no map open, or the Board overlay is up), so the exports degrade to the bullet deck.
  const renderDeckSvgs = async (): Promise<Map<string, string> | undefined> => {
    if (!mapRef.current) return undefined;
    const slides = resolveSlides(getDoc());
    const out = new Map<string, string>();
    for (const slide of slides) {
      const raw = mapRef.current.exportSvg(slide.isOverview ? undefined : slide.node.id);
      if (raw) out.set(slideKey(slide), sanitizeSvg(await raw.text()));
    }
    return out.size > 0 ? out : undefined;
  };

  // The same per-slide branch renders rasterised to PNG (+ natural size) for the .pptx embed, which
  // can't inline SVG. 2× for a crisp slide. Undefined when there's no live canvas (⇒ bullet deck).
  const renderDeckImages = async (): Promise<Map<string, BranchImage> | undefined> => {
    const svgs = await renderDeckSvgs();
    if (!svgs) return undefined;
    const out = new Map<string, BranchImage>();
    for (const [key, svg] of svgs) {
      try {
        const png = await svgToPng(svg, { scale: 2 });
        if (!png) continue;
        const { width, height } = await pngPixelSize(png);
        out.set(key, { bytes: new Uint8Array(await png.arrayBuffer()), width, height });
      } catch {
        // A slide that fails to rasterise (an unusual browser image pipeline) falls back to its bullet
        // outline rather than aborting the whole PPTX export.
      }
    }
    return out.size > 0 ? out : undefined;
  };

  return {
    exportJson() {
      downloadBlob(
        new Blob([serializeDoc(getDoc())], { type: "application/json" }),
        `${baseName()}.json`,
      );
    },
    exportMarkdown() {
      const d = getDoc();
      const nums = numbered?.() ? outlineNumbers(d.root, d.meta?.numberStyle) : undefined;
      downloadBlob(new Blob([toMarkdown(d, nums)], { type: "text/markdown" }), `${baseName()}.md`);
    },
    // Mermaid `mindmap` text (mermaid.ts is dependency-free, so static-imported).
    exportMermaid() {
      downloadBlob(
        new Blob([toMermaid(getDoc())], { type: "text/vnd.mermaid" }),
        `${baseName()}.mmd`,
      );
    },
    async exportOpml() {
      // Lazy: opml.ts pulls in fast-xml-parser, kept out of the entry bundle.
      const { toOpml } = await import("./io/opml");
      downloadBlob(new Blob([toOpml(getDoc())], { type: "text/x-opml" }), `${baseName()}.opml`);
    },
    // FreeMind / Freeplane .mm — lazy (freemind.ts pulls fast-xml-parser for its importer).
    async exportFreemind() {
      const { toFreemind } = await import("./io/freemind");
      downloadBlob(
        new Blob([toFreemind(getDoc())], { type: "application/x-freemind" }),
        `${baseName()}.mm`,
      );
    },
    // XMind .xmind — a ZIP (content.json + metadata + manifest); lazy (xmind.ts pulls fflate).
    async exportXmind() {
      const { toXmind } = await import("./io/xmind");
      const bytes = toXmind(getDoc()) as BlobPart;
      downloadBlob(
        new Blob([bytes], { type: "application/vnd.xmind.workbook" }),
        `${baseName()}.xmind`,
      );
    },
    // SimpleMind .smmx — a ZIP (document/mindmap.xml); lazy (smmx.ts pulls fflate + fast-xml-parser).
    async exportSmmx() {
      const { toSmmx } = await import("./io/smmx");
      const bytes = toSmmx(getDoc()) as BlobPart;
      downloadBlob(new Blob([bytes], { type: "application/octet-stream" }), `${baseName()}.smmx`);
    },
    // MindManager .mmap — a ZIP (Document.xml); lazy (mmap.ts pulls fflate). Inverse of the
    // .mmap importer; round-trips topics/notes/links/icons + the two-sided side.
    async exportMmap() {
      const { toMmap } = await import("./io/mmap");
      const bytes = toMmap(getDoc()) as BlobPart;
      downloadBlob(
        new Blob([bytes], { type: "application/vnd.mindjet.mindmanager" }),
        `${baseName()}.mmap`,
      );
    },
    // iThoughts .itmz — a ZIP containing mapdata.xml plus the companion metadata/style files and
    // embedded assets used by the final iThoughts release. This is a compatibility export; normal
    // iThread editing should stay in the native `.ithread` format.
    async exportIthoughts() {
      const { toIthoughts } = await import("./io/ithoughts");
      const bytes = toIthoughts(getDoc()) as BlobPart;
      downloadBlob(new Blob([bytes], { type: "application/octet-stream" }), `${baseName()}.itmz`);
    },
    // png/svg/html/pdf all embed the rendered SVG via cleanSvg() (sanitize + native-text).
    async exportPng(opts) {
      const clean = await cleanSvg();
      if (!clean) {
        noCanvas();
        return;
      }
      const blob = await svgToPng(clean, opts);
      if (blob) {
        const tag = `${opts?.scale && opts.scale > 1 ? `@${opts.scale}x` : ""}${
          opts?.transparent ? "-transparent" : ""
        }`;
        downloadBlob(blob, `${baseName()}${tag}.png`);
      }
    },
    // Copy the rendered map to the clipboard as a PNG — the fastest map→paste path (into chat, email,
    // a slide) with no file round-trip. Same SVG→PNG raster as exportPng; writes via the async Clipboard
    // API, which needs a user gesture + a secure context (https/localhost) and is caught when blocked.
    async copyPng(opts) {
      const clean = await cleanSvg();
      if (!clean) {
        noCanvas();
        return;
      }
      const blob = await svgToPng(clean, opts);
      if (!blob) {
        onHint?.(t("app.couldnTRenderTheMap"));
        return;
      }
      try {
        if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write)
          throw new Error("clipboard image write unsupported");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        onHint?.(t("app.mapCopiedToTheClipboard"));
      } catch {
        onHint?.(t("app.couldnTCopyTheImage"));
      }
    },
    async exportSvg() {
      const clean = await cleanSvg();
      if (!clean) {
        noCanvas();
        return;
      }
      downloadBlob(new Blob([clean], { type: "image/svg+xml" }), `${baseName()}.svg`);
    },
    async exportHtml() {
      const clean = await cleanSvg();
      if (!clean) {
        noCanvas();
        return;
      }
      downloadBlob(
        new Blob([wrapSvgHtml(clean, baseName())], { type: "text/html" }),
        `${baseName()}.html`,
      );
    },
    // Interactive HTML — the whole map as a single self-contained, offline .html
    // file you can email or open locally: a collapsible, searchable outline with
    // an inlined vanilla-JS runtime (no SVG, no backend, no CDN). Model-backed and
    // lazy-loaded so the template + runtime stay out of the entry chunk.
    async exportInteractiveHtml() {
      const { buildInteractiveHtml } = await import("./io/interactiveHtml");
      // Embed the faithful visual map (C1) when a live canvas is present; without one it degrades to the
      // collapsible/searchable text outline (the historical, accessible, no-canvas output).
      const svg = await cleanSvg();
      downloadBlob(
        new Blob([buildInteractiveHtml(getDoc(), svg ?? undefined)], { type: "text/html" }),
        `${baseName()}-interactive.html`,
      );
    },
    // Standalone slide deck — the Walk-Through as a shareable, offline .html file. Each slide shows its
    // branch rendered from the live canvas (item 1, live-map slides); with no live canvas it degrades to
    // the bullet outline. Lazy-loaded to keep the deck template out of the entry chunk.
    async exportDeck() {
      const { buildDeckHtml } = await import("./io/deck");
      const svgs = await renderDeckSvgs();
      downloadBlob(
        new Blob([buildDeckHtml(getDoc(), svgs)], { type: "text/html" }),
        `${baseName()}-slides.html`,
      );
    },
    // Print-to-PDF: render the SVG into a hidden iframe and open the browser print
    // dialog ("Save as PDF"). Dep-free and fully local; an iframe dodges popup blockers.
    async exportPdf() {
      const clean = await cleanSvg();
      if (!clean) {
        noCanvas();
        return;
      }
      const html = buildPrintDoc(clean, baseName(), buildNotesAppendix(getDoc()));
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      iframe.srcdoc = html;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1000);
      };
      document.body.appendChild(iframe);
    },
    // Direct PDF file (item 7): render the map to a high-res PNG, embed it in a real .pdf via pdf-lib,
    // and download it — no browser print dialog. Page size / orientation are chosen by the caller.
    // Lazy-loaded (pdf.ts pulls pdf-lib, already a dep for the book build) so it stays out of the entry.
    async exportPdfFile(opts) {
      const clean = await cleanSvg();
      if (!clean) {
        noCanvas();
        return;
      }
      // Render at 2× for a crisp embed; keep the page-size/orientation for pdf-lib.
      const png = await svgToPng(clean, { scale: 2 });
      if (!png) {
        onHint?.(t("app.couldnTRenderTheMap2"));
        return;
      }
      const { buildMapPdf } = await import("./io/pdf");
      const bytes = new Uint8Array(await png.arrayBuffer());
      const dims = await pngPixelSize(png);
      const pdf = await buildMapPdf(bytes, opts, dims.width, dims.height);
      downloadBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), `${baseName()}.pdf`);
    },
    // Word .docx — the outline as an editable document. Model-backed, lazy-loaded
    // (docx.ts pulls fflate for the OPC zip), kept out of the entry bundle.
    async exportDocx() {
      const { buildDocx } = await import("./io/docx");
      // fflate returns Uint8Array<ArrayBufferLike>; at runtime it's always a
      // plain ArrayBuffer-backed view, so it's a valid BlobPart — the cast just
      // satisfies the stricter lib.dom generic.
      const bytes = buildDocx(getDoc()) as BlobPart;
      downloadBlob(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        `${baseName()}.docx`,
      );
    },
    // PowerPoint .pptx — the Walk-Through as a real slide deck, each slide carrying its branch rendered
    // from the live canvas as an embedded PNG (item 1); without a live canvas it degrades to the bullet
    // outline. Lazy-loaded (pptx.ts pulls fflate for the OPC zip).
    async exportPptx() {
      const { buildPptx } = await import("./io/pptx");
      const images = await renderDeckImages();
      const bytes = buildPptx(getDoc(), images) as BlobPart;
      downloadBlob(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
        `${baseName()}.pptx`,
      );
    },
    // Excel .xlsx — the map as an indented outline worksheet. Model-backed,
    // lazy-loaded (xlsx.ts pulls fflate for the OPC zip).
    async exportXlsx() {
      const { buildXlsx } = await import("./io/xlsx");
      const bytes = buildXlsx(getDoc()) as BlobPart;
      downloadBlob(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${baseName()}.xlsx`,
      );
    },
  };
}
