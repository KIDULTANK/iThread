import { t } from "../../../i18n/registry";
import "../messages";
import { InstallButton } from "../../InstallButton";

// Local-first / format-agnostic / open-source blurb, plus the book, user guide, and other resource
// links — mirrors the editor's ⓘ About so the Start screen exposes the same downloads.

// `label` is a getter: a plain `label: t("…")` here resolves ONCE at import and never follows a later
// `setLocale`. `href` (the link target, also the React key) stays a plain literal.
const LINKS: { href: string; label: string }[] = [
  {
    href: "/user-guide.html",
    get label() {
      return t("about.userGuide");
    },
  },
  {
    href: "/Thinking-in-Maps.pdf",
    get label() {
      return t("start.bookThinkingInMapsPdf");
    },
  },
  {
    href: "/Thinking-in-Maps.epub",
    get label() {
      return t("start.bookThinkingInMapsEpub");
    },
  },
  {
    href: "/notices.html",
    get label() {
      return t("about.thirdParty");
    },
  },
  {
    href: "/dashboard.html",
    get label() {
      return t("about.dashboard");
    },
  },
  {
    href: "https://github.com/KIDULTANK/iThread",
    get label() {
      return t("about.source");
    },
  },
];

export function About({ onCheckForUpdates }: { onCheckForUpdates?: () => void }) {
  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("cmd.about")}</h2>
      </section>
      <div className="st-card" style={{ padding: 20 }}>
        <p className="st-prose">
          <strong>{t("about.appName")}</strong> is a local-first, offline mind-mapping studio — a
          self-hosted alternative to MindManager. Your maps live in your browser (IndexedDB) and on
          disk; there are no accounts, no servers, and no telemetry. Nothing leaves this device.
        </p>
        <p className="st-prose">
          It's <strong>format-agnostic</strong>: a single canonical model underneath, with importers
          and exporters for MindManager, Markdown, OPML, FreeMind, Mermaid, XMind and more — so your
          work is never locked in. Install it as a PWA to use it fully offline.
        </p>
        <p className="st-prose">{t("start.openSourceAndASibling")}</p>
      </div>

      <section>
        <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
          Read &amp; reference
        </h3>
        <p className="st-section-sub">
          The companion book <strong>{t("start.thinkingInMaps")}</strong>, the user guide, and more
          — each opens in a new tab.
        </p>
        <div className="st-card" style={{ padding: 16, marginTop: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {LINKS.map((l) => (
              <a
                key={l.href}
                className="st-link"
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
          {t("start.updates")}
        </h3>
        <p className="st-section-sub">
          Installed as a PWA, iThread updates itself; check here to pull a new version now.
        </p>
        <div className="st-card" style={{ padding: 16, marginTop: 10 }}>
          <button type="button" className="st-btn" onClick={() => onCheckForUpdates?.()}>
            {t("about.checkUpdates")}
          </button>
          {/* Renders only when the browser offers installation (or iOS Safari); otherwise nothing. */}
          <InstallButton className="st-install-about" />
        </div>
      </section>

      <div style={{ fontSize: 12.5, color: "var(--st-muted)", lineHeight: 1.6 }}>
        <div>© 2026 Dann Bleeker Pedersen</div>
        <div>{t("start.softwareApacheLicense20")}</div>
      </div>
    </div>
  );
}
