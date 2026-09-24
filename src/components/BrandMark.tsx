// BrandMark — the iThread node-link glyph, in the emerald brand accent. Lifted from the
// design handoff (shared.jsx). Used in the editor's icon rail; the colour follows currentColor so a
// parent can tint it, defaulting to the emerald accent token.

export function BrandMark({
  size = 22,
  color = "var(--ed-accent, #1b8a5e)",
}: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 12h3M12 12l4-5M12 12l4 5"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="6.5" cy="12" r="3.3" fill={color} />
      <circle cx="17" cy="7" r="2.4" fill={color} opacity="0.85" />
      <circle cx="17" cy="17" r="2.4" fill={color} opacity="0.7" />
    </svg>
  );
}
