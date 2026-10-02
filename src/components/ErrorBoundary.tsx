import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";
import { setTabSession } from "../store/mapStore";

// Top-level safety net. An uncaught error during render would otherwise tear down the React tree and
// leave a blank white screen with no way out. This catches it and shows a recovery panel instead — the
// user's maps live in IndexedDB and are never touched here, so a reload usually recovers. "Start fresh"
// additionally clears the open-tab session and the ?map= deep-link, escaping a crash that one specific
// map triggers on every load. Class component because error boundaries have no hook equivalent.

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private readonly reload = (): void => {
    window.location.reload();
  };

  private readonly startFresh = async (): Promise<void> => {
    try {
      await setTabSession({ openTabIds: [], activeTabId: "" });
    } catch {
      // best-effort — even if clearing the session fails, still drop the deep-link and reload below
    }
    window.location.href = window.location.pathname;
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden="true">
            🧭
          </div>
          <h1 style={h1}>{t("errorBoundary.title")}</h1>
          <p style={p}>{t("errorBoundary.body")}</p>
          <div style={row}>
            <button type="button" onClick={this.reload} style={primaryBtn}>
              {t("errorBoundary.reload")}
            </button>
            <button type="button" onClick={this.startFresh} style={btn}>
              {t("errorBoundary.startFresh")}
            </button>
          </div>
          <details style={{ marginTop: 18, textAlign: "left" }}>
            <summary style={summary}>{t("errorBoundary.details")}</summary>
            <pre style={pre}>{String(error.stack ?? error.message ?? error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}

// Inline styles only — an error fallback must not depend on the app's stylesheet (which may be what
// failed). Colours mirror the warm-cream / emerald theme and meet WCAG AA contrast.
const wrap = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#faf9f5",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "#23211c",
} as const;
const card = {
  maxWidth: 460,
  textAlign: "center",
  background: "#fff",
  border: "1px solid #e7e4dc",
  borderRadius: 16,
  padding: "32px 28px",
  boxShadow: "0 6px 22px rgba(40,30,16,0.08)",
} as const;
const h1 = { margin: "0 0 8px", fontSize: 20 } as const;
const p = { margin: 0, fontSize: 14, lineHeight: 1.5, color: "#5c574e" } as const;
const row = { display: "flex", gap: 10, justifyContent: "center", marginTop: 18 } as const;
const primaryBtn = {
  padding: "8px 18px",
  borderRadius: 8,
  border: "none",
  background: "#1b8a5e",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
} as const;
const btn = {
  padding: "8px 18px",
  borderRadius: 8,
  border: "1px solid #e7e4dc",
  background: "#fff",
  color: "#23211c",
  fontSize: 14,
  cursor: "pointer",
} as const;
const summary = { cursor: "pointer", color: "#706a5f", fontSize: 13 } as const;
const pre = {
  marginTop: 8,
  padding: 12,
  background: "#f4f2ec",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.4,
  overflow: "auto",
  maxHeight: 180,
  color: "#5c574e",
} as const;
