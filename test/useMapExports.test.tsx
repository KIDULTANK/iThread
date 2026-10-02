// @vitest-environment jsdom
//
// useMapExports is the download hub for all 16 export formats. The pure formatters it calls
// (serializeDoc/toMarkdown/toMermaid/…) are asserted directly in useMapExports-integration.test.ts;
// THIS file covers the hook's own orchestration — the part in-browser clicking can't verify and
// where the silent bugs live: filename derivation (title vs the "mindmap" fallback), the per-format
// MIME type + extension, the cleanSvg() null-guard (no live map → no-op, not a broken file), and the
// PNG raster + PDF iframe seams. We mock the two browser bits jsdom lacks (URL.createObjectURL +
// anchor.click for downloads; Image.decode + canvas.toBlob for the PNG raster) and read back what
// would have been written.
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MindMapHandle } from "../src/mindmap";
import type { MindMapDoc } from "../src/model/types";
import { useMapExports } from "../src/useMapExports";

const docOf = (title: string): MindMapDoc => ({
  schemaVersion: 1,
  id: "doc-1",
  title,
  root: {
    id: "r",
    topic: title || "Root",
    children: [
      { id: "a", topic: "Alpha", children: [] },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
});

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>hi</text></svg>';

// A MindMapHandle whose exportSvg returns a Blob of the given svg string (or null for "no live map").
const handleRef = (svg: string | null): RefObject<MindMapHandle | null> => ({
  current: {
    exportSvg: () => (svg == null ? null : new Blob([svg], { type: "image/svg+xml" })),
  } as MindMapHandle,
});

// Captured downloads: every download() call pushes the anchor's filename + the blob handed to
// URL.createObjectURL just before the click.
let downloads: { name: string; blob: Blob }[];
let lastBlob: Blob;

beforeEach(() => {
  downloads = [];
  // Export tests exercise the imperative hook without mounting DialogHost; accept its native
  // compatibility confirmation unless a test overrides this spy.
  vi.spyOn(window, "confirm").mockReturnValue(true);
  // jsdom implements neither URL.createObjectURL nor anchor downloads — assign stubs directly
  // (vi.spyOn can't wrap a method that doesn't exist) and capture what would have been written.
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
    lastBlob = b as Blob;
    return "blob:mock";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, blob: lastBlob });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMapExports — filenames + MIME types", () => {
  // Each model-backed format: the call, the expected filename, and the expected blob MIME type.
  const cases: [keyof ReturnType<typeof useMapExports>, string, string][] = [
    ["exportJson", "Demo Map.json", "application/json"],
    ["exportMarkdown", "Demo Map.md", "text/markdown"],
    ["exportMermaid", "Demo Map.mmd", "text/vnd.mermaid"],
    ["exportOpml", "Demo Map.opml", "text/x-opml"],
    ["exportFreemind", "Demo Map.mm", "application/x-freemind"],
    ["exportXmind", "Demo Map.xmind", "application/vnd.xmind.workbook"],
    ["exportSmmx", "Demo Map.smmx", "application/octet-stream"],
    ["exportIthoughts", "Demo Map.itmz", "application/octet-stream"],
    ["exportInteractiveHtml", "Demo Map-interactive.html", "text/html"],
    ["exportDeck", "Demo Map-slides.html", "text/html"],
    [
      "exportDocx",
      "Demo Map.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "exportPptx",
      "Demo Map.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    [
      "exportXlsx",
      "Demo Map.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  ];

  for (const [method, filename, mime] of cases) {
    it(`${method} → ${filename} (${mime})`, async () => {
      const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
      await ex[method]();
      expect(downloads).toHaveLength(1);
      expect(downloads[0].name).toBe(filename);
      expect(downloads[0].blob.type).toBe(mime);
    });
  }

  it("falls back to 'mindmap' when the doc has no title", async () => {
    const ex = useMapExports(handleRef(SVG), () => docOf(""));
    ex.exportJson();
    expect(downloads[0].name).toBe("mindmap.json");
  });

  it("re-reads the doc on every call (getDoc is not cached)", async () => {
    let title = "First";
    const ex = useMapExports(handleRef(SVG), () => docOf(title));
    ex.exportJson();
    title = "Second";
    ex.exportJson();
    expect(downloads.map((d) => d.name)).toEqual(["First.json", "Second.json"]);
  });

  it("exportJson writes a parseable document", async () => {
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    ex.exportJson();
    const parsed = JSON.parse(await downloads[0].blob.text());
    expect(parsed.title).toBe("Demo Map");
    expect(parsed.root.children).toHaveLength(2);
  });

  it("exportIthoughts preserves rich topic formatting as iThread inline Markdown", async () => {
    const doc = docOf("Demo Map");
    doc.root.topic = "Bold Highlight Under";
    doc.root.topicRich = "<strong>Bold</strong> <mark>Highlight</mark> <u>Under</u>";
    const ex = useMapExports(handleRef(SVG), () => doc);
    await ex.exportIthoughts();
    const { fromIthoughts } = await import("../src/io/ithoughts");
    const back = fromIthoughts(new Uint8Array(await downloads[0].blob.arrayBuffer()));
    expect(back.root.topic).toBe("**Bold** ==Highlight== __Under__");
  });

  it("exportIthoughts does not write a file when the compatibility report is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportIthoughts();
    expect(downloads).toHaveLength(0);
  });
});

describe("useMapExports — SVG-backed formats", () => {
  it("exportSvg downloads sanitized SVG with image/svg+xml type", async () => {
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportSvg();
    expect(downloads[0].name).toBe("Demo Map.svg");
    expect(downloads[0].blob.type).toBe("image/svg+xml");
    expect(await downloads[0].blob.text()).toContain("<text>hi</text>");
  });

  it("exportHtml wraps the SVG in an HTML document", async () => {
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportHtml();
    expect(downloads[0].name).toBe("Demo Map.html");
    expect(downloads[0].blob.type).toBe("text/html");
    expect(await downloads[0].blob.text()).toContain("<svg");
  });

  // cleanSvg() returns null when there is no live map — the SVG-backed exporters must no-op rather
  // than write an empty/broken file. This is the guard that in-browser testing skips.
  it.each(["exportSvg", "exportHtml", "exportPng", "exportPdf"] as const)(
    "%s is a no-op when there is no live map",
    async (method) => {
      const ex = useMapExports(handleRef(null), () => docOf("Demo Map"));
      await ex[method]();
      expect(downloads).toHaveLength(0);
    },
  );

  it("is also a no-op when the map ref itself is null", async () => {
    const ex = useMapExports({ current: null }, () => docOf("Demo Map"));
    await ex.exportSvg();
    expect(downloads).toHaveLength(0);
  });

  // Beyond no-op'ing, the renderer-backed exports now hint the user instead of failing silently.
  it.each(["exportSvg", "exportHtml", "exportPng", "exportPdf"] as const)(
    "%s hints the user when there is no live map",
    async (method) => {
      const onHint = vi.fn();
      const ex = useMapExports(handleRef(null), () => docOf("Demo Map"), undefined, onHint);
      await ex[method]();
      expect(downloads).toHaveLength(0);
      expect(onHint).toHaveBeenCalledTimes(1);
      expect(onHint.mock.calls[0][0]).toMatch(/canvas/i);
    },
  );
});

describe("useMapExports — PNG raster seam", () => {
  // svgToPng rasterises via an offscreen <img> + canvas; jsdom implements neither decode() nor
  // toBlob, so stub both. The point is to exercise the hook's branching (decode → draw → toBlob →
  // download), not the pixels.
  beforeEach(() => {
    class FakeImage {
      naturalWidth = 10;
      naturalHeight = 10;
      src = "";
      decode() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: () => {},
      drawImage: () => {},
      setTransform: () => {},
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exportPng rasterises and downloads a PNG", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => {
      cb(new Blob(["PNG"], { type: "image/png" }));
    });
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportPng();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toBe("Demo Map.png");
    expect(downloads[0].blob.type).toBe("image/png");
  });

  it("tags the filename with the scale + transparency options (item 6)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => {
      cb(new Blob(["PNG"], { type: "image/png" }));
    });
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportPng({ scale: 2 });
    expect(downloads.at(-1)?.name).toBe("Demo Map@2x.png");
    await ex.exportPng({ transparent: true });
    expect(downloads.at(-1)?.name).toBe("Demo Map-transparent.png");
    await ex.exportPng({ scale: 4, transparent: true });
    expect(downloads.at(-1)?.name).toBe("Demo Map@4x-transparent.png");
  });

  it("exportPng skips the download when rasterisation yields no blob", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => {
      cb(null);
    });
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportPng();
    expect(downloads).toHaveLength(0);
  });

  it("exportPng skips the download when the canvas has no 2D context", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportPng();
    expect(downloads).toHaveLength(0);
  });
});

describe("useMapExports — PPTX live-map slides (item 1)", () => {
  // exportPptx renders each deck slide's branch to SVG (via the map ref) then rasterises to PNG for the
  // embed — the same SVG→PNG seam as exportPng, so stub the browser bits jsdom lacks.
  beforeEach(() => {
    class FakeImage {
      naturalWidth = 20;
      naturalHeight = 12;
      src = "";
      decode() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: () => {},
      drawImage: () => {},
      setTransform: () => {},
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => {
      cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("embeds a branch-map PNG per slide when a live canvas is present", async () => {
    const { unzipSync } = await import("fflate");
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportPptx();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toBe("Demo Map.pptx");
    const zip = unzipSync(new Uint8Array(await downloads[0].blob.arrayBuffer()));
    // overview + Alpha + Beta each rendered → three embedded media parts.
    const media = Object.keys(zip).filter((n) => /^ppt\/media\/image\d+\.png$/.test(n));
    expect(media.length).toBe(3);
  });

  it("still exports a (bullet) PPTX when there is no live canvas", async () => {
    const ex = useMapExports(handleRef(null), () => docOf("Demo Map"));
    await ex.exportPptx();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toBe("Demo Map.pptx");
    const { unzipSync } = await import("fflate");
    const zip = unzipSync(new Uint8Array(await downloads[0].blob.arrayBuffer()));
    expect(Object.keys(zip).some((n) => n.startsWith("ppt/media/"))).toBe(false);
  });
});

describe("useMapExports — PDF print path", () => {
  it("appends a hidden print iframe with the rendered SVG instead of downloading", async () => {
    const append = vi.spyOn(document.body, "appendChild");
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"));
    await ex.exportPdf();
    expect(downloads).toHaveLength(0);
    const iframe = append.mock.calls[0][0] as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.srcdoc).toContain("<svg");
  });
});

describe("useMapExports — copy image to clipboard", () => {
  // Same SVG→PNG raster seam as exportPng, but the blob lands on the clipboard (no download). Stub the
  // raster bits jsdom lacks + a ClipboardItem/navigator.clipboard.write the hook can call.
  beforeEach(() => {
    class FakeImage {
      naturalWidth = 10;
      naturalHeight = 10;
      src = "";
      decode() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: () => {},
      drawImage: () => {},
      setTransform: () => {},
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => {
      cb(new Blob(["PNG"], { type: "image/png" }));
    });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        items: Record<string, Blob>;
        constructor(items: Record<string, Blob>) {
          this.items = items;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // navigator.clipboard is a read-only accessor in jsdom — reset it via defineProperty, not assignment.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  const withClipboard = (write: ReturnType<typeof vi.fn>) =>
    Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });

  it("rasters the map and writes a PNG ClipboardItem (no download), then hints success", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    withClipboard(write);
    const onHint = vi.fn();
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"), undefined, onHint);
    await ex.copyPng();
    expect(downloads).toHaveLength(0); // clipboard, not a file
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0][0][0] as { items: Record<string, Blob> };
    expect(item.items["image/png"]).toBeInstanceOf(Blob);
    expect(onHint).toHaveBeenCalledWith(expect.stringMatching(/clipboard/i));
  });

  it("hints (and never throws) when the clipboard write is blocked", async () => {
    withClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const onHint = vi.fn();
    const ex = useMapExports(handleRef(SVG), () => docOf("Demo Map"), undefined, onHint);
    await ex.copyPng();
    expect(onHint).toHaveBeenCalledWith(expect.stringMatching(/couldn.t copy/i));
  });

  it("hints to open a map when there is no live canvas (no clipboard write)", async () => {
    const write = vi.fn();
    withClipboard(write);
    const onHint = vi.fn();
    const ex = useMapExports(handleRef(null), () => docOf("Demo Map"), undefined, onHint);
    await ex.copyPng();
    expect(write).not.toHaveBeenCalled();
    expect(onHint).toHaveBeenCalledWith(expect.stringMatching(/canvas/i));
  });
});
