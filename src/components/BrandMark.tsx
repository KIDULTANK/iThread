// The approved vermilion seal icon is shared with the desktop and PWA builds.
// BASE_URL keeps it available in packaged Electron and GitHub Pages.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <img
      className="mm-brand-mark"
      src={`${import.meta.env.BASE_URL}icon-192.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ display: "block", flexShrink: 0, borderRadius: Math.round(size * 0.2) }}
    />
  );
}
