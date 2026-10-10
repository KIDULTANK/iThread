import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { shortcutGroups } from "../shortcuts";
import { useInteractionPrefs } from "../store/interactionPrefs";

const ITEMS_PER_PAGE = 10;

function shortcutPages() {
  return shortcutGroups().flatMap((group) => {
    const parts = Math.ceil(group.items.length / ITEMS_PER_PAGE);
    return Array.from({ length: parts }, (_, index) => ({
      id: `${group.id}-${index}`,
      groupId: group.id,
      title: group.title,
      part: index + 1,
      parts,
      items: group.items.slice(index * ITEMS_PER_PAGE, (index + 1) * ITEMS_PER_PAGE),
    }));
  });
}

/** iPad-style shortcut reveal: hold Alt, release it to return immediately to the canvas. */
export function AltShortcutOverlay({ enabled = true }: { enabled?: boolean }) {
  const { prefs } = useInteractionPrefs();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const openRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const altDown = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const close = () => {
      clearTimer();
      openRef.current = false;
      setOpen(false);
    };
    if (!enabled || !prefs.altHelp) {
      altDown.current = false;
      close();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // The visible sheet owns keyboard input, before document/canvas shortcuts receive it.
      if (openRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "ArrowRight") {
          setPage((value) => Math.min(value + 1, shortcutPages().length - 1));
        } else if (event.key === "ArrowLeft") {
          setPage((value) => Math.max(value - 1, 0));
        } else if (event.key === "Escape") {
          cancelled.current = true;
          close();
        }
        return;
      }
      if (event.key === "Alt") {
        if (event.repeat || event.ctrlKey || event.metaKey || event.shiftKey || altDown.current)
          return;
        altDown.current = true;
        cancelled.current = false;
        clearTimer();
        timer.current = setTimeout(() => {
          timer.current = null;
          if (altDown.current && !cancelled.current) {
            setPage(0);
            openRef.current = true;
            setOpen(true);
          }
        }, prefs.altDelay);
        return;
      }
      // Before the hold threshold, ordinary Alt chords still act on the canvas.
      if (altDown.current) {
        cancelled.current = true;
        close();
      } else if (event.key === "Escape") {
        cancelled.current = true;
        close();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (openRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (event.key !== "Alt") return;
      altDown.current = false;
      cancelled.current = false;
      close();
    };
    const onBlur = () => {
      altDown.current = false;
      cancelled.current = false;
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      clearTimer();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, prefs.altHelp, prefs.altDelay]);

  if (!open) return null;
  const pages = shortcutPages();
  const current = pages[Math.min(page, pages.length - 1)];
  const icons: Record<string, string> = {
    editing: "✎",
    selectionMoving: "⌖",
    file: "▤",
    navigation: "➜",
    view: "◉",
  };
  return (
    <div
      className="mm-alt-shortcuts-backdrop"
      onPointerDown={() => {
        openRef.current = false;
        setOpen(false);
      }}
    >
      <dialog
        open
        className="mm-alt-shortcuts-card"
        aria-label={t("cmd.shortcuts")}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="mm-alt-shortcuts-head">
          <div>
            <span className="mm-alt-shortcuts-kicker">{t("cmd.shortcuts")}</span>
            <strong>
              <span aria-hidden="true">{icons[current.groupId] ?? "•"}</span> {current.title}
              {current.parts > 1 ? (
                <small>
                  {current.part}/{current.parts}
                </small>
              ) : null}
            </strong>
          </div>
          <span>
            <kbd>Alt</kbd> {t("shortcuts.releaseAltToClose")}
          </span>
        </header>
        <section key={current.id} className="mm-alt-shortcut-page" aria-label={current.title}>
          <dl className={current.items.length > 5 ? "is-wide" : undefined}>
            {current.items.map((shortcut) => (
              <div key={`${shortcut.keys} ${shortcut.action}`} className="mm-alt-shortcut-item">
                <dt>
                  <kbd>{shortcut.keys}</kbd>
                </dt>
                <dd>{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </section>
        <footer className="mm-alt-shortcuts-pager">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
            {t("common.prev")}
          </button>
          <div className="mm-alt-shortcuts-dots" aria-label={t("shortcuts.pageIndicator")}>
            {pages.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === page ? "is-active" : undefined}
                aria-label={`${index + 1} / ${pages.length} · ${item.title}${item.parts > 1 ? ` ${item.part}/${item.parts}` : ""}`}
                aria-current={index === page ? "page" : undefined}
                onClick={() => setPage(index)}
              />
            ))}
          </div>
          <span className="mm-alt-shortcuts-count">
            {page + 1} / {pages.length}
          </span>
          <button
            type="button"
            disabled={page === pages.length - 1}
            onClick={() => setPage((value) => value + 1)}
          >
            {t("common.next")}
          </button>
        </footer>
      </dialog>
    </div>
  );
}
