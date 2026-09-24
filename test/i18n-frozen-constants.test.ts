// FROZEN MODULE-LEVEL t() — a real trap, armed for the day a locale picker ships.
//
// `t()` reads the ACTIVE locale at call time. A call inside a render function therefore follows a later
// `setLocale`; a call at module scope runs ONCE, when the module is first imported, and the string it
// returned is frozen into a `const` forever.
//
// CORRECTED 2026-07-27. This comment used to say the frozen strings "happen to be right, because the
// registry resolves the stored locale before any catalogue-consuming module loads". That was FALSE.
// `main.tsx` called `initLocale()` in its body, below `import { App }` — and ES imports are hoisted, so
// the whole eager graph had already evaluated its module-scope `t()` calls against DEFAULT_LOCALE.
// 99 of the 194 froze before resolution ever ran. Fixed by moving the call into the `src/i18n` barrel
// body (see test/i18n-init-order.test.ts); the remaining freeze-at-import behaviour is what this file
// documents.
//
// The trigger is also not what was written here. It is not a language picker — it is `LOCALES`
// (registry.ts) gaining a second entry. `resolveLocale()` consults `navigator.languages`, so the day a
// second catalogue ships, a Danish browser gets a half-English first paint with no user action at all.
// Nothing outside tests calls `setLocale`, which is why this was latent rather than live.
//
// RESOLVED 2026-07-28. All 145 real module-scope `t()` sites (test/i18n-frozen-ratchet.test.ts's
// BUDGET is now empty) were converted to getters — a behaviour-neutral refactor: every read site
// (`obj.label`) is unchanged, only the definition defers evaluation. This file still PINS the
// mechanism in both directions with synthetic examples (so the trap cannot be rediscovered even
// though no real instance of it remains), plus a CLEARANCE test proving actual converted files —
// eager, lazy, and the last one fixed — really do follow a locale change.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Locale, getLocale, registerMessages, setLocale, t } from "../src/i18n";

// A second locale, registered only for this file. `LOCALES` ships `["en"]`, so the cast is how a test
// exercises the multi-locale path before a second catalogue exists — the same shape export-locale.test
// and taskDate.test already use.
const DA = "da" as Locale;

beforeEach(() => setLocale("en"));
afterEach(() => setLocale("en"));

describe("module-level t() freezes the string at import time", () => {
  it("an in-render t() call follows setLocale, a module-level one cannot", () => {
    registerMessages(DA, { "common.grid": "Gitter" });

    // Module scope: evaluated once, right now, under `en`.
    const FROZEN = { label: t("common.grid") };
    // Render scope: evaluated per call.
    const live = () => t("common.grid");

    expect(FROZEN.label).toBe("Grid");
    expect(live()).toBe("Grid");

    setLocale(DA);
    expect(getLocale()).toBe(DA);

    // The live call follows the locale...
    expect(live()).toBe("Gitter");
    // ...and the frozen one is stuck on the locale that was active at import.
    expect(FROZEN.label).toBe("Grid");
  });

  it("CLEARANCE: PANEL_LABELS — the dock tab / Panels menu follow a locale change", async () => {
    // The counterpart to the test above, and the same shape as the CLEARANCE test below: this was the
    // very first file this suite pinned as frozen (see the deleted "would stay English" version of
    // this test, prior to 2026-07-28). It's a getter-backed object now, not an array, so it gets its
    // own pin rather than folding into the array-shaped CLEARANCE test.
    registerMessages(DA, { "panel.outline": "Disposition" });

    // Import AFTER `en` is active, exactly as the app does at boot.
    const { PANEL_LABELS } = await import("../src/panelLabels");
    expect(PANEL_LABELS.outline.tab).toBe("Outline");

    setLocale(DA);

    expect(t("panel.outline")).toBe("Disposition");
    // The dock tab and the Panels-menu label share the same key and now both follow it.
    expect(PANEL_LABELS.outline.tab).toBe("Disposition");
    expect(PANEL_LABELS.outline.menu).toBe("Disposition");
  });

  it("CLEARANCE: the converted files really do follow a locale change", async () => {
    // The counterpart to the two tests above. Those pin the DEFECT on a file that still has it; this
    // pins the FIX on files that were converted, so a later "tidy-up" that turns the getters back into
    // plain properties fails here instead of silently re-freezing.
    //
    // One eager module and one lazy one, because they freeze at different times: an eager module
    // evaluates during app boot, a lazy chunk whenever it first loads. A test that only covered the
    // eager side would pass while every lazy chunk was still broken.
    registerMessages(DA, {
      "app.star": "Stjerne",
      "canvas.addChildTopic": "Tilføj underemne",
    });

    const { STICKERS } = await import("../src/stickers"); // eager
    const { SLASH_COMMANDS } = await import("../src/mindmap/flow/slashCommands"); // lazy chunk
    const star = STICKERS.find((s) => s.id === "star");
    const addChild = SLASH_COMMANDS.find((c) => c.label === "Add child topic");
    expect(star?.label).toBe("Star");
    expect(addChild).toBeDefined();

    setLocale(DA);

    expect(star?.label).toBe("Stjerne");
    expect(SLASH_COMMANDS.find((c) => c.id === addChild?.id)?.label).toBe("Tilføj underemne");
  });

  it("a getter-shaped constant does follow the locale — the fix, pinned", () => {
    registerMessages(DA, { "common.grid": "Gitter" });

    // The shape the 194 sites would need: evaluation deferred to property access.
    const LIVE = {
      get label() {
        return t("common.grid");
      },
    };

    expect(LIVE.label).toBe("Grid");
    setLocale(DA);
    expect(LIVE.label).toBe("Gitter");
  });
});
