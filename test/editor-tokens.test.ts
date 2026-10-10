// editorThemeVars — the `--ed-*` custom properties the redesigned editor chrome consumes. Phase 8:
// a pure function of the resolved app appearance (light/dark boolean), independent of the canvas
// theme; tests pin the emerald accent (fixed), the light surfaces, and the dark-branch overrides.

import { describe, expect, it } from "vitest";
import {
  EDITOR_ACCENT,
  EDITOR_ACCENT_HOVER,
  EDITOR_FONT_MONO,
  EDITOR_FONT_SANS,
  editorThemeVars,
} from "../src/design/tokens";

type Vars = Record<string, string>;

describe("editorThemeVars", () => {
  it("emits the light-appearance surfaces + ink", () => {
    const v = editorThemeVars(false) as Vars;
    expect(v["--ed-page"]).toBe("#faf9f5");
    expect(v["--ed-card"]).toBe("#ffffff");
    expect(v["--ed-ink"]).toBe("#23211c");
    expect(v["--ed-sidebar"]).toBe("#f4f2ec");
    expect(v["--ed-border"]).toBe("#e7e4dc");
  });

  it("uses dark overrides for the dark appearance", () => {
    const v = editorThemeVars(true) as Vars;
    expect(v["--ed-page"]).toBe("#1d1c22");
    expect(v["--ed-card"]).toBe("#2a2930");
    expect(v["--ed-ink"]).toBe("#e8e6df");
    expect(v["--ed-sidebar"]).toBe("#16151d");
    expect(v["--ed-ink2"]).toBe("#bdb8ad");
    expect(v["--ed-border"]).toBe("rgba(255,255,255,0.11)");
  });

  it("uses readable vermilion accents in both appearances", () => {
    for (const dark of [false, true]) {
      const v = editorThemeVars(dark) as Vars;
      expect(v["--ed-accent"], String(dark)).toBe(dark ? "#ef9486" : EDITOR_ACCENT);
      expect(v["--ed-accent-hover"], String(dark)).toBe(dark ? "#ffb1a3" : EDITOR_ACCENT_HOVER);
    }
    expect(EDITOR_ACCENT).toBe("#be3d32");
  });

  it("threads the font stacks through (no web fonts — offline-first)", () => {
    const v = editorThemeVars(false) as Vars;
    expect(v["--ed-font-sans"]).toBe(EDITOR_FONT_SANS);
    expect(v["--ed-font-mono"]).toBe(EDITOR_FONT_MONO);
    expect(EDITOR_FONT_MONO).toContain("JetBrains Mono");
    expect(EDITOR_FONT_SANS).not.toMatch(/http|googleapis/); // never loads a CDN font
  });

  it("emits the full --ed-* contract (shadows, rings, danger)", () => {
    const v = editorThemeVars(false) as Vars;
    for (const key of [
      "--ed-muted",
      "--ed-faint",
      "--ed-accent-tint",
      "--ed-accent-ring",
      "--ed-danger",
      "--ed-shadow",
      "--ed-shadow-pop",
    ]) {
      expect(v[key], key).toBeTruthy();
    }
  });

  it("pushes borders + text to their extremes in high-contrast light", () => {
    const v = editorThemeVars(false, true) as Vars;
    expect(v["--ed-border"]).toBe("#000000");
    expect(v["--ed-ink"]).toBe("#000000");
    expect(v["--ed-divider"]).toBe("#111111");
    // Secondary text is far darker than the normal light muted/faint (stronger contrast).
    expect(v["--ed-muted"]).toBe("#232323");
    expect(v["--ed-faint"]).toBe("#2c2c2c");
    // Same surfaces as normal light — only separation/text change, not the layout colours.
    expect(v["--ed-page"]).toBe("#faf9f5");
    expect(v["--ed-card"]).toBe("#ffffff");
  });

  it("pushes borders + text to their extremes in high-contrast dark", () => {
    const v = editorThemeVars(true, true) as Vars;
    expect(v["--ed-border"]).toBe("#ffffff");
    expect(v["--ed-ink"]).toBe("#ffffff");
    expect(v["--ed-page"]).toBe("#1d1c22"); // dark surface preserved
  });

  it("keeps the full --ed-* contract under high contrast (no dropped keys)", () => {
    const normal = editorThemeVars(false) as Vars;
    const hc = editorThemeVars(false, true) as Vars;
    for (const key of Object.keys(normal)) expect(hc[key], key).toBeTruthy();
  });
});
