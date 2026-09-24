import { t } from "../i18n/registry";
import "./presentMessages";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapNode, MindMapDoc } from "../model/types";
import { renderNote } from "../noteFormat";
import { presenterContext } from "./presenter";
import { type Slide, resolveSlides } from "./slides";
import { mmss, pacingColor } from "./timer";

function Bullets({ node }: { node: MapNode }) {
  if (node.children.length === 0) return null;
  return (
    <ul style={{ margin: "0.3em 0", paddingLeft: "1.2em", lineHeight: 1.6 }}>
      {node.children.map((child) => (
        <li key={child.id} style={{ marginBottom: "0.2em" }}>
          {child.topic}
          <Bullets node={child} />
        </li>
      ))}
    </ul>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "#1f1b4d",
  color: "#f5f4ff",
  display: "flex",
  flexDirection: "column",
  font: "16px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

const ctrlStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#f5f4ff",
  border: "1px solid #4a4490",
  background: "#2a2560",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
} as const;

// The presenter-view toggle when it is ON — a brighter, "pressed" variant so the
// presenter can tell at a glance that the sidebar chrome is showing.
const ctrlOnStyle = {
  ...ctrlStyle,
  background: "#5a52c0",
  border: "1px solid #7d75e0",
} as const;

// Presenter sidebar section heading — small, muted, uppercase label.
const sectionLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#9a93e0",
  margin: "0 0 0.5em",
} as const;

function PresenterSidebar({
  slides,
  index,
  onJump,
  elapsed,
  budgetMin,
  onBudgetChange,
}: {
  slides: Slide[];
  index: number;
  onJump: (i: number) => void;
  /** Seconds elapsed since Present began — the big pacing clock. */
  elapsed: number;
  /** Total-talk budget in minutes (0 = off); drives the pacing colour + the over/under readout. */
  budgetMin: number;
  onBudgetChange: (next: number) => void;
}) {
  const ctx = presenterContext(slides, index);
  const clockColor = pacingColor(elapsed, budgetMin * 60);
  return (
    <aside
      aria-label={t("present.presenterView")}
      style={{
        width: "clamp(280px, 30vw, 420px)",
        flexShrink: 0,
        borderLeft: "1px solid #4a4490",
        background: "#171339",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        padding: "24px 22px",
        gap: 28,
      }}
    >
      {/* 1. Speaker notes for the current slide. */}
      <section>
        <h2 style={sectionLabelStyle}>{t("present.speakerNotes")}</h2>
        {ctx.notes ? (
          <div
            style={{ fontSize: 16, lineHeight: 1.65, color: "#ecebfb" }}
            // Same trusted, sanitised renderer the Notes panel uses (HTML is
            // escaped before the markdown transforms) — no XSS surface here.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: renderNote escapes HTML first.
            dangerouslySetInnerHTML={{ __html: renderNote(ctx.notes) }}
          />
        ) : (
          <p style={{ fontSize: 15, color: "#7e78b8", fontStyle: "italic", margin: 0 }}>
            {t("present.noNotesForThisSlide")}
          </p>
        )}
      </section>

      {/* 2. Peek at what's coming next. */}
      <section>
        <h2 style={sectionLabelStyle}>{t("present.nextUp")}</h2>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#fff", margin: 0 }}>
          {ctx.nextHeading ?? (
            <span style={{ color: "#7e78b8", fontWeight: 400 }}>{t("present.endOfMap")}</span>
          )}
        </p>
      </section>

      {/* 3. Pacing timer — elapsed clock (coloured vs the budget) + a total-talk budget stepper. */}
      <section>
        <h2 style={sectionLabelStyle}>{t("toolbar.timer")}</h2>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: clockColor,
              lineHeight: 1,
            }}
          >
            {mmss(elapsed)}
          </span>
          {budgetMin > 0 && (
            <span style={{ fontSize: 14, color: "#9a93e0", fontVariantNumeric: "tabular-nums" }}>
              {elapsed > budgetMin * 60 ? "+" : "−"}
              {mmss(Math.abs(budgetMin * 60 - elapsed))}{" "}
              {elapsed > budgetMin * 60 ? "over" : "left"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: "#9a93e0" }}>{t("present.budget")}</span>
          <button
            type="button"
            aria-label={t("present.decreaseBudget")}
            onClick={() => onBudgetChange(Math.max(0, budgetMin - 5))}
            style={ctrlStyle}
          >
            −5
          </button>
          <span
            style={{ fontSize: 14, color: "#ecebfb", minWidth: 64, textAlign: "center" }}
            aria-live="polite"
          >
            {budgetMin > 0 ? `${budgetMin} min` : "off"}
          </span>
          <button
            type="button"
            aria-label={t("present.increaseBudget")}
            onClick={() => onBudgetChange(budgetMin + 5)}
            style={ctrlStyle}
          >
            +5
          </button>
        </div>
      </section>

      {/* 4. Agenda — the "map" of the talk; current slide highlighted, click to jump. */}
      <section style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <h2 style={sectionLabelStyle}>
          {t("app.agenda")}{" "}
          <span style={{ color: "#6d68a8" }}>
            · {index + 1} / {slides.length}
          </span>
        </h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {ctx.agenda.map((item) => (
            <li key={item.index}>
              <button
                type="button"
                onClick={() => onJump(item.index)}
                aria-current={item.current ? "true" : undefined}
                style={{
                  display: "flex",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontSize: 14,
                  lineHeight: 1.4,
                  background: item.current ? "#3a3488" : "transparent",
                  color: item.current ? "#fff" : "#c4bff0",
                  fontWeight: item.current ? 700 : 400,
                }}
              >
                <span
                  style={{
                    color: item.current ? "#cfcaf8" : "#6d68a8",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.index + 1}
                </span>
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {item.heading}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

export function Presentation({ doc, onExit }: { doc: MindMapDoc; onExit: () => void }) {
  const slides = resolveSlides(doc);
  const [index, setIndex] = useState(0);
  const [presenter, setPresenter] = useState(false);
  // Presenter pacing timer: seconds elapsed since entering Present, a running/paused flag, and an
  // optional total-talk budget (minutes; 0 = off) that drives the green→amber→red pacing colour.
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [budgetMin, setBudgetMin] = useState(0);
  // Blackout: B blacks the screen / W whites it (a standard "pull attention to the speaker" control);
  // any key (or a click) resumes. Held separately so it overlays both the audience slide + sidebar.
  const [blackout, setBlackout] = useState<"black" | "white" | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus management for the full-screen overlay (it behaves as a modal dialog): move focus into it on
  // enter so keyboard + screen-reader users land inside the presentation, and restore focus to whatever
  // was focused before (the canvas / the menu item that opened it) on exit, instead of stranding it.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => prevFocus?.focus?.();
  }, []);

  // True OS fullscreen for the presentation (graceful when unavailable/denied). Present is entered via
  // a click, so the requestFullscreen gesture requirement is met; we still swallow the promise rejection
  // (e.g. an iframe without allow="fullscreen", or a policy/user denial) and just stay windowed. Kept
  // separate from the focus effect so a fullscreen failure can never affect focus restore.
  useEffect(() => {
    overlayRef.current?.requestFullscreen?.().catch(() => {});
    return () => {
      // Only exit if we're still the fullscreen element (avoids InvalidStateError when nothing is).
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, slides.length - 1)),
    [slides.length],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const togglePresenter = useCallback(() => setPresenter((p) => !p), []);

  // Tick the elapsed clock once a second while running (paused or not, the screen can be blacked out —
  // time still passes, matching a real presenter clock).
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // While blacked/whited out, any key but Esc just resumes the slide (Esc still exits Present).
      if (blackout && e.key !== "Escape") {
        e.preventDefault();
        setBlackout(null);
        return;
      }
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePresenter();
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setBlackout("black");
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        setBlackout("white");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onExit, togglePresenter, blackout]);

  const slide = slides[index];
  const clockColor = pacingColor(elapsed, budgetMin * 60);

  return (
    <div
      ref={overlayRef}
      style={overlayStyle}
      // biome-ignore lint/a11y/useSemanticElements: a custom full-screen overlay, not a native <dialog>
      // (we don't want showModal/top-layer/backdrop semantics) — role="dialog" + aria-modal is correct.
      role="dialog"
      aria-modal="true"
      aria-label={t("toolbar.exportGroup.presentation")}
      tabIndex={-1}
    >
      {/* The audience slide + the (optional) presenter sidebar share one row, so
          turning on presenter view never changes the slide content itself. */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px clamp(24px, 8vw, 120px)",
            maxWidth: 1000,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", margin: "0 0 0.4em", color: "#fff" }}>
            {slide.heading}
          </h1>
          {slide.isOverview ? (
            <ul style={{ fontSize: "clamp(16px, 2.4vw, 24px)", lineHeight: 1.8, color: "#cecbf6" }}>
              {doc.root.children.map((child) => (
                <li key={child.id}>{child.topic}</li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: "clamp(15px, 2vw, 21px)", color: "#e8e6f7" }}>
              <Bullets node={slide.node} />
            </div>
          )}
        </div>

        {presenter && (
          <PresenterSidebar
            slides={slides}
            index={index}
            onJump={setIndex}
            elapsed={elapsed}
            budgetMin={budgetMin}
            onBudgetChange={setBudgetMin}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          borderTop: "1px solid #4a4490",
        }}
      >
        <button type="button" onClick={prev} disabled={index === 0} style={ctrlStyle}>
          {t("common.prev")}
        </button>
        <span style={{ fontSize: 13, color: "#cecbf6" }}>
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={index === slides.length - 1}
          style={ctrlStyle}
        >
          {t("common.next")}
        </button>
        <span
          aria-label={t("present.elapsedNamed", { time: mmss(elapsed) })}
          title={t("present.elapsedTimeSetABudget")}
          style={{
            fontSize: 15,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: clockColor,
            minWidth: 52,
            textAlign: "center",
          }}
        >
          {mmss(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          aria-pressed={!running}
          aria-label={running ? t("present.pauseTimer") : t("present.resumeTimer")}
          title={running ? t("present.pauseTimer") : t("present.resumeTimer")}
          style={ctrlStyle}
        >
          {running ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => {
            setElapsed(0);
            setRunning(true);
          }}
          aria-label={t("present.resetTimer")}
          title={t("present.resetTimer")}
          style={ctrlStyle}
        >
          ↺
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#7e78b8", letterSpacing: "0.02em" }}>
          {t("present.homeSpacePBW")}
        </span>
        <button
          type="button"
          onClick={togglePresenter}
          aria-pressed={presenter}
          title={t("present.togglePresenterViewP")}
          style={presenter ? ctrlOnStyle : ctrlStyle}
        >
          {t("present.presenterViewP")}
        </button>
        <button type="button" onClick={onExit} style={ctrlStyle}>
          {t("app.exitEsc")}
        </button>
      </div>

      {/* Blackout / whiteout — covers the whole screen (slide + sidebar + footer); click or any key
          resumes. A plain coloured curtain to pull attention to the speaker. */}
      {blackout && (
        <button
          type="button"
          aria-label={
            blackout === "black" ? t("present.blackScreenHint") : t("present.whiteScreenHint")
          }
          onClick={() => setBlackout(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            border: "none",
            cursor: "pointer",
            background: blackout === "black" ? "#000" : "#fff",
          }}
        />
      )}
    </div>
  );
}
