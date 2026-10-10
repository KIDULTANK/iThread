import { describe, expect, it } from "vitest";
import { blankDoc, outlineDoc, topicDoc } from "../src/components/start/docBuilders";
import {
  BRANCH_PALETTE,
  branchLabels,
  branchSpokes,
  countNodes,
  docNodeCount,
} from "../src/components/start/nodeStats";
import { ACCENT, startThemeVars } from "../src/components/start/tokens";
import type { MapNode, MindMapDoc } from "../src/model/types";

const leaf = (id: string, topic: string): MapNode => ({ id, topic, children: [] });
const docOf = (root: MapNode, extra: Partial<MindMapDoc> = {}): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: root.topic,
  root,
  ...extra,
});

describe("nodeStats", () => {
  it("countNodes counts the node plus all descendants", () => {
    expect(countNodes(leaf("a", "A"))).toBe(1);
    const tree: MapNode = {
      id: "r",
      topic: "R",
      children: [leaf("a", "A"), { id: "b", topic: "B", children: [leaf("c", "C")] }],
    };
    expect(countNodes(tree)).toBe(4); // R + A + B + C
  });

  it("docNodeCount includes floating topics", () => {
    const root: MapNode = { id: "r", topic: "R", children: [leaf("a", "A")] };
    expect(docNodeCount(docOf(root))).toBe(2);
    const withFloating = docOf(root, {
      floatingTopics: [{ id: "f", topic: "F", children: [leaf("g", "G")] }],
    });
    expect(docNodeCount(withFloating)).toBe(4); // R + A + F + G
  });

  it("branchLabels lists the root's direct children", () => {
    const root: MapNode = {
      id: "r",
      topic: "R",
      children: [leaf("a", "Alpha"), leaf("b", "Beta")],
    };
    expect(branchLabels(docOf(root))).toEqual(["Alpha", "Beta"]);
    expect(branchLabels(docOf(leaf("r", "Lonely")))).toEqual([]);
  });

  it("branchSpokes gives one colour per root child — explicit colour, else a palette index", () => {
    const root: MapNode = {
      id: "r",
      topic: "R",
      children: [
        { id: "a", topic: "A", children: [], style: { color: "#abcdef" } },
        leaf("b", "B"),
      ],
    };
    const spokes = branchSpokes(docOf(root));
    expect(spokes).toHaveLength(2);
    expect(spokes[0]).toBe("#abcdef"); // explicit topic colour wins
    expect(spokes[1]).toBe(BRANCH_PALETTE[1]); // second child → palette index 1
    expect(branchSpokes(docOf(leaf("r", "Lonely")))).toEqual([]); // bare root → no spokes
  });
});

describe("docBuilders", () => {
  it("topicDoc trims, falls back, and tags its source", () => {
    const d = topicDoc("  Launch plan  ");
    expect(d.title).toBe("Launch plan");
    expect(d.root.topic).toBe("Launch plan");
    expect(d.root.children).toEqual([]);
    expect(d.meta?.source).toBe("start");
    expect(d.id).toBeTruthy();
    expect(topicDoc("   ").title).toBe("New map"); // blank → fallback
  });

  it("topicDoc gives every map a fresh id", () => {
    expect(topicDoc("X").id).not.toBe(topicDoc("X").id);
  });

  it("outlineDoc returns null for empty input", () => {
    expect(outlineDoc("")).toBeNull();
    expect(outlineDoc("   \n  \n")).toBeNull();
  });

  it("outlineDoc keeps a single root as-is", () => {
    const d = outlineDoc("Root\n\tChild A\n\tChild B");
    expect(d).not.toBeNull();
    expect(d?.root.topic).toBe("Root");
    expect(d?.meta?.source).toBe("paste");
  });

  it("outlineDoc wraps multiple top-level topics under a synthetic root", () => {
    const d = outlineDoc("First\nSecond\nThird");
    expect(d?.title).toBe("Pasted map");
    expect(d?.root.children.length).toBe(3);
  });

  it("blankDoc returns an empty-rooted map", () => {
    const d = blankDoc();
    expect(d.root.children).toEqual([]);
    expect(d.id).toBeTruthy();
  });
});

describe("startThemeVars", () => {
  const KEYS = [
    "--st-page",
    "--st-card",
    "--st-sidebar",
    "--st-border",
    "--st-divider",
    "--st-ink",
    "--st-ink2",
    "--st-muted",
    "--st-faint",
    "--st-accent",
    "--st-accent-hover",
    "--st-accent-tint",
    "--st-accent-ring",
    "--st-shadow",
  ];

  it("emits every --st-* token for each appearance", () => {
    for (const dark of [false, true]) {
      const vars = startThemeVars(dark) as Record<string, string>;
      for (const k of KEYS) expect(vars[k], `${dark} ${k}`).toBeTruthy();
    }
  });

  it("uses a readable vermilion accent in each appearance", () => {
    for (const dark of [false, true]) {
      expect((startThemeVars(dark) as Record<string, string>)["--st-accent"]).toBe(
        dark ? "#ef9486" : ACCENT,
      );
    }
  });

  it("branches chrome on the appearance (dark differs from light)", () => {
    const light = startThemeVars(false) as Record<string, string>;
    const dark = startThemeVars(true) as Record<string, string>;
    expect(dark["--st-sidebar"]).not.toBe(light["--st-sidebar"]);
    expect(light["--st-page"]).toBe("#faf9f5");
    expect(dark["--st-page"]).toBe("#1d1c22");
  });
});
