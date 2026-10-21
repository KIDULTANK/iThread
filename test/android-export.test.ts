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
    const blob = new Blob([new Uint8Array([0, 128, 255])], { type: "application/octet-stream" });
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
    expect(await saveAndroidBlob(new Blob([]), "empty.ithread")).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });
  it.each(["error", "abort"])("does not open a picker after a reader %s", async (kind) => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const saveFile = vi.fn();
    Object.defineProperty(window, "iThreadAndroid", { configurable: true, value: { saveFile } });
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new Event(kind));
    });
    expect(await saveAndroidBlob(new Blob(["sample"]), "sample.ithread")).toBe(false);
    expect(saveFile).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledOnce();
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
