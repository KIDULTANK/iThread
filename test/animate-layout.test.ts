import { describe, expect, it } from "vitest";
import {
  easeInOutCubic,
  easeOutQuint,
  lerp,
  prefersReducedMotion,
} from "../src/mindmap/flow/animateLayout";

// Pure math behind the layout-transition tween (#16). The rAF loop itself lives in FlowMindMap and is
// verified in-browser; here we pin the easing curve + interpolation that drive each frame.

describe("easeInOutCubic", () => {
  it("pins the endpoints and the midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it("clamps out-of-range t to [0,1]", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("eases in then out (slow at the ends, fast in the middle)", () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25); // still accelerating
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75); // already decelerating
    expect(easeInOutCubic(0.25)).toBeCloseTo(1 - easeInOutCubic(0.75), 10); // symmetric
  });
});

describe("easeOutQuint", () => {
  it("starts immediately and settles gently", () => {
    expect(easeOutQuint(0)).toBe(0);
    expect(easeOutQuint(1)).toBe(1);
    expect(easeOutQuint(0.25)).toBeGreaterThan(0.7);
    expect(easeOutQuint(-1)).toBe(0);
    expect(easeOutQuint(2)).toBe(1);
  });
});

describe("lerp", () => {
  it("interpolates linearly between a and b", () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
    expect(lerp(0, 100, 0.25)).toBe(25);
    expect(lerp(-50, 50, 0.5)).toBe(0);
  });
});

describe("prefersReducedMotion", () => {
  it("returns true where matchMedia is unavailable (so callers never animate there)", () => {
    // The node test env has no window.matchMedia → animation is skipped by default.
    expect(prefersReducedMotion()).toBe(true);
  });
});
