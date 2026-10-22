import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { isOpenableFile, isWritableFile, openFileFilters } =
  require("../desktop/file-policy.cjs") as {
    isOpenableFile(path: unknown): boolean;
    isWritableFile(path: unknown): boolean;
    openFileFilters(locale: string): { name: string; extensions: string[] }[];
  };

describe("desktop file policy", () => {
  it.each(["法学.ITMZ", "outline.md", "notes.MARKDOWN", "map.mmap", "map.mmp"])(
    "opens %s as read-only input",
    (name) => {
      expect(isOpenableFile(name)).toBe(true);
      expect(isWritableFile(name)).toBe(false);
    },
  );
  it.each(["map.ithread", "map.MMST", "map.json"])("retains save-back for %s", (name) => {
    expect(isOpenableFile(name)).toBe(true);
    expect(isWritableFile(name)).toBe(true);
  });
  it.each([null, undefined, "app.exe", "map.itmz.exe", "map.md/other.exe"])(
    "rejects unsupported input %j",
    (name) => {
      expect(isOpenableFile(name)).toBe(false);
      expect(isWritableFile(name)).toBe(false);
    },
  );
  it("provides a combined filter and readable Chinese/English format groups", () => {
    expect(openFileFilters("zh-CN")[0].extensions).toEqual(
      expect.arrayContaining(["itmz", "md", "markdown", "ithread"]),
    );
    expect(
      openFileFilters("zh-CN")
        .map((filter) => filter.name)
        .join(" "),
    ).toContain("Markdown 大纲");
    expect(openFileFilters("en")[0].name).toBe("All supported maps");
  });
});
