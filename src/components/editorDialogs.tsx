import { useEffect, useRef, useState } from "react";
import { Button, Input } from "../design/primitives";
import { colors, space } from "../design/tokens";
import { t } from "../i18n";
import { Dialog } from "./Dialog";

// Themed prompt / confirm for the editor canvas — replacing the native window.prompt / window.confirm
// that ignore the app theme (jarring white boxes in dark mode) and, in some PWAs, return null silently.
// Start was already migrated (MapDialogs); this is the same idea for the editor, skinned with --ed-*.
//
// The native calls are *synchronous* (`const x = window.prompt(...)` then branch inline), so the clean
// drop-in is a promise-based imperative API: `const x = await editorPrompt({...})`. A single mounted
// <DialogHost/> registers its request handler in a module singleton, so any call site — component or
// plain hook (useVersionHistory) — can await a dialog without prop-drilling. One dialog at a time is
// enough (these are user-initiated and never concurrent); a second request resolves the first as cancel.

export interface PromptOptions {
  title: string;
  /** Accessible label for the text field (defaults to the title). */
  label?: string;
  /** Pre-filled value. */
  defaultValue?: string;
  placeholder?: string;
  /** Confirm-button text (default "OK"). */
  confirmText?: string;
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** Confirm-button text (default "OK"). */
  confirmText?: string;
  /** Render the confirm button in the danger colour (deletes / destructive actions). */
  danger?: boolean;
}

type PromptRequest = { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };
type ConfirmRequest = { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void };
type Request = PromptRequest | ConfirmRequest;

// The host installs this; the editor* helpers call it. Null until <DialogHost/> mounts (in which case
// we degrade to the native dialog so a call is never silently dropped before the host is ready).
let enqueue: ((req: Request) => void) | null = null;

/** Themed text prompt. Resolves to the entered string, or null if cancelled/dismissed. */
export function editorPrompt(opts: PromptOptions): Promise<string | null> {
  if (!enqueue) {
    const v = window.prompt(opts.title, opts.defaultValue ?? "");
    return Promise.resolve(v);
  }
  return new Promise((resolve) => enqueue?.({ kind: "prompt", opts, resolve }));
}

/** Themed yes/no confirm. Resolves true on confirm, false on cancel/dismiss. */
export function editorConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (!enqueue)
    return Promise.resolve(window.confirm([opts.title, opts.body].filter(Boolean).join("\n\n")));
  return new Promise((resolve) => enqueue?.({ kind: "confirm", opts, resolve }));
}

/** Mount once inside `.mm-editor`. Renders the active prompt/confirm dialog and routes its result back
 *  to the awaiting caller. */
export function DialogHost() {
  // `seq` bumps on each new request so the uncontrolled prompt input remounts with its fresh
  // defaultValue (no controlled-state seeding race — the value lives in the DOM, read on confirm).
  const [req, setReq] = useState<{ r: Request; seq: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    enqueue = (next) => {
      // A new request supersedes any open one — resolve the old as a cancel so its awaiter unblocks.
      setReq((prev) => {
        if (prev?.r.kind === "prompt") prev.r.resolve(null);
        else if (prev?.r.kind === "confirm") prev.r.resolve(false);
        return { r: next, seq: (prev?.seq ?? 0) + 1 };
      });
    };
    return () => {
      enqueue = null;
    };
  }, []);

  const close = (result: string | null | boolean) => {
    setReq((cur) => {
      if (cur?.r.kind === "prompt") cur.r.resolve(result as string | null);
      else if (cur?.r.kind === "confirm") cur.r.resolve(result as boolean);
      return null;
    });
  };

  if (!req) return null;

  const surface = { maxWidth: 420, width: "calc(100% - 32px)", padding: space.xxxl } as const;

  if (req.r.kind === "prompt") {
    const { opts } = req.r;
    return (
      <Dialog
        open
        onClose={() => close(null)}
        title={opts.title}
        style={surface}
        onOpen={() => requestAnimationFrame(() => inputRef.current?.select())}
      >
        <Input
          key={req.seq}
          ref={inputRef}
          defaultValue={opts.defaultValue ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") close(inputRef.current?.value ?? "");
          }}
          placeholder={opts.placeholder}
          aria-label={opts.label ?? opts.title}
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        <div
          style={{
            display: "flex",
            gap: space.lg,
            justifyContent: "flex-end",
            marginTop: space.xxxl,
          }}
        >
          <Button onClick={() => close(null)}>{t("common.cancel")}</Button>
          <Button
            onClick={() => close(inputRef.current?.value ?? "")}
            style={{
              background: colors.accent,
              color: colors.white,
              border: `1px solid ${colors.accent}`,
            }}
          >
            {opts.confirmText ?? t("common.ok")}
          </Button>
        </div>
      </Dialog>
    );
  }

  const { opts } = req.r;
  return (
    <Dialog open onClose={() => close(false)} title={opts.title} style={surface}>
      {opts.body && (
        <p style={{ margin: 0, color: colors.muted, lineHeight: 1.45, whiteSpace: "pre-line" }}>
          {opts.body}
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: space.lg,
          justifyContent: "flex-end",
          marginTop: space.xxxl,
        }}
      >
        <Button onClick={() => close(false)}>{t("common.cancel")}</Button>
        <Button
          onClick={() => close(true)}
          style={
            opts.danger
              ? {
                  background: colors.danger,
                  color: colors.white,
                  border: `1px solid ${colors.danger}`,
                }
              : {
                  background: colors.accent,
                  color: colors.white,
                  border: `1px solid ${colors.accent}`,
                }
          }
        >
          {opts.confirmText ?? t("common.ok")}
        </Button>
      </div>
    </Dialog>
  );
}
