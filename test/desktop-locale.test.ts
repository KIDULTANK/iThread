// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { selectSystemLocale } = require("../desktop/locale.cjs") as {
  selectSystemLocale(languages: string[]): "en" | "zh-CN";
};
const preload = readFileSync(new URL("../desktop/preload.cjs", import.meta.url), "utf8");

describe("desktop initial language bridge", () => {
  it.each([
    [["zh-CN", "en-US"], "zh-CN"],
    [["zh-Hant-TW"], "zh-CN"],
    [["ZH_HK"], "zh-CN"],
    [["en-US", "zh-CN"], "en"],
    [["fr-FR", "zh-CN"], "en"],
    [[], "en"],
  ])("selects %j from the first system language", (languages, expected) => {
    expect(selectSystemLocale(languages as string[])).toBe(expected);
  });

  it.each(["en", "zh-CN", "invalid", ""])(
    "exposes only a supported startup locale: %s",
    (locale) => {
      const expose = vi.fn();
      runInNewContext(preload, {
        process: { argv: ["electron", `--ithread-system-locale=${locale}`] },
        require: () => ({
          contextBridge: { exposeInMainWorld: expose },
          ipcRenderer: { on: vi.fn(), invoke: vi.fn() },
        }),
      });
      expect(expose).toHaveBeenCalledWith(
        "iThreadDesktop",
        expect.objectContaining({
          systemLocale: locale === "en" || locale === "zh-CN" ? locale : undefined,
        }),
      );
    },
  );
});
