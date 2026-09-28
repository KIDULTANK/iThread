import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { fromIthoughts, toIthoughts } from "../src/io/ithoughts";
import type { MindMapDoc } from "../src/model/types";

// Hand-authored mapdata.xml matching the iThoughts format:
//   • <iThoughts> root wrapper with <topics> child
//   • First <topic> = map centre (root), nested <topic>s = children
//   • `text` attribute = label, `uuid` = stable id
//   • `note` attribute = extended note
//   • `link` attribute = hyperlink
//   • <relationship> sibling inside <topics> for cross-links (end1-uuid / end2-uuid)
//   • Extra peer <topic> after the root = floating topic
const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<iThoughts version="4.0" app="iThoughts" app-version="7.0">
  <topics>
    <topic uuid="root-1" text="Project Plan">
      <topic uuid="child-1" text="Research" note="Do background work" link="https://example.com/research">
        <topic uuid="grandchild-1" text="Literature review"/>
      </topic>
      <topic uuid="child-2" text="Design"/>
      <topic uuid="dangerous-1" text="BadLink" link="javascript:alert(1)"/>
    </topic>
    <relationship end1-uuid="child-1" end2-uuid="child-2" label="feeds into"/>
    <topic uuid="float-1" text="Legend" position="{400,200}"/>
  </topics>
</iThoughts>`;

const makeItmz = (xml: string, extra: Record<string, Uint8Array> = {}) =>
  zipSync({ "mapdata.xml": strToU8(xml), ...extra });

describe("iThoughts .itmz import", () => {
  it("builds the root topic and nested children", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.title).toBe("Project Plan");
    expect(doc.root.topic).toBe("Project Plan");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Research", "Design", "BadLink"]);
    expect(doc.root.children[0].children.map((c) => c.topic)).toEqual(["Literature review"]);
  });

  it("carries notes and web hyperlinks", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    const research = doc.root.children[0];
    expect(research.note).toBe("Do background work");
    expect(research.hyperlink).toBe("https://example.com/research");
  });

  it("drops dangerous-scheme hyperlinks (javascript:)", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    const bad = doc.root.children[2];
    expect(bad.topic).toBe("BadLink");
    expect(bad.hyperlink).toBeUndefined();
  });

  it("maps <relationship> elements to cross-links using uuid→id resolution", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.links?.length).toBe(1);
    const link = doc.links?.[0];
    expect(link?.label).toBe("feeds into");
    // Verify the from/to ids correspond to the Research and Design nodes.
    const researchId = doc.root.children[0].id;
    const designId = doc.root.children[1].id;
    expect(link?.from).toBe(researchId);
    expect(link?.to).toBe(designId);
  });

  it("treats extra top-level <topic> peers as floating topics", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.floatingTopics?.map((f) => f.topic)).toEqual(["Legend"]);
  });

  it("sets meta.source to 'ithoughts' and schemaVersion to 1", () => {
    const doc = fromIthoughts(makeItmz(fixture));
    expect(doc.meta?.source).toBe("ithoughts");
    expect(doc.schemaVersion).toBe(1);
  });

  it("keeps source UUIDs and imports the folded state", () => {
    const xml = `<iThoughts><topics><topic uuid="r" text="Root"><topic uuid="c" text="Closed" folded="1"/></topic></topics></iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.root.sourceId).toBe("r");
    expect(doc.root.children[0].sourceId).toBe("c");
    expect(doc.root.children[0].collapsed).toBe(true);
  });

  it("recognises floating=1 topics embedded below the central topic", () => {
    const xml = `<iThoughts><topics><topic uuid="r" text="Root"><topic uuid="branch" text="Branch"/><topic uuid="float" text="Free note" floating="1" position="{320, -40}"/></topic></topics></iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.root.children.map((node) => node.topic)).toEqual(["Branch"]);
    expect(doc.floatingTopics?.map((node) => node.topic)).toEqual(["Free note"]);
    expect(doc.floatingTopics?.[0].pos).toEqual({ x: 320, y: -40 });
  });

  it("loads an embedded image topic from its assets folder", () => {
    const xml = `<iThoughts><topics><topic uuid="r" text="Root"><topic uuid="image" att-id="asset-1" att-name="image.png"/></topic></topics></iThoughts>`;
    const doc = fromIthoughts(
      makeItmz(xml, { "assets/asset-1/image.png": new Uint8Array([137, 80, 78, 71]) }),
    );
    expect(doc.root.children[0].image?.url).toBe("data:image/png;base64,iVBORw==");
  });

  it("throws a descriptive error when mapdata.xml is missing from the zip", () => {
    const bad = zipSync({ "style.xml": strToU8("<style/>") });
    expect(() => fromIthoughts(bad)).toThrow(/mapdata\.xml/);
  });

  it("throws when given non-zip bytes", () => {
    expect(() => fromIthoughts(new Uint8Array([0, 1, 2, 3]))).toThrow();
  });

  it("handles a bare <topics> root without an <iThoughts> wrapper", () => {
    const bare = `<?xml version="1.0" encoding="UTF-8"?>
<topics>
  <topic uuid="r" text="Bare Root">
    <topic uuid="c" text="Child A"/>
  </topic>
</topics>`;
    const doc = fromIthoughts(makeItmz(bare));
    expect(doc.title).toBe("Bare Root");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Child A"]);
  });

  it("decodes \\n escape sequences in topic text", () => {
    const xml = `<iThoughts><topics><topic uuid="r" text="Line one\\nLine two"/></topics></iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.root.topic).toBe("Line one\nLine two");
  });

  it("collects floating topics from a <floating-topics> wrapper element", () => {
    const xml = `<iThoughts>
  <topics>
    <topic uuid="r" text="Root"/>
    <floating-topics>
      <topic uuid="f1" text="Floater A"/>
      <topic uuid="f2" text="Floater B"/>
    </floating-topics>
  </topics>
</iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.root.topic).toBe("Root");
    expect(doc.floatingTopics?.map((f) => f.topic)).toEqual(["Floater A", "Floater B"]);
  });

  it("silently skips relationships whose endpoints are not in the map", () => {
    const xml = `<iThoughts>
  <topics>
    <topic uuid="r" text="Root">
      <topic uuid="a" text="A"/>
    </topic>
    <relationship end1-uuid="a" end2-uuid="does-not-exist"/>
  </topics>
</iThoughts>`;
    const doc = fromIthoughts(makeItmz(xml));
    expect(doc.links).toBeUndefined();
  });
});

const exportedDoc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "doc-export",
  title: "Export & test",
  root: {
    id: "root",
    topic: "Root & <centre>",
    note: "Root note",
    children: [
      {
        id: "a",
        topic: "Alpha\nsecond line",
        note: 'A note with <xml> & quotes "here"',
        hyperlink: "https://example.com/a?x=1&y=2",
        collapsed: true,
        style: { background: "#AABBCC", color: "#112233", fontSize: "18px" },
        task: { priority: 2, progress: 0.75 },
        children: [{ id: "a1", topic: "Nested", children: [] }],
      },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
  floatingTopics: [{ id: "float", topic: "Free note", pos: { x: 320, y: -40 }, children: [] }],
  links: [{ id: "rel", from: "a", to: "b", label: "feeds & supports" }],
  meta: { updatedAt: Date.parse("2026-09-28T10:30:00Z") },
});

describe("iThoughts .itmz export", () => {
  it("emits the native iThoughts container files", () => {
    const files = unzipSync(toIthoughts(exportedDoc()));
    expect(Object.keys(files).sort()).toEqual(
      [
        "display_state.plist",
        "manifest.plist",
        "mapdata.xml",
        "preferences.plist",
        "preview.png",
        "style.xml",
      ].sort(),
    );
    const xml = strFromU8(files["mapdata.xml"]);
    expect(xml).toContain('<iThoughts version="4.0"');
    expect(xml).toContain('floating="1"');
    expect(xml).toContain("Root &amp; &lt;centre&gt;");
  });

  it("round-trips structure, notes, links, folding, task state and floating topics", () => {
    const back = fromIthoughts(toIthoughts(exportedDoc()));
    expect(back.root.topic).toBe("Root & <centre>");
    expect(back.root.note).toBe("Root note");
    expect(back.root.children.map((node) => node.topic)).toEqual(["Alpha\nsecond line", "Beta"]);
    const alpha = back.root.children[0];
    expect(alpha.note).toBe('A note with <xml> & quotes "here"');
    expect(alpha.hyperlink).toBe("https://example.com/a?x=1&y=2");
    expect(alpha.collapsed).toBe(true);
    expect(alpha.children[0].topic).toBe("Nested");
    expect(alpha.style).toMatchObject({
      background: "#AABBCC",
      color: "#112233",
      fontSize: "18px",
    });
    expect(alpha.task).toEqual({ priority: 2, progress: 0.75 });
    expect(back.floatingTopics?.[0]).toMatchObject({
      topic: "Free note",
      pos: { x: 320, y: -40 },
    });
    expect(back.links?.[0].label).toBe("feeds & supports");
    expect(back.links?.[0].from).toBe(alpha.id);
    expect(back.links?.[0].to).toBe(back.root.children[1].id);
  });

  it("packages inline images below assets/ and restores them", () => {
    const doc = exportedDoc();
    doc.root.children[0].image = {
      url: "data:image/png;base64,iVBORw==",
      width: 240,
    };
    const bytes = toIthoughts(doc);
    const entries = Object.keys(unzipSync(bytes));
    expect(entries.some((name) => /^assets\/.+\/image\.png$/.test(name))).toBe(true);
    expect(fromIthoughts(bytes).root.children[0].image).toEqual({
      url: "data:image/png;base64,iVBORw==",
      width: 240,
    });
  });

  it("is byte-deterministic for the same document", () => {
    expect(toIthoughts(exportedDoc())).toEqual(toIthoughts(exportedDoc()));
  });
});
