import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { parseImport } from "../src/io/importDispatch";
import type { MindMapDoc } from "../src/model/types";

// parseImport routes a file to the right parser by extension. Pure (file in, {doc, warnings} out), so
// the extension matrix is unit-testable. We exercise the text-based formats directly (their real
// parsers) and the injected `.mmap` fallback + warning forwarding via a stub importer.

const file = (name: string, content: string) => new File([content], name);
const nativeDoc = (title: string): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title,
  root: { id: "r", topic: title, children: [] },
});
// The .mmap importer is heavy + binary; inject a stub so the fallback branch is testable without it.
const stubMmap = (doc: MindMapDoc, warnings: string[] = []) =>
  vi.fn(async () => ({ parseMmap: () => ({ doc, warnings }) }) as never);

describe("parseImport — extension routing", () => {
  it("routes Markdown / Markmap (.md, .markdown) to the markdown parser", async () => {
    const { doc, warnings } = await parseImport(
      file("notes.md", "# Plan\n- a\n- b"),
      stubMmap(nativeDoc("x")),
    );
    expect(doc.root.topic).toBe("Plan");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["a", "b"]);
    expect(warnings).toHaveLength(1); // non-native formats carry a lossy-import note
    expect(warnings[0]).toMatch(/Markdown/i);
  });

  it("routes Mermaid (.mmd) to the mermaid parser", async () => {
    const { doc } = await parseImport(
      file("d.mmd", "mindmap\n  root((Root))\n    Child"),
      stubMmap(nativeDoc("x")),
    );
    expect(doc.root.topic).toBe("Root");
  });

  it("routes native .ithread / .json / legacy .mmst losslessly through parseDoc", async () => {
    const native = nativeDoc("Native");
    const json = JSON.stringify(native);
    expect((await parseImport(file("m.json", json), stubMmap(nativeDoc("x")))).doc.title).toBe(
      "Native",
    );
    expect((await parseImport(file("m.mmst", json), stubMmap(nativeDoc("x")))).doc.title).toBe(
      "Native",
    );
    expect((await parseImport(file("m.ithread", json), stubMmap(nativeDoc("x")))).doc.title).toBe(
      "Native",
    );
  });

  it("routes OPML (.opml) to the opml parser (not the .mmap fallback)", async () => {
    const opml =
      '<?xml version="1.0"?><opml version="2.0"><head><title>O</title></head><body><outline text="A"></outline></body></opml>';
    const { doc } = await parseImport(file("o.opml", opml), stubMmap(nativeDoc("x")));
    expect(doc.title).toBe("O"); // parsed by fromOpml (the stub fallback would yield "x")
  });

  it("attaches a lossy-import note for non-native formats but not for native .json/.mmst", async () => {
    const opml =
      '<?xml version="1.0"?><opml version="2.0"><head><title>O</title></head><body><outline text="A"></outline></body></opml>';
    const lossy = await parseImport(file("o.opml", opml), stubMmap(nativeDoc("x")));
    expect(lossy.warnings).toHaveLength(1);
    expect(lossy.warnings[0]).toMatch(/OPML/i);
    // Native lossless schema gets no note.
    const native = await parseImport(
      file("m.json", JSON.stringify(nativeDoc("N"))),
      stubMmap(nativeDoc("x")),
    );
    expect(native.warnings).toEqual([]);
  });

  it("routes MindMup (.mup) to its parser", async () => {
    const mup = JSON.stringify({
      id: "root",
      title: "Up",
      ideas: { "1": { id: 2, title: "kid", ideas: {} } },
    });
    const { doc } = await parseImport(file("m.mup", mup), stubMmap(nativeDoc("x")));
    expect(doc.root.topic).toBe("Up");
  });

  it("routes a small .itmz through the synchronous fallback used when a worker is unnecessary", async () => {
    const bytes = zipSync({
      "mapdata.xml": strToU8(
        '<?xml version="1.0"?><iThoughts><topics><topic uuid="root" text="iThoughts"><topic uuid="kid" text="Child" /></topic></topics></iThoughts>',
      ),
    });
    const { doc } = await parseImport(new File([bytes], "sample.itmz"), stubMmap(nativeDoc("x")));
    expect(doc.root.topic).toBe("iThoughts");
    expect(doc.root.children[0]?.topic).toBe("Child");
  });

  it("falls back to the injected .mmap importer for an unrecognised/.mmap file and forwards its warnings", async () => {
    const imp = stubMmap(nativeDoc("FromMmap"), ["dropped tasks"]);
    const { doc, warnings } = await parseImport(file("legacy.mmap", "binary"), imp);
    expect(imp).toHaveBeenCalledTimes(1); // the heavy importer only loads on this branch
    expect(doc.title).toBe("FromMmap");
    expect(warnings).toEqual(["dropped tasks"]);
  });

  it("treats an unknown extension as the .mmap fallback (no silent drop)", async () => {
    const imp = stubMmap(nativeDoc("Y"));
    await parseImport(file("mystery.weird", "x"), imp);
    expect(imp).toHaveBeenCalledTimes(1);
  });
});
