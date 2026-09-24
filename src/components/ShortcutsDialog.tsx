import { t } from "../i18n";
import { shortcutGroups } from "../shortcuts";
import { Dialog } from "./Dialog";

// The keyboard-shortcut cheat sheet (#2). Opened from the icon-rail (?) button and ⌘K; rendered from
// the centralized shortcutGroups() table so it can never drift from the real bindings. Controlled like the
// other app dialogs (always mounted, `open` flipped); theme-reactive via the .mm-shortcuts* classes.

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("cmd.shortcuts")}
      ariaLabel={t("cmd.shortcuts")}
      style={{
        boxShadow: "var(--ed-shadow-pop, 0 20px 60px rgba(0,0,0,0.28))",
        padding: "20px 22px",
        maxWidth: 520,
        width: "calc(100% - 32px)",
        background: "var(--ed-card)",
        color: "var(--ed-ink)",
      }}
    >
      <ShortcutSheet />
    </Dialog>
  );
}

/** Shared shortcut content used by both the persistent dialog and the hold-Alt overlay. */
export function ShortcutSheet() {
  return (
    <div className="mm-shortcuts">
      {shortcutGroups().map((group) => (
        <section key={group.id} className="mm-shortcuts-group">
          <h3>{group.title}</h3>
          <dl>
            {group.items.map((s) => (
              // Key on keys+action: a single action can have two bindings (e.g. Tab and
              // Ctrl/⌘+Enter both "Add a child topic"), so `action` alone is not unique.
              <div key={`${s.keys} ${s.action}`} className="mm-shortcut-row">
                <dt>
                  <kbd>{s.keys}</kbd>
                </dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
