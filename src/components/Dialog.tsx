import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { Button } from "../design/primitives";
import { radius, space, typeScale } from "../design/tokens";
import { t } from "../i18n";

// A controlled wrapper around the native <dialog> element. Driving a real <dialog> via showModal()
// gives us the top-layer backdrop, focus trap, and Escape-to-close for free; this component owns that
// mechanic so call-sites no longer hand-roll a showModal()/close() useEffect each. It's a behaviour-
// preserving extraction of the three identical effects that previously lived in App.tsx.
//
// Controlled: render it always-mounted and flip `open`. The internal effect calls showModal()/close()
// to match, and the native `close` event (fired by Escape, a form `method="dialog"` submit, or our own
// .close()) is wired to `onClose` so React state stays in sync — exactly what the old effects' close
// branches did.

export interface DialogProps {
  /** Whether the modal is shown. The wrapper calls showModal()/close() to match. */
  open: boolean;
  /** Fired when the dialog closes itself (Escape, backdrop, or a close button calling .close()).
   *  Wire this to your `setOpen(false)` so the controlled `open` prop follows the native state. */
  onClose: () => void;
  /** Run once each time the dialog has just been shown (after showModal()). Use for on-open side
   *  effects the old effects did inline — focusing the first field, lazy-loading content, etc. */
  onOpen?: () => void;
  /** Optional convenience header: a bold title + a ✕ close button. Omit it to let `children` own all
   *  of the dialog's content (header included), which keeps a bespoke layout pixel-identical. */
  title?: ReactNode;
  /** Accessible name when there's no visible `title` (mirrors the old `aria-label` on <dialog>). */
  ariaLabel?: string;
  /** Merged last onto the dialog's base style, so callers set their own width / padding / max-width. */
  style?: CSSProperties;
  children: ReactNode;
}

// The shared modal surface — only the bits all three dialogs already had in common: a borderless
// card with the same 12px corner radius. The drop shadow and ink text colour vary per dialog (the
// Paste sheet has neither), so callers pass those through `style` rather than the base imposing them.
const DIALOG_BASE: CSSProperties = {
  border: "none",
  borderRadius: radius.xl,
  // Themed surface by default so every dialog follows the app appearance (Phase 8) — without this a
  // native <dialog> falls back to the UA white background, which is unreadable in dark mode. Callers
  // can still override. Fallbacks keep it correct if ever rendered outside the .mm-editor token scope.
  background: "var(--ed-card, #fff)",
  color: "var(--ed-ink, #23211c)",
};

export function Dialog({ open, onClose, onOpen, title, ariaLabel, style, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire only on the open/close transition, not when a parent passes a fresh onOpen closure each render (matches the old per-`open` effects).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      onOpen?.();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    // The onClick closes on a backdrop (click-outside) — the convention every modal follows. A native
    // <dialog> reports a backdrop click with the dialog itself as the target; a click on the content
    // bubbles up with a child target (ignored), and a click on the dialog's own padding lands inside its
    // box (kept open via the rect check). The keyboard equivalent (Escape) is handled natively + wired
    // to onClose, so the mouse-only backdrop click is safe.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape (the keyboard dismiss) is handled natively.
    <dialog
      ref={ref}
      aria-label={ariaLabel}
      onClose={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        const outside =
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (outside) onClose();
      }}
      style={{ ...DIALOG_BASE, ...style }}
    >
      {title != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space.lg,
            marginBottom: space.xl,
          }}
        >
          <strong style={{ ...typeScale.title, flex: 1 }}>{title}</strong>
          <Button onClick={onClose} aria-label={t("common.closeDialog")}>
            ✕
          </Button>
        </div>
      )}
      {children}
    </dialog>
  );
}
