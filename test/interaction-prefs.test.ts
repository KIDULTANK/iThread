// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_INTERACTION_PREFS,
  INTERACTION_PREF_KEY,
  readInteractionPrefs,
} from "../src/store/interactionPrefs";
import { collectSettings } from "../src/store/settingsFile";

describe("interaction preferences", () => {
  beforeEach(() => localStorage.removeItem(INTERACTION_PREF_KEY));
  it("uses safe defaults for corrupt or unsupported stored values", () => {
    for (const value of [
      "broken",
      "null",
      '{"altDelay":-1,"panSpeed":99,"wheelMode":"bad","altHelp":"false"}',
    ]) {
      localStorage.setItem(INTERACTION_PREF_KEY, value);
      expect(readInteractionPrefs()).toEqual(DEFAULT_INTERACTION_PREFS);
    }
  });
  it("includes interaction preferences in exported preferences", () => {
    const raw = JSON.stringify({ ...DEFAULT_INTERACTION_PREFS, wheelMode: "zoom" });
    localStorage.setItem(INTERACTION_PREF_KEY, raw);
    expect(collectSettings("2026-10-09T00:00:00Z").prefs[INTERACTION_PREF_KEY]).toBe(raw);
  });
});
