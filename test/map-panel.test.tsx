// MapPanel — the right-panel no-selection state (was MapStats). Covers the read-only stats (topics /
// branches / task progress over the live doc) AND the new Map settings: title rename, theme + layout
// selects, background colour, line-jumps toggle. Each control fires the prop App wires to the real
// handler. jsdom so the editable title + change events work.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapPanel } from "../src/components/MapPanel";
import { themeById } from "../src/mindmap/theme";
import type { MindMapDoc } from "../src/model/types";

const noop = () => {};

const doc = (title: string, root: MindMapDoc["root"], meta?: MindMapDoc["meta"]): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title,
  root,
  meta,
});

const planDoc = doc("Plan", {
  id: "root",
  topic: "Plan",
  children: [
    { id: "a", topic: "A", task: { progress: 1 }, children: [] },
    {
      id: "b",
      topic: "B",
      task: { progress: 0.5 },
      children: [{ id: "b1", topic: "B1", children: [] }],
    },
    { id: "c", topic: "C", children: [] },
  ],
});

function setup(d: MindMapDoc = planDoc, over: Partial<React.ComponentProps<typeof MapPanel>> = {}) {
  const props = {
    doc: d,
    theme: themeById("light"),
    setThemeId: vi.fn(),
    layout: "side" as const,
    changeLayout: vi.fn(),
    background: d.meta?.background,
    onSetBackground: vi.fn(),
    accentColor: d.meta?.accentColor,
    onSetAccentColor: vi.fn(),
    onSetBackgroundImage: vi.fn(),
    handleBackgroundImage: noop,
    lineJumps: !!d.meta?.lineJumps,
    onToggleLineJumps: vi.fn(),
    onRenameMap: vi.fn(),
    onSetConnectorStyle: vi.fn(),
    onSetBranchGrowth: vi.fn(),
    onSetFontFamily: vi.fn(),
    onSetFontScale: vi.fn(),
    onManageThemes: vi.fn(),
    ...over,
  };
  render(<MapPanel {...props} />);
  return props;
}

describe("MapPanel", () => {
  it("counts topics + first-level branches and shows task progress", () => {
    setup();
    expect(screen.getByText("No node selected")).toBeTruthy();
    expect(screen.getByText("Select a topic to edit it")).toBeTruthy(); // zero-selection guidance (#10)
    expect(screen.getByText("5")).toBeTruthy(); // root + a + b + b1 + c
    expect(screen.getByText("3")).toBeTruthy(); // branches
    expect(screen.getByText("Task progress")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy(); // 1 of 2 tasks done
  });

  it("hides the task-progress block when nothing carries progress", () => {
    setup(
      doc("Ideas", {
        id: "root",
        topic: "Ideas",
        children: [{ id: "a", topic: "A", children: [] }],
      }),
    );
    expect(screen.queryByText("Task progress")).toBeNull();
    expect(screen.getByText("branch")).toBeTruthy(); // singular for 1 branch
  });

  it("commits the title via onRenameMap on blur (and not on every keystroke)", async () => {
    const { onRenameMap } = setup();
    const input = screen.getByLabelText("Map title");
    await userEvent.clear(input);
    await userEvent.type(input, "New name");
    expect(onRenameMap).not.toHaveBeenCalled(); // typing alone doesn't commit
    await userEvent.tab(); // blur
    expect(onRenameMap).toHaveBeenCalledWith("New name");
  });

  it("reflects + drives theme, layout, background colour and line-jumps", async () => {
    const { setThemeId, changeLayout, onSetBackground, onToggleLineJumps } = setup(
      doc(
        "M",
        { id: "root", topic: "M", children: [] },
        { background: "#ffeecc", lineJumps: true },
      ),
    );
    expect((screen.getByLabelText("Canvas theme") as HTMLSelectElement).value).toBe("light");
    expect((screen.getByLabelText("Background colour") as HTMLInputElement).value).toBe("#ffeecc");

    await userEvent.selectOptions(screen.getByLabelText("Canvas theme"), "dark");
    expect(setThemeId).toHaveBeenCalledWith("dark");
    // Layout is a visual gallery (Menu), not a native select (10c) — open it and pick a row.
    await userEvent.click(screen.getByLabelText("Layout"));
    await userEvent.click(screen.getByRole("menuitem", { name: /grid \/ matrix/i }));
    expect(changeLayout).toHaveBeenCalledWith("grid");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onSetBackground).toHaveBeenCalledWith("");

    // Line jumps lives behind the collapsed "More styling" disclosure — hidden until expanded.
    expect(screen.queryByLabelText(/Line jumps/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /More styling/i }));
    expect((screen.getByLabelText(/Line jumps/) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByLabelText(/Line jumps/));
    expect(onToggleLineJumps).toHaveBeenCalled();
  });

  it("lists custom themes and applies their font + growth when picked (C3)", async () => {
    const custom = {
      id: "custom-forest",
      name: "Forest",
      palette: ["#2f6b3f", "#3d8b52", "#5aa172", "#7fbf95", "#a7d8b6", "#cdeed7"] as [
        string,
        string,
        string,
        string,
        string,
        string,
      ],
      background: "#0a2b1a",
      nodeFill: "#123922",
      fontFamily: "Georgia, serif",
      branchGrowth: "bold" as const,
    };
    const { setThemeId, onSetFontFamily, onSetBranchGrowth, onManageThemes } = setup(planDoc, {
      customThemes: [custom],
    });

    // Picking a custom theme applies its id AND its bundled font + branch weight.
    await userEvent.selectOptions(screen.getByLabelText("Canvas theme"), "custom-forest");
    expect(setThemeId).toHaveBeenCalledWith("custom-forest");
    expect(onSetFontFamily).toHaveBeenCalledWith("Georgia, serif");
    expect(onSetBranchGrowth).toHaveBeenCalledWith("bold");

    // The "Manage themes…" sentinel opens the designer instead of setting a theme.
    await userEvent.selectOptions(screen.getByLabelText("Canvas theme"), "__manage__");
    expect(onManageThemes).toHaveBeenCalled();
  });

  it("keeps typography visible and collapses lower-frequency controls behind 'More styling'", async () => {
    const { onSetFontFamily, onSetFontScale } = setup();
    expect(screen.getByLabelText("Canvas theme")).toBeTruthy(); // high-frequency control stays visible
    expect(screen.getByLabelText("Base font family")).toBeTruthy();
    expect(screen.getByLabelText("Font size scale")).toBeTruthy();
    await userEvent.selectOptions(
      screen.getByLabelText("Base font family"),
      "'Microsoft YaHei', '微软雅黑', sans-serif",
    );
    expect(onSetFontFamily).toHaveBeenCalledWith("'Microsoft YaHei', '微软雅黑', sans-serif");
    await userEvent.selectOptions(screen.getByLabelText("Font size scale"), "large");
    expect(onSetFontScale).toHaveBeenCalledWith("large");
    expect(screen.queryByLabelText("Connector style")).toBeNull(); // advanced control is tucked away
    await userEvent.click(screen.getByRole("button", { name: /More styling/i }));
    expect(screen.getByLabelText("Connector style")).toBeTruthy();
  });

  it("reads the filtered match count in the stats when a Power Filter is active", () => {
    setup(planDoc, { filteredCount: 2 });
    expect(screen.getByText("2/5")).toBeTruthy(); // 2 of 5 topics match
    expect(screen.getByText("topics match")).toBeTruthy();
  });

  it("reflects + drives the map accent colour (Reset only once an accent is set)", async () => {
    const { onSetAccentColor } = setup(
      doc("M", { id: "root", topic: "M", children: [] }, { accentColor: "#e36414" }),
    );
    const picker = screen.getByLabelText("Accent colour") as HTMLInputElement;
    expect(picker.value).toBe("#e36414");
    fireEvent.change(picker, { target: { value: "#123456" } });
    expect(onSetAccentColor).toHaveBeenCalledWith("#123456");
    // Background is unset here, so the only Reset button is the accent one → clears the accent.
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onSetAccentColor).toHaveBeenCalledWith("");
  });

  it("shows the emerald default in the accent picker when no accent is set", () => {
    setup(doc("M", { id: "root", topic: "M", children: [] }));
    expect((screen.getByLabelText("Accent colour") as HTMLInputElement).value).toBe("#1b8a5e");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull(); // nothing to reset
  });

  it("disables the layout gallery trigger in free-canvas mode", () => {
    setup(doc("F", { id: "root", topic: "F", children: [] }, { freeform: true }), {
      freeform: true,
    });
    expect((screen.getByLabelText("Layout") as HTMLButtonElement).disabled).toBe(true);
  });

  it("the layout gallery trigger shows the current layout's name and groups every row (10c)", async () => {
    setup(doc("M", { id: "root", topic: "M", children: [] }), { layout: "radial" });
    expect(screen.getByLabelText("Layout").textContent).toContain("Radial / hub");
    await userEvent.click(screen.getByLabelText("Layout"));
    const menu = screen.getByRole("menu", { name: "Choose a layout" });
    for (const group of ["Radial", "Tree", "Diagram"]) expect(menu.textContent).toContain(group);
    for (const row of ["Both sides", "Org chart ↓", "Timeline", "Brace map"])
      expect(screen.getByRole("menuitem", { name: row })).toBeTruthy();
  });

  it("hides the Design gallery when onApplyDesign is absent (opt-in, T3-25)", () => {
    setup();
    expect(screen.queryByLabelText("Apply a design preset")).toBeNull();
  });

  it("the Design gallery lists every preset and applies one on selection (T3-25)", async () => {
    const onApplyDesign = vi.fn();
    setup(planDoc, { onApplyDesign });
    await userEvent.click(screen.getByLabelText("Apply a design preset"));
    const menu = screen.getByRole("menu", { name: "Design presets" });
    expect(menu.textContent).toContain("Classic");
    await userEvent.click(screen.getByRole("menuitem", { name: "Classic" }));
    expect(onApplyDesign).toHaveBeenCalledWith("classic");
  });

  it("shows backdrop ring + remove controls only when the map has a backdrop", () => {
    const onBackdropRings = vi.fn();
    const onClearBackdrop = vi.fn();
    // No backdrop → no section.
    setup(planDoc, { onBackdropRings, onClearBackdrop });
    expect(screen.queryByText("Backdrop")).toBeNull();
  });

  it("drives onion backdrop rings + remove from the inspector", async () => {
    const onBackdropRings = vi.fn();
    const onClearBackdrop = vi.fn();
    const d: MindMapDoc = { ...planDoc, backdrop: { kind: "onion", rings: 3 } };
    setup(d, { onBackdropRings, onClearBackdrop });
    expect(screen.getByText("Backdrop")).toBeTruthy();
    expect(screen.getByText("Onion (rings)")).toBeTruthy();
    await userEvent.click(screen.getByLabelText("More rings"));
    expect(onBackdropRings).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByLabelText("Fewer rings"));
    expect(onBackdropRings).toHaveBeenCalledWith(-1);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onClearBackdrop).toHaveBeenCalled();
  });

  it("hides the ring buttons for a venn backdrop (rings don't apply)", () => {
    const d: MindMapDoc = { ...planDoc, backdrop: { kind: "venn3" } };
    setup(d, { onBackdropRings: vi.fn(), onClearBackdrop: vi.fn() });
    expect(screen.getByText("Venn (3 circles)")).toBeTruthy();
    expect(screen.queryByLabelText("More rings")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("reflects + drives the backdrop colour (and offers Reset only once a colour is set)", async () => {
    const onSetBackdropColor = vi.fn();
    // Uncoloured backdrop → the picker sits at the default-accent placeholder, no Reset shown.
    const plain: MindMapDoc = { ...planDoc, backdrop: { kind: "onion", rings: 3 } };
    const { rerender } = render(
      <MapPanel
        doc={plain}
        theme={themeById("light")}
        setThemeId={noop}
        layout="side"
        changeLayout={noop}
        background={undefined}
        onSetBackground={noop}
        onSetAccentColor={noop}
        onSetBackgroundImage={noop}
        handleBackgroundImage={noop}
        lineJumps={false}
        onToggleLineJumps={noop}
        onRenameMap={noop}
        onSetConnectorStyle={noop}
        onSetBranchGrowth={noop}
        onSetFontFamily={noop}
        onSetFontScale={noop}
        onSetBackdropColor={onSetBackdropColor}
      />,
    );
    const picker = () => screen.getByLabelText("Backdrop colour") as HTMLInputElement;
    expect(picker().value).toBe("#9a93d6"); // BACKDROP_STROKE placeholder
    // Background is undefined here, so the only "Reset" button is the backdrop one (still hidden).
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    // A coloured backdrop reflects the override and shows Reset, which clears it.
    rerender(
      <MapPanel
        doc={{ ...planDoc, backdrop: { kind: "onion", rings: 3, color: "#3b82c4" } }}
        theme={themeById("light")}
        setThemeId={noop}
        layout="side"
        changeLayout={noop}
        background={undefined}
        onSetBackground={noop}
        onSetAccentColor={noop}
        onSetBackgroundImage={noop}
        handleBackgroundImage={noop}
        lineJumps={false}
        onToggleLineJumps={noop}
        onRenameMap={noop}
        onSetConnectorStyle={noop}
        onSetBranchGrowth={noop}
        onSetFontFamily={noop}
        onSetFontScale={noop}
        onSetBackdropColor={onSetBackdropColor}
      />,
    );
    expect(picker().value).toBe("#3b82c4");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onSetBackdropColor).toHaveBeenCalledWith("");
  });
});
