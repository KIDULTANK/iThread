// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_PREF_KEY, resolveLocale, setLocale } from "../src/i18n";

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("automatic language selection", () => {
  it.each(["zh-CN", "en"] as const)("uses desktop OS locale %s ahead of Chromium", (locale) => {
    vi.stubGlobal("iThreadDesktop", { systemLocale: locale });
    vi.spyOn(navigator, "languages", "get").mockReturnValue(
      locale === "en" ? ["zh-CN"] : ["en-US"],
    );
    expect(resolveLocale()).toBe(locale);
    expect(localStorage.getItem(LOCALE_PREF_KEY)).toBeNull();
  });

  it.each(["zh-CN", "en"] as const)("preserves the user's saved %s choice", (locale) => {
    vi.stubGlobal("iThreadDesktop", { systemLocale: locale === "en" ? "zh-CN" : "en" });
    setLocale(locale);
    expect(resolveLocale()).toBe(locale);
  });

  it("ignores an invalid saved preference and detects the desktop language", () => {
    localStorage.setItem(LOCALE_PREF_KEY, "invalid");
    vi.stubGlobal("iThreadDesktop", { systemLocale: "zh-CN" });
    expect(resolveLocale()).toBe("zh-CN");
  });

  it.each([
    [["zh-Hans-CN"], "zh-CN"],
    [["zh-TW"], "zh-CN"],
    [["en-GB", "zh-CN"], "en"],
    [["fr-FR", "de-DE"], "en"],
  ])("uses browser preferences %j without a desktop bridge", (languages, expected) => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(languages as string[]);
    expect(resolveLocale()).toBe(expected);
  });

  it("falls back to navigator.language when the browser preference list is empty", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue([]);
    vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
    expect(resolveLocale()).toBe("zh-CN");
  });
});
