import { describe, expect, it, vi } from "vitest";
import { createDesktopFileHandle } from "../src/io/desktopFileHandle";

const encoder = new TextEncoder();

function fixture() {
  const desktop = {
    checkForUpdates: vi.fn(),
    openReleasePage: vi.fn(),
    openFileDialog: vi.fn(),
    saveFileDialog: vi.fn(),
    readBoundFile: vi.fn().mockResolvedValue({
      name: "法律.ithread",
      bytes: encoder.encode('{"title":"after"}'),
      lastModified: 200,
    }),
    writeBoundFile: vi.fn().mockResolvedValue(true),
    onOpenFile: vi.fn(),
  } satisfies IThreadDesktopBridge;
  const handle = createDesktopFileHandle(
    {
      name: "法律.ithread",
      bytes: encoder.encode('{"title":"before"}'),
      token: "opaque-token",
      lastModified: 100,
      writable: true,
    },
    desktop,
  );
  return { desktop, handle };
}

describe("desktop file handle", () => {
  it("reads the launch bytes first, then refreshes through the opaque bridge", async () => {
    const { desktop, handle } = fixture();
    expect(await (await handle.getFile()).text()).toBe('{"title":"before"}');
    expect(desktop.readBoundFile).not.toHaveBeenCalled();
    expect(await (await handle.getFile()).text()).toBe('{"title":"after"}');
    expect(desktop.readBoundFile).toHaveBeenCalledWith("opaque-token");
  });

  it("writes only through the token supplied by the main process", async () => {
    const { desktop, handle } = fixture();
    const writable = await handle.createWritable();
    await writable.write('{"title":"saved"}');
    await writable.close();
    expect(desktop.writeBoundFile).toHaveBeenCalledWith("opaque-token", '{"title":"saved"}');
  });
});
