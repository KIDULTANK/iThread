import { useEffect, useRef, useState } from "react";
import { t } from "./i18n";
import { controlStyle } from "./ui";

// A tiny timeboxing widget for brainstorming sessions: pick a preset, count down, get a clear
// "time's up" cue. Self-contained (no model, no persistence) — purely a focus aid in the toolbar.

const PRESETS = [3, 5, 10, 15];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function BrainstormTimer() {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running]);

  const start = (min: number) => {
    setLeft(min * 60);
    setFinished(false);
    setRunning(true);
    setOpen(false);
  };
  const reset = () => {
    setRunning(false);
    setFinished(false);
    setLeft(0);
  };

  const label = finished
    ? `⏱ ${t("toolbar.timerFinished")}`
    : left > 0
      ? `⏱ ${mmss(left)}`
      : `⏱ ${t("toolbar.timer")}`;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("toolbar.timerTitle")}
        style={{
          ...controlStyle,
          fontVariantNumeric: "tabular-nums",
          // Idle keeps the themed controlStyle colours; running/finished tint via the toast tokens
          // so the states stay readable under dark chrome and high contrast.
          ...(finished
            ? {
                background: "var(--ed-toast-error-bg)",
                color: "var(--ed-toast-error-ink)",
                border: "1px solid var(--ed-toast-error-border)",
              }
            : running
              ? { background: "var(--ed-toast-success-bg)" }
              : undefined),
        }}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            background: "var(--ed-card)",
            border: "1px solid var(--ed-border)",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            padding: 8,
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => start(m)}
              style={{ ...controlStyle, padding: "2px 8px", fontSize: 12 }}
            >
              {t("toolbar.timerMinutes", { n: m })}
            </button>
          ))}
          {running ? (
            <button
              type="button"
              onClick={() => setRunning(false)}
              style={{ ...controlStyle, padding: "2px 8px", fontSize: 12 }}
            >
              {t("panel.pause")}
            </button>
          ) : left > 0 && !finished ? (
            <button
              type="button"
              onClick={() => setRunning(true)}
              style={{ ...controlStyle, padding: "2px 8px", fontSize: 12 }}
            >
              {t("toolbar.resume")}
            </button>
          ) : null}
          {(left > 0 || finished) && (
            <button
              type="button"
              onClick={reset}
              style={{ ...controlStyle, padding: "2px 8px", fontSize: 12 }}
            >
              {t("common.reset")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
