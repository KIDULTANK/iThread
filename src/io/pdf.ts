import { PDFDocument } from "pdf-lib";

// Direct in-app PDF export of the rendered map (item 7): a real .pdf file, offline, no browser print
// dialog. pdf-lib can't embed SVG, so the caller rasterises the map to a PNG first (the shared
// svgToPng) and this embeds that image on a page with the chosen size/orientation. Lazy-loaded so
// pdf-lib stays out of the entry bundle. Determinism isn't required here (a user-triggered download),
// but pdf-lib is already a dependency (the book build), so this adds no new one.

export type PdfPageSize = "fit" | "a4" | "letter";
export type PdfOrientation = "portrait" | "landscape";

export interface MapPdfOptions {
  /** "fit" sizes the page to the image; "a4"/"letter" use a standard page and fit the image inside. */
  pageSize?: PdfPageSize;
  orientation?: PdfOrientation;
}

// Point dimensions (72pt/in) for the standard page sizes, portrait.
const PAGE_PT: Record<Exclude<PdfPageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
const MARGIN = 36; // 0.5in margin when fitting into a standard page

/** Build a one-page PDF embedding `pngBytes` (a rendered map). `pxW`/`pxH` are the PNG's pixel size,
 *  used to preserve aspect ratio. Returns the PDF file bytes. */
export async function buildMapPdf(
  pngBytes: Uint8Array,
  opts: MapPdfOptions = {},
  pxW = 0,
  pxH = 0,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  // The product NAME, in PDF metadata — a brand, not copy. Stays literal in every locale, the same
  // way the app name does everywhere else.
  pdf.setProducer("iThread");
  const png = await pdf.embedPng(pngBytes);
  const imgW = pxW || png.width;
  const imgH = pxH || png.height;

  if ((opts.pageSize ?? "fit") === "fit") {
    // Page is exactly the image (1px → 1pt), no margin — the sharpest, crop-free output.
    const page = pdf.addPage([imgW, imgH]);
    page.drawImage(png, { x: 0, y: 0, width: imgW, height: imgH });
  } else {
    let [w, h] = PAGE_PT[opts.pageSize as Exclude<PdfPageSize, "fit">];
    if (opts.orientation === "landscape") [w, h] = [h, w];
    const page = pdf.addPage([w, h]);
    // Scale the image to fit inside the margins, preserving aspect ratio, centred.
    const availW = w - 2 * MARGIN;
    const availH = h - 2 * MARGIN;
    const scale = Math.min(availW / imgW, availH / imgH, 1);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    page.drawImage(png, {
      x: (w - drawW) / 2,
      y: (h - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }
  return pdf.save();
}
