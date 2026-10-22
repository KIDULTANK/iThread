import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { desktopUpdate } = require("../desktop/updates.cjs") as {
  desktopUpdate(
    releases: unknown,
    version: string,
  ): { status: string; url: string; latestVersion?: string };
};

function release(version: string) {
  const tag = `v${version}`;
  const name = `iThread-${version}-Windows-x64-Setup.exe`;
  return {
    tag_name: tag,
    draft: false,
    prerelease: true,
    assets: [
      {
        name,
        size: 100,
        state: "uploaded",
        browser_download_url: `https://github.com/KIDULTANK/iThread/releases/download/${tag}/${name}`,
      },
    ],
  };
}

describe("desktop update selection", () => {
  it("chooses a downloadable Windows preview and ignores a newer Android dev release", () => {
    const result = desktopUpdate(
      [
        { tag_name: "v9.0.0-android-dev.3", assets: [{ name: "app.apk" }] },
        release("0.7.1"),
        release("0.7.0"),
      ],
      "0.7.0",
    );
    expect(result).toMatchObject({
      status: "available",
      latestVersion: "0.7.1",
      url: "https://github.com/KIDULTANK/iThread/releases/tag/v0.7.1",
    });
  });

  it("requires actual Windows installers, not just a version-shaped tag", () => {
    expect(
      desktopUpdate([{ tag_name: "v99.0.0", assets: [] }, release("0.7.0")], "0.7.0").status,
    ).toBe("up-to-date");
  });

  it("compares version numbers numerically and does not downgrade", () => {
    expect(desktopUpdate([release("0.9.0"), release("0.10.0")], "0.9.0").latestVersion).toBe(
      "0.10.0",
    );
    expect(desktopUpdate([release("0.7.0")], "0.8.0").status).toBe("up-to-date");
  });

  it.each([null, {}, [], [{ tag_name: "prefix-v9.0.0", assets: [] }]])(
    "handles an unusable response: %j",
    (releases) => {
      expect(desktopUpdate(releases, "0.7.0").status).toBe("unavailable");
    },
  );

  it.each(["draft", "missing", "uploading", "empty", "untrusted"])("rejects %s assets", (kind) => {
    const item = release("0.8.0");
    if (kind === "draft") item.draft = true;
    if (kind === "missing") item.assets = [];
    if (kind === "uploading") item.assets[0].state = "new";
    if (kind === "empty") item.assets[0].size = 0;
    if (kind === "untrusted") item.assets[0].browser_download_url = "https://example.com/app.exe";
    expect(desktopUpdate([item], "0.7.0").status).toBe("unavailable");
  });

  it("also accepts portable-only Windows releases", () => {
    const item = release("0.8.0");
    item.assets[0].name = item.assets[0].name.replace("Setup", "Portable");
    item.assets[0].browser_download_url = item.assets[0].browser_download_url.replace(
      "Setup",
      "Portable",
    );
    expect(desktopUpdate([item], "0.7.0").status).toBe("available");
  });
});
