import type { LayoutKind } from "./mindmap";

const VALID_LAYOUTS: readonly LayoutKind[] = [
  "side",
  "left",
  "right",
  "org-down",
  "org-up",
  "radial",
  "timeline",
  "fishbone",
  "grid",
  "swimlane",
  "brace",
];

function validLayout(value: string | null): value is LayoutKind {
  return value !== null && VALID_LAYOUTS.includes(value as LayoutKind);
}

/** Resolve the editor's initial layout. Explicit links and a user's saved choice still win; a new or
 * reset profile opens as a right-growing map, matching the primary iThoughts-style workflow. */
export function resolveInitialLayout(search: string, readSaved: () => string | null): LayoutKind {
  try {
    const queryLayout = new URLSearchParams(search).get("layout");
    if (validLayout(queryLayout)) return queryLayout;
    const savedLayout = readSaved();
    if (validLayout(savedLayout)) return savedLayout;
  } catch {
    // Storage/query parsing is best-effort; use the product default below.
  }
  return "right";
}
