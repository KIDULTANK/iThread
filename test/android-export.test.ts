// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveAndroidBlob } from "../src/io/androidDownload";

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: undefined });
});

describe("Android document exports", () => {
  it("sends exact binary bytes and the filename to the native picker", async () => {
    const saveFile = vi.fn(async () => true);
    Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: { saveFile } });
    const blob = {
      size: 3,
      type: "application/octet-stream",
      arrayBuffer: async () => new Uint8Array([0, 128, 255]).buffer,
    } as Blob;
    await saveAndroidBlob(blob, "测试.itmz");
    expect(saveFile).toHaveBeenCalledWith({
      filename: "测试.itmz",
      mime: "application/octet-stream",
      base64: "AID/",
    });
  });
  it("treats a cancelled picker as cancellation, not an error", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    Object.defineProperty(window, "iThreadAndroid", {
      configurable: true,
      value: { saveFile: async () => false },
    });
    await saveAndroidBlob(
      { size: 0, type: "", arrayBuffer: async () => new ArrayBuffer(0) } as Blob,
      "empty.ithread",
    );
    expect(alert).not.toHaveBeenCalled();
  });
  it("reports oversized exports before allocating a base64 payload", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const arrayBuffer = vi.fn();
    await saveAndroidBlob(
      { size: 17 * 1024 * 1024, arrayBuffer } as unknown as Blob,
      "huge.ithread",
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
