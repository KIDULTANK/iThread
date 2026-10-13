// @vitest-environment node
import { readFileSync } from "node:fs";
// jsdom is supplied by the existing test runtime; no extra production dependency is needed.
// @ts-expect-error This project's jsdom runtime does not ship TypeScript declarations.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/website/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/website/site.js", import.meta.url), "utf8");
function site(language: string, saved?: string, blocked = false, preferences = [language]) {
  const dom = new JSDOM(html, {
    url: "https://kidultank.github.io/iThread/website/",
    runScripts: "outside-only",
  });
  Object.defineProperty(dom.window.navigator, "language", { value: language });
  Object.defineProperty(dom.window.navigator, "languages", { value: preferences });
  if (saved) dom.window.localStorage.setItem("ithread-site-language", saved);
  if (blocked)
    Object.defineProperty(dom.window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  dom.window.eval(script);
  return dom;
}
describe("zero-cost bilingual website", () => {
  it.each([
    [["zh-CN", "en-US"], "zh-CN"],
    [["en-GB", "zh-CN"], "en"],
    [["de-DE", "zh-TW", "en-US"], "zh-CN"],
    [["ZH-Hant-HK", "en"], "zh-CN"],
    [["fr-FR", "de-DE"], "en"],
    [[], "zh-CN"],
  ])("respects ordered browser preferences %j", (preferences, expected) => {
    const dom = site("zh-CN", undefined, false, preferences);
    expect(dom.window.document.documentElement.lang).toBe(expected);
    expect(
      dom.window.document.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toContain(expected === "en" ? "Local-first" : "本地优先");
    dom.window.close();
  });
  it("keeps a saved manual choice ahead of browser preferences", () => {
    const dom = site("zh-CN", "en", false, ["zh-CN", "en-US"]);
    expect(dom.window.document.documentElement.lang).toBe("en");
    dom.window.close();
  });
  it("defaults to Chinese for Chinese devices and English elsewhere", () => {
    const chinese = site("zh-TW");
    const english = site("fr-FR");
    expect(chinese.window.document.documentElement.lang).toBe("zh-CN");
    expect(english.window.document.documentElement.lang).toBe("en");
    for (const el of english.window.document.querySelectorAll("[data-copy]"))
      expect(el.innerHTML).not.toBe("undefined");
    chinese.window.close();
    english.window.close();
  });
  it("switches languages, persists choice and keeps the app route intact", () => {
    const dom = site("en-US", "zh-CN");
    const page = dom.window.document;
    page.querySelector<HTMLButtonElement>('[data-lang="en"]')?.click();
    expect(page.documentElement.lang).toBe("en");
    expect(dom.window.localStorage.getItem("ithread-site-language")).toBe("en");
    expect(page.querySelector<HTMLAnchorElement>('[data-copy="try"]')?.href).toBe(
      "https://kidultank.github.io/iThread/",
    );
    expect(page.querySelector<HTMLAnchorElement>('[data-doc="quickstart"]')?.href).toContain(
      "QUICKSTART.en.md",
    );
    page.querySelector<HTMLButtonElement>('[data-lang="zh-CN"]')?.click();
    expect(page.querySelector<HTMLAnchorElement>('[data-doc="quickstart"]')?.href).toContain(
      "QUICKSTART.zh-CN.md",
    );
    dom.window.close();
  });
  it("works with blocked storage and has no accounts or third-party embeds", () => {
    const dom = site("en", undefined, true);
    const page = dom.window.document;
    page.querySelector<HTMLButtonElement>('[data-lang="zh-CN"]')?.click();
    expect(page.documentElement.lang).toBe("zh-CN");
    expect(page.querySelectorAll("form,iframe").length).toBe(0);
    for (const el of page.querySelectorAll<HTMLScriptElement>("script[src]"))
      expect(el.src).toContain("/iThread/website/");
    expect(page.querySelector<HTMLImageElement>(".brand img")?.src).toContain(
      "/iThread/icon-192.png",
    );
    dom.window.close();
  });
});
