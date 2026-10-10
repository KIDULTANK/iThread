import type { CSSProperties } from "react";

// Start-screen design tokens. The vermilion brand accent is fixed across themes; chrome surfaces + text
// branch on the app's `dark` appearance (Phase 8 — independent of the canvas theme) so the Start
// screen honours System / Light / Dark. Emitted as `--st-*` CSS custom properties on the .start root;
// start.css consumes them.

export const ACCENT = "#be3d32";
export const ACCENT_HOVER = "#a32e25";

/** Build the `--st-*` custom properties for the .start root from the resolved app appearance. */
export function startThemeVars(dark: boolean): CSSProperties {
  const page = dark ? "#1d1c22" : "#faf9f5";
  const card = dark ? "#2a2930" : "#ffffff";
  const ink = dark ? "#e8e6df" : "#23211c";
  return {
    "--st-page": page,
    "--st-card": card,
    "--st-sidebar": dark ? "#16151d" : "#f4f2ec",
    "--st-border": dark ? "rgba(255,255,255,0.11)" : "#e7e4dc",
    "--st-divider": dark ? "rgba(255,255,255,0.06)" : "#efece4",
    "--st-ink": ink,
    "--st-ink2": dark ? "#bdb8ad" : "#5c574e",
    "--st-muted": dark ? "#8f8a80" : "#706a5f",
    "--st-faint": dark ? "#6d695f" : "#7a7468",
    "--st-accent": dark ? "#ef9486" : ACCENT,
    "--st-accent-hover": dark ? "#ffb1a3" : ACCENT_HOVER,
    "--st-on-accent": dark ? "#201c1b" : "#ffffff",
    "--st-accent-tint": dark ? "rgba(219,97,81,0.18)" : "rgba(190,61,50,0.08)",
    "--st-accent-ring": "rgba(190,61,50,0.24)",
    "--st-shadow": dark ? "0 6px 22px rgba(0,0,0,0.38)" : "0 6px 22px rgba(40,30,16,0.08)",
  } as CSSProperties;
}
