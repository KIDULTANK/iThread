// @vitest-environment jsdom

// NOTE: the directive above must stay on line 1, alone, with a blank line under it. Vitest only reads
// it from the file's leading comment block, and `biome check --write` sorts imports — if the long
// explanation below sat here instead, biome would attach it to the first import and carry the
// directive with it, silently dropping this file back to the `node` environment. It failed exactly
// that way once; the tests then die on `document is not defined` rather than passing quietly, but only
// because everything here renders.
import { render } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkerTagIndex } from "../src/Panels";
import { FirstRunCard } from "../src/components/FirstRunCard";
import { CoachMark } from "../src/mindmap/flow/CanvasOverlays";
import type { MapNode } from "../src/model/types";
import {
  applyEchoLocale,
  applyMarkerLocale,
  restoreCatalogues,
  unmarkedStrings,
} from "./helpers/pseudoLocale";

// Proves the pseudo-locale harness works in BOTH directions, which is the only thing that makes it
// trustworthy as the per-batch check:
//
//   - a MIGRATED component renders nothing but marked text  → the harness can pass
//   - an UNMIGRATED component renders its hardcoded strings  → the harness can fail
//
// A harness that only ever reports zero is worse than none, because it certifies every future batch.
// A deliberately hardcoded fixture is the negative control. Keeping the defect inside the test means
// the harness stays proven without requiring production UI to remain untranslated forever.

// The overlay is global mutable state — without this the next file to touch i18n inherits it.
afterEach(restoreCatalogues);

// Fixture-supplied user DATA is not a message and must not be reported. Deliberately not English, so a
// real string can never hide behind the ignore list.
const DATA = ["ZZDATA"];

const dataRoot = (): MapNode => ({
  id: "r",
  topic: "ZZDATA",
  children: [{ id: "a", topic: "ZZDATA", icons: ["⭐"], tags: ["ZZDATA"], children: [] }],
});

describe("pseudo-locale harness", () => {
  it("reports nothing for a component whose strings all come from the catalogue", () => {
    // Panels.tsx is on the migrated allowlist, so every string it renders must carry the marker.
    applyMarkerLocale();
    const { container } = render(<MarkerTagIndex root={dataRoot()} onPick={() => {}} />);
    expect(unmarkedStrings(container, DATA)).toEqual([]);
  });

  it("REPORTS the hardcoded strings in a component that has not been migrated", () => {
    // The negative control. If this returns [], the harness has gone blind.
    applyMarkerLocale();
    const { container } = render(<div aria-label="Hardcoded control">Hardcoded copy</div>);
    const found = unmarkedStrings(container, DATA);
    expect(found.length).toBeGreaterThan(0);
    expect(found.join("\n")).toContain("Hardcoded control");
  });

  // The markup-in-prose components. These are the ones the SCANNER cannot judge: no detector matches a
  // sentence broken up by a <kbd> or <strong>, so all three reported "0 hardcoded strings" while the
  // prose around the markup was still hardcoded. Only rendering them can tell.
  //
  // CoachMark anchors to a node via NodeToolbar, so it needs a live React Flow store AND the node to
  // exist — with a bare provider it renders NOTHING, which would make `unmarkedStrings` return [] and
  // the test pass while proving nothing. That is not hypothetical; the first version did exactly that.
  // Hence: a real node, then scope the assertion to the coachmark element itself.
  //
  // Scoping also keeps React Flow's OWN chrome out of the result — its attribution and keyboard-a11y
  // descriptions are library strings, not ours, and no catalogue of ours can mark them. Narrowing the
  // root is the honest way to exclude them; adding them to `ignore` would be teaching the harness to
  // skip real English text by content, which is exactly how an ignore list starts lying.
  const coachmark = (touch: boolean): HTMLElement => {
    const { container } = render(
      <ReactFlowProvider>
        <ReactFlow nodes={[{ id: "r", position: { x: 0, y: 0 }, data: {} }]} edges={[]}>
          <CoachMark show rootId="r" touch={touch} />
        </ReactFlow>
      </ReactFlowProvider>,
    );
    const el = container.querySelector<HTMLElement>(".mm-coachmark");
    if (!el) throw new Error("CoachMark did not render — the test would prove nothing");
    return el;
  };

  it("reports nothing for the coachmark, which interleaves prose with <kbd>", () => {
    applyMarkerLocale();
    const el = coachmark(false);
    expect(el.textContent).toContain("Tab"); // non-vacuity: the copy is really on screen
    // Key names are literal by policy — a locale does not rename the Tab key.
    expect(unmarkedStrings(el, [...DATA, "Tab", "Enter", "Shift"])).toEqual([]);
  });

  it("reports nothing for the touch coachmark either", () => {
    applyMarkerLocale();
    const el = coachmark(true);
    expect(el.textContent).toContain("＋");
    expect(unmarkedStrings(el, DATA)).toEqual([]);
  });

  it("reports nothing for the first-run card, whose list items interleave <strong>", () => {
    applyMarkerLocale();
    const { container } = render(<FirstRunCard onDismiss={() => {}} />);
    expect(container.textContent).toContain("Tab"); // non-vacuity
    expect(unmarkedStrings(container, [...DATA, "Tab"])).toEqual([]);
  });

  it("echo mode names the KEY a call site read, not just that it read one", () => {
    // Marker mode proves a string came from the catalogue. Only echo mode proves it came from the
    // RIGHT entry — the failure mode where a migration mints a plausible new key instead of reusing
    // the existing one, which renders identically and passes every other check.
    applyEchoLocale();
    const { container } = render(<MarkerTagIndex root={dataRoot()} onPick={() => {}} />);
    expect(container.innerHTML).toContain("panel.markersTags");
  });
});
