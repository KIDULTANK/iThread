import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../src/components/start/CommandPalette";
import { StartSidebar } from "../src/components/start/StartSidebar";
import { Learn } from "../src/components/start/sections/Learn";
import type { StartContext } from "../src/components/start/types";
import { sampleDoc } from "../src/model/sampleMap";

const u = userEvent.setup();
const mkCtx = (over: Partial<StartContext> = {}): StartContext => ({
  onOpen: vi.fn(),
  onImportFiles: vi.fn(),
  go: vi.fn(),
  libraryRev: 0,
  onLibraryChange: vi.fn(),
  ...over,
});

describe("sampleMap", () => {
  it("is a valid, feature-rich canonical doc", () => {
    expect(sampleDoc.schemaVersion).toBe(1);
    expect(sampleDoc.root.children.length).toBe(5);
    expect(sampleDoc.links?.length).toBeGreaterThan(0);
    expect(sampleDoc.boundaries?.length).toBeGreaterThan(0);
    // shows off node features: at least one marker icon + one note somewhere
    const hasIcon = sampleDoc.root.children.some((c) => (c.icons?.length ?? 0) > 0);
    expect(hasIcon).toBe(true);
  });
});

describe("Learn section", () => {
  it("renders the six principles", () => {
    render(<Learn />);
    expect(screen.getByText("Learn mind mapping")).toBeTruthy();
    expect(screen.getByText("Start central")).toBeTruthy();
    expect(screen.getByText("Cross-links")).toBeTruthy();
    expect(screen.getByText("Capture, then tidy")).toBeTruthy();
  });
});

describe("StartSidebar", () => {
  it("renders nav + fires navigation and New map", async () => {
    const onNavigate = vi.fn();
    const onNewMap = vi.fn();
    render(
      <StartSidebar active="start" mapCount={0} onNavigate={onNavigate} onNewMap={onNewMap} />,
    );
    await u.click(screen.getByRole("button", { name: /new map/i }));
    expect(onNewMap).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole("button", { name: /templates/i }));
    expect(onNavigate).toHaveBeenCalledWith("templates");
    expect(screen.queryByRole("button", { name: /^learn mind mapping/i })).toBeNull();
  });

  it("shows the All-maps count badge when there are maps", () => {
    render(<StartSidebar active="all" mapCount={7} onNavigate={vi.fn()} onNewMap={vi.fn()} />);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("renders vector (SVG) nav icons, not Unicode/emoji glyphs (Phase 11b)", () => {
    const { container } = render(
      <StartSidebar active="start" mapCount={0} onNavigate={vi.fn()} onNewMap={vi.fn()} />,
    );
    // One inline SVG per navigation row; the selector excludes the brand artwork.
    expect(container.querySelectorAll(".st-nav-item .st-nav-icon svg").length).toBe(9);
    expect(container.textContent).not.toContain("🕘"); // the old clock emoji is gone
  });
});

describe("CommandPalette", () => {
  it("lists the core actions and runs one (then closes)", async () => {
    const ctx = mkCtx();
    const onClose = vi.fn();
    render(<CommandPalette ctx={ctx} onClose={onClose} />);
    expect(screen.getByText("New blank map")).toBeTruthy();
    expect(screen.getByText("Browse templates")).toBeTruthy();
    expect(screen.getByText("Browse examples")).toBeTruthy();
    await u.click(screen.getByText("New blank map"));
    expect(ctx.onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates via an action", async () => {
    const ctx = mkCtx();
    render(<CommandPalette ctx={ctx} onClose={vi.fn()} />);
    await u.click(screen.getByText("Browse layouts"));
    expect(ctx.go).toHaveBeenCalledWith("layouts");
  });

  it("offers 'New map: <query>' for a non-matching query and creates it", async () => {
    const ctx = mkCtx();
    render(<CommandPalette ctx={ctx} onClose={vi.fn()} />);
    await u.type(screen.getByPlaceholderText(/search maps and commands/i), "zzqq");
    const create = screen.getByText(/New map: "zzqq"/i);
    expect(create).toBeTruthy();
    await u.click(create);
    expect(ctx.onOpen).toHaveBeenCalledTimes(1);
  });

  it("filters actions by query and runs the active one with Enter", async () => {
    const ctx = mkCtx();
    render(<CommandPalette ctx={ctx} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search maps and commands/i);
    await u.type(input, "layouts");
    expect(screen.getByText("Browse layouts")).toBeTruthy();
    // the create row is active(0); arrow down to the matched action, then Enter
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(ctx.go).toHaveBeenCalledWith("layouts");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<CommandPalette ctx={mkCtx()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
