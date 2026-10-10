// EditorIcons — thin-stroke 16px-grid icon set for the redesigned editor chrome (icon rail, top
// bar, inspector). Lifted from the design handoff's `MI` set. Pure presentational SVG; colour comes
// from `currentColor` so the chrome's `--ed-*` tokens drive it. Marker glyphs for nodes still live
// in src/icons.ts — this set is chrome-only.

export type EditorIconName =
  | "home"
  | "pointer"
  | "hand"
  | "text"
  | "image"
  | "search"
  | "help"
  | "settings"
  | "plus"
  | "minus"
  | "child"
  | "trash"
  | "note"
  | "link"
  | "bold"
  | "palette"
  | "dots"
  | "balance"
  | "layers"
  | "fit"
  | "chevron"
  | "check"
  | "star"
  | "export"
  | "import"
  | "zoomin"
  | "zoomout"
  | "moon"
  | "present"
  | "filter"
  | "board"
  | "history"
  | "grid"
  | "calendar"
  | "copy"
  | "paste"
  | "undo"
  | "redo";

export function EditorIcon({
  name,
  size = 16,
  stroke = 1.7,
}: {
  name: EditorIconName;
  size?: number;
  stroke?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "pointer":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M5 3l6 16 2.4-6.4L19 10 5 3z" />
        </svg>
      );
    case "hand":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M9 11V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m0-1a1.5 1.5 0 013 0v4a6 6 0 01-6 6h-1.5a5 5 0 01-3.7-1.7L6 17c-1-1.2-.4-2.4.8-2.7L9 14V5.5a1.5 1.5 0 00-3 0V13" />
        </svg>
      );
    case "text":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M5 7V5h14v2M12 5v14M9 19h6" />
        </svg>
      );
    case "image":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
          <circle cx="8.5" cy="10" r="1.6" />
          <path d="M5 17l4.5-4 3 2.5L16 12l3.5 4" />
        </svg>
      );
    case "search":
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
      );
    case "help":
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.4a2.4 2.4 0 014.4 1.3c0 1.6-2 2-2 3.3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="m9.5 3-.5 2-1.5.9-2-.6-2.5 4 1.5 1.4v2.6L3 14.7l2.5 4 2-.6 1.5.9.5 2h5l.5-2 1.5-.9 2 .6 2.5-4-1.5-1.4v-2.6L21 9.3l-2.5-4-2 .6L15 5l-.5-2z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      );
    case "child":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="3" y="9.5" width="7" height="5" rx="1.4" />
          <rect x="15" y="4" width="6" height="4.5" rx="1.2" />
          <rect x="15" y="15.5" width="6" height="4.5" rx="1.2" />
          <path d="M10 12h3M13 12V6.2h2M13 12v5.8h2" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
        </svg>
      );
    case "note":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2.4" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case "link":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M9.5 14.5l5-5" />
          <path d="M8 12L6 14a3 3 0 004.2 4.2L12 16.5M16 11.5L18 9.5A3 3 0 0013.8 5.3L12 7.2" />
        </svg>
      );
    case "bold":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M7 5h6a3.2 3.2 0 010 6.4H7zM7 11.4h7a3.3 3.3 0 010 6.6H7z" />
        </svg>
      );
    case "palette":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M12 3.5a8.5 8.5 0 100 17c1.4 0 2-1 2-1.8 0-1.6-1.4-1.7-1.4-3 0-.8.7-1.4 1.6-1.4H16a4.5 4.5 0 004.5-4.5C20.5 6.4 16.7 3.5 12 3.5z" />
          <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="7.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "dots":
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "balance":
      return (
        <svg {...p} aria-hidden="true">
          <line x1="12" y1="4" x2="12" y2="20" />
          <path d="M4 9h8M4 15h8M20 9h-8M20 15h-8" />
          <circle cx="4" cy="9" r="2" fill="currentColor" stroke="none" />
          <circle cx="4" cy="15" r="2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="9" r="2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="15" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "layers":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M12 4l8 4-8 4-8-4 8-4z" />
          <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
        </svg>
      );
    case "fit":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "check":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      );
    case "star":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.8 7.4 18l.9-5.1L4.5 9.5l5.2-.8L12 4z" />
        </svg>
      );
    case "export":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4" />
        </svg>
      );
    case "import":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M12 3v11" />
          <path d="M8 10l4 4 4-4" />
          <path d="M4 17v3h16v-3" />
        </svg>
      );
    case "zoomin":
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4M11 8.5v5M8.5 11h5" />
        </svg>
      );
    case "zoomout":
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4M8.5 11h5" />
        </svg>
      );
    case "moon":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      );
    case "present":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M12 17v3M8 20h8" />
        </svg>
      );
    case "filter":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M4 5h16l-6 8v5l-4 2v-7L4 5z" />
        </svg>
      );
    case "board":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="3" y="4" width="6" height="16" rx="1.5" />
          <rect x="10" y="4" width="6" height="11" rx="1.5" />
          <rect x="17" y="4" width="4" height="14" rx="1.5" />
        </svg>
      );
    case "history":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.4 8.4 0 005 7" />
          <path d="M5 3v4h4" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "grid":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1.4" />
          <rect x="13" y="4" width="7" height="7" rx="1.4" />
          <rect x="4" y="13" width="7" height="7" rx="1.4" />
          <rect x="13" y="13" width="7" height="7" rx="1.4" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" />
        </svg>
      );
    case "copy":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 012-2h8" />
        </svg>
      );
    case "paste":
      return (
        <svg {...p} aria-hidden="true">
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <rect x="9" y="2" width="6" height="3.4" rx="1" />
          <path d="M9 11h6M9 15h4" />
        </svg>
      );
    case "undo":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M9 7L4 12l5 5" />
          <path d="M4 12h11a5 5 0 015 5v0a5 5 0 01-5 5h-3" />
        </svg>
      );
    case "redo":
      return (
        <svg {...p} aria-hidden="true">
          <path d="M15 7l5 5-5 5" />
          <path d="M20 12H9a5 5 0 00-5 5v0a5 5 0 005 5h3" />
        </svg>
      );
    default:
      return (
        <svg {...p} aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
