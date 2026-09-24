// Layout-transition animation (#16): when expand/collapse or a layout-kind change reshuffles the
// tree, tween node positions from where they were to where they land instead of snapping. The math
// here is pure + unit-tested; FlowMindMap drives the requestAnimationFrame loop with it. Honours the
// OS "reduce motion" setting (and any environment without matchMedia) by skipping the tween.

/** Smooth ease-in-out (cubic). t is clamped to [0,1]; eased(0)=0, eased(1)=1, eased(0.5)=0.5. Pure. */
export function easeInOutCubic(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Responsive, iPad-like settle: movement starts immediately, then glides gently into place. */
export function easeOutQuint(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - (1 - x) ** 5;
}

/** Linear interpolation between a and b at parameter t. Pure. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** True when the user has asked the OS to reduce motion (so the caller skips the tween). Defensive:
 *  returns false — i.e. allow animation — only when matchMedia exists AND doesn't match reduce. Any
 *  environment without matchMedia (SSR/tests) reports `true` so it never tries to animate there. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The animation duration (ms) for a layout transition. */
export const LAYOUT_ANIM_MS = 300;
