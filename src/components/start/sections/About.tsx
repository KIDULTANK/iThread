import { t } from "../../../i18n/registry";
import "../messages";
import { InstallButton } from "../../InstallButton";

export function About({ onCheckForUpdates }: { onCheckForUpdates?: () => void }) {
  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("cmd.about")}</h2>
      </section>
      <div className="st-card" style={{ padding: 20 }}>
        <p className="st-prose">{t("start.aboutLocalFirst", { app: t("about.appName") })}</p>
        <p className="st-prose">{t("start.aboutFormats")}</p>
        <p className="st-prose">{t("start.openSourceAndASibling")}</p>
      </div>

      <section>
        <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
          {t("start.updates")}
        </h3>
        <p className="st-section-sub">{t("start.updateBlurb")}</p>
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
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <a
            className="st-link"
            href="https://github.com/KIDULTANK/iThread"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("about.source")}
          </a>
          <a
            className="st-link"
            href={`${import.meta.env.BASE_URL}notices.html`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("about.thirdParty")}
          </a>
        </div>
      </div>
    </div>
  );
}
