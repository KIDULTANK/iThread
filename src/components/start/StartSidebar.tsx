import { t } from "../../i18n/registry";
import "./messages";
import { type ReactNode, useEffect, useState } from "react";
import { BrandMark } from "../BrandMark";
import { EditorIcon } from "../EditorIcons";
import { InstallButton } from "../InstallButton";
import type { StartSection } from "./types";

// Left rail: brand, primary New-map button, section nav (All maps shows a live count), and the
// "local & private" footer card.

// `label` is a getter: a plain `label: t("…")` here resolves ONCE at import and never follows a later
// `setLocale`. `id` (the section's identity, also the React key) stays a plain literal.
const NAV: { id: StartSection; label: string }[] = [
  {
    id: "start",
    get label() {
      return t("start.start");
    },
  },
  {
    id: "all",
    get label() {
      return t("toolbar.allMaps");
    },
  },
  {
    id: "recent",
    get label() {
      return t("toolbar.recent");
    },
  },
  {
    id: "templates",
    get label() {
      return t("toolbar.templates");
    },
  },
  {
    id: "examples",
    get label() {
      return t("toolbar.examples");
    },
  },
  {
    id: "layouts",
    get label() {
      return t("start.layouts");
    },
  },
  {
    id: "import",
    get label() {
      return t("start.import");
    },
  },
  {
    id: "about",
    get label() {
      return t("start.about");
    },
  },
  {
    id: "trash",
    get label() {
      return t("start.trash");
    },
  },
];

/** Inline 20×20 line icons for the section nav (stroke = currentColor, so the active emerald tint flows
 *  through via `.st-nav-item[aria-current] .st-nav-icon`). Replaces the earlier Unicode/emoji glyphs,
 *  which rendered inconsistently across platforms (notably the 🕘 clock emoji, which went full-colour). */
function NavIcon({ id }: { id: StartSection }) {
  const s = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  let body: ReactNode;
  switch (id) {
    case "all": // grid of four cards
      body = (
        <>
          <rect {...s} x="3.5" y="3.5" width="5.5" height="5.5" rx="1" />
          <rect {...s} x="11" y="3.5" width="5.5" height="5.5" rx="1" />
          <rect {...s} x="3.5" y="11" width="5.5" height="5.5" rx="1" />
          <rect {...s} x="11" y="11" width="5.5" height="5.5" rx="1" />
        </>
      );
      break;
    case "recent": // clock
      body = (
        <>
          <circle {...s} cx="10" cy="10" r="6.5" />
          <path {...s} d="M10 6.3V10l2.6 1.6" />
        </>
      );
      break;
    case "templates": // window
      body = (
        <>
          <rect {...s} x="3.5" y="4" width="13" height="12" rx="1.5" />
          <path {...s} d="M3.5 7.5h13" />
        </>
      );
      break;
    case "examples": // star
      body = (
        <path
          {...s}
          d="M10 3.4l1.9 3.95 4.35.6-3.15 3.02.75 4.33L10 13.3l-3.85 2 .75-4.33L3.75 7.95l4.35-.6z"
        />
      );
      break;
    case "layouts": // root + two children (an org tree)
      body = (
        <>
          <circle {...s} cx="10" cy="4.8" r="1.8" />
          <circle {...s} cx="5.5" cy="15" r="1.8" />
          <circle {...s} cx="14.5" cy="15" r="1.8" />
          <path {...s} d="M10 6.6v2.4M5.5 13.2V10.5h9v2.7" />
        </>
      );
      break;
    case "import": // download into a tray
      body = (
        <>
          <path {...s} d="M10 3.5v8M6.6 8.1 10 11.5l3.4-3.4" />
          <path {...s} d="M4 15.5h12" />
        </>
      );
      break;
    case "about": // info
      body = (
        <>
          <circle {...s} cx="10" cy="10" r="6.5" />
          <path {...s} d="M10 9.2v3.6" />
          <circle cx="10" cy="6.7" r="0.95" fill="currentColor" />
        </>
      );
      break;
    case "trash": // waste bin
      body = (
        <>
          <path {...s} d="M4.5 6.5h11M8 6.5V5h4v1.5M6 6.5l.7 9h6.6l.7-9" />
          <path {...s} d="M9 9v4M11 9v4" />
        </>
      );
      break;
    default: // "start" → home
      body = <path {...s} d="M3.5 9.5 10 4l6.5 5.5M5.5 8.5V16h9V8.5" />;
  }
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      {body}
    </svg>
  );
}

export function StartSidebar({
  active,
  mapCount,
  onNavigate,
  onNewMap,
  onSettings,
}: {
  active: StartSection;
  mapCount: number;
  onNavigate: (s: StartSection) => void;
  onNewMap: () => void;
  onSettings?: () => void;
}) {
  // Narrow widths collapse the section nav into a slide-in drawer behind a hamburger; this state is
  // inert on desktop (the drawer styles only apply ≤640px, where the toggle is shown).
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <nav className="st-sidebar" aria-label={t("start.startSections")}>
      <div className="st-brand">
        <BrandMark size={36} />
        {t("about.appName")}
      </div>
      <button type="button" className="st-new" onClick={onNewMap}>
        <span aria-hidden="true">＋</span> {t("common.newMap")}
      </button>
      <button
        type="button"
        className="st-hamburger"
        aria-label={t("start.sectionsMenu")}
        aria-expanded={drawerOpen}
        aria-controls="st-nav-drawer"
        onClick={() => setDrawerOpen((v) => !v)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {drawerOpen ? (
        <button
          type="button"
          className="st-nav-backdrop"
          aria-label={t("start.closeSectionsMenu")}
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <div id="st-nav-drawer" className={`st-nav${drawerOpen ? " is-open" : ""}`}>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className="st-nav-item"
            aria-current={active === n.id}
            onClick={() => {
              onNavigate(n.id);
              setDrawerOpen(false);
            }}
          >
            <span className="st-nav-icon" aria-hidden="true">
              <NavIcon id={n.id} />
            </span>
            <span>{n.label}</span>
            {n.id === "all" && mapCount > 0 ? (
              <span className="st-nav-count">{mapCount}</span>
            ) : null}
          </button>
        ))}
        {onSettings && (
          <button
            type="button"
            className="st-nav-item"
            onClick={() => {
              onSettings();
              setDrawerOpen(false);
            }}
          >
            <span className="st-nav-icon" aria-hidden="true">
              <EditorIcon name="settings" size={18} />
            </span>
            <span>{t("settings.title")}</span>
          </button>
        )}
      </div>
      <InstallButton className="st-install" />
      <div className="st-foot">
        <span aria-hidden="true">🔒</span>
        <span>{t("start.localAndPrivate")}</span>
      </div>
    </nav>
  );
}

export { NAV };
