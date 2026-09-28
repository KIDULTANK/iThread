import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_EXT,
  downloadMapFile,
  ensureWritePermission,
  isNativeExt,
  openMapFile,
  pickSaveHandle,
  readMapFile,
  readMapFromHandle,
  suggestedFileName,
  supportsFileSystemAccess,
  writeMapToHandle,
} from "../src/io/fileSystem";
import { serializeDoc } from "../src/io/json";
import type { MindMapDoc } from "../src/model/types";

const docOf = (title: string, id = "m1"): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title,
  root: { id: "r", topic: title, children: [{ id: "c", topic: "child", children: [] }] },
});

/** A fake FileSystemFileHandle that records writes and reports a configurable permission state. */
function fakeHandle(name: string, opts: { perm?: PermissionState; content?: string } = {}) {
  const state = { name, written: opts.content ?? "", perm: opts.perm ?? "granted" };
  const requestPermission = vi.fn(async () => {
    state.perm = "granted";
    return "granted" as PermissionState;
  });
  const handle = {
    name,
    kind: "file" as const,
    async getFile() {
      return new File([state.written], name, { type: "application/json" });
    },
    async createWritable() {
      let buf = "";
      return {
        async write(data: string) {
          buf += data;
        },
        async close() {
          state.written = buf;
        },
      };
    },
    async queryPermission() {
      return state.perm;
    },
    requestPermission,
  };
  return { handle: handle as unknown as FileSystemFileHandle, state, requestPermission };
}

describe("suggestedFileName", () => {
  it("uses the title and the native extension", () => {
    expect(suggestedFileName(docOf("My Plan"))).toBe(`My Plan${NATIVE_EXT}`);
  });

  it("strips path-illegal characters", () => {
    expect(suggestedFileName(docOf('a/b:c*?"<>|d'))).toBe(`a_b_c_d${NATIVE_EXT}`);
  });

  it("falls back to 'mindmap' for an empty or dot-only title", () => {
    expect(suggestedFileName(docOf(""))).toBe(`mindmap${NATIVE_EXT}`);
    expect(suggestedFileName(docOf("..."))).toBe(`mindmap${NATIVE_EXT}`);
  });

  it("caps very long titles", () => {
    const name = suggestedFileName(docOf("x".repeat(200)));
    expect(name.length).toBeLessThanOrEqual(80 + NATIVE_EXT.length);
  });
});

describe("supportsFileSystemAccess", () => {
  beforeEach(() => {
    // jsdom doesn't implement the pickers; tests add/remove them explicitly.
    // biome-ignore lint/suspicious/noExplicitAny: deleting optional test-only globals.
    (window as any).showOpenFilePicker = undefined;
    // biome-ignore lint/suspicious/noExplicitAny: deleting optional test-only globals.
    (window as any).showSaveFilePicker = undefined;
  });

  it("is false without the pickers", () => {
    expect(supportsFileSystemAccess()).toBe(false);
  });

  it("is true when both pickers exist", () => {
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi.fn();
    expect(supportsFileSystemAccess()).toBe(true);
  });
});

describe("isNativeExt", () => {
  it("treats .ithread, legacy .mmst and .json as native (case-insensitive)", () => {
    expect(isNativeExt("plan.ithread")).toBe(true);
    expect(isNativeExt("PLAN.ITHREAD")).toBe(true);
    expect(isNativeExt("plan.mmst")).toBe(true);
    expect(isNativeExt("PLAN.MMST")).toBe(true);
    expect(isNativeExt("export.json")).toBe(true);
  });

  it("treats .mmap / .mmp as non-native (one-way import)", () => {
    expect(isNativeExt("legacy.mmap")).toBe(false);
    expect(isNativeExt("old.mmp")).toBe(false);
  });
});

describe("read / write round-trip", () => {
  it("readMapFile parses a serialized doc", async () => {
    const doc = docOf("Round trip");
    const file = new File([serializeDoc(doc)], `x${NATIVE_EXT}`);
    expect(await readMapFile(file)).toMatchObject({ id: "m1", title: "Round trip" });
  });

  it("readMapFromHandle reads through the handle", async () => {
    const { handle } = fakeHandle("a.mmst", { content: serializeDoc(docOf("Via handle")) });
    expect((await readMapFromHandle(handle)).title).toBe("Via handle");
  });

  it("writeMapToHandle writes exactly the serialized bytes", async () => {
    const { handle, state } = fakeHandle("a.mmst");
    const doc = docOf("Persisted");
    await writeMapToHandle(handle, doc);
    expect(state.written).toBe(serializeDoc(doc));
  });
});

describe("ensureWritePermission", () => {
  it("returns true without prompting when already granted", async () => {
    const { handle, requestPermission } = fakeHandle("a.mmst", { perm: "granted" });
    expect(await ensureWritePermission(handle, false)).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("does not prompt in non-interactive mode when not granted", async () => {
    const { handle, requestPermission } = fakeHandle("a.mmst", { perm: "prompt" });
    expect(await ensureWritePermission(handle, false)).toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("prompts in interactive mode and honours the grant", async () => {
    const { handle, requestPermission } = fakeHandle("a.mmst", { perm: "prompt" });
    expect(await ensureWritePermission(handle, true)).toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});

describe("openMapFile / pickSaveHandle", () => {
  it("openMapFile reads a native .ithread as kind 'native'", async () => {
    const { handle } = fakeHandle("open.ithread", { content: serializeDoc(docOf("Opened")) });
    window.showOpenFilePicker = vi.fn(async () => [handle]);
    const res = await openMapFile();
    expect(res?.kind).toBe("native");
    if (res?.kind !== "native") throw new Error("expected native");
    expect(res.doc.title).toBe("Opened");
  });

  it("openMapFile reads a native .mmst as kind 'native' with the doc + handle", async () => {
    const { handle } = fakeHandle("open.mmst", { content: serializeDoc(docOf("Opened")) });
    window.showOpenFilePicker = vi.fn(async () => [handle]);
    const res = await openMapFile();
    expect(res?.kind).toBe("native");
    if (res?.kind !== "native") throw new Error("expected native");
    expect(res.doc.title).toBe("Opened");
    expect(res.handle.name).toBe("open.mmst");
  });

  it("openMapFile classifies a .mmap as kind 'import' (no parse, handle only)", async () => {
    const { handle } = fakeHandle("legacy.mmap", { content: "PK not json" });
    window.showOpenFilePicker = vi.fn(async () => [handle]);
    const res = await openMapFile();
    expect(res?.kind).toBe("import");
    if (res?.kind !== "import") throw new Error("expected import");
    expect(res.handle.name).toBe("legacy.mmap");
    expect(res).not.toHaveProperty("doc"); // parsing/import is deferred to the caller
  });

  it("openMapFile returns null when the user cancels", async () => {
    window.showOpenFilePicker = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    expect(await openMapFile()).toBeNull();
  });

  it("pickSaveHandle returns the chosen handle", async () => {
    const { handle } = fakeHandle("save.mmst");
    window.showSaveFilePicker = vi.fn(async () => handle);
    expect((await pickSaveHandle(docOf("x")))?.name).toBe("save.mmst");
  });

  it("pickSaveHandle returns null when the user cancels", async () => {
    window.showSaveFilePicker = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    expect(await pickSaveHandle(docOf("x"))).toBeNull();
  });

  it("openMapFile rethrows a non-abort picker error (a real failure isn't swallowed)", async () => {
    window.showOpenFilePicker = vi.fn(async () => {
      throw new DOMException("disk on fire", "NotAllowedError");
    });
    await expect(openMapFile()).rejects.toThrow("disk on fire");
  });

  it("openMapFile returns null when the picker yields no handle", async () => {
    window.showOpenFilePicker = vi.fn(async () => []); // nothing selected
    expect(await openMapFile()).toBeNull();
  });

  it("pickSaveHandle rethrows a non-abort picker error", async () => {
    window.showSaveFilePicker = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    await expect(pickSaveHandle(docOf("x"))).rejects.toThrow("denied");
  });
});

describe("downloadMapFile (no-picker fallback)", () => {
  it("serializes the doc to a Blob and triggers an anchor download", () => {
    // jsdom's URL has neither method, so assign fresh mocks (spyOn can't wrap a missing prop).
    const createUrl = vi.fn(() => "blob:fake");
    const revokeUrl = vi.fn();
    URL.createObjectURL = createUrl as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeUrl as unknown as typeof URL.revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue();
    try {
      downloadMapFile(docOf("Saved Local"));
      expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledOnce();
      expect(revokeUrl).toHaveBeenCalledWith("blob:fake"); // object URL is released
    } finally {
      click.mockRestore();
      // biome-ignore lint/performance/noDelete: remove the test-only global so other files stay clean
      delete (URL as { createObjectURL?: unknown }).createObjectURL;
      // biome-ignore lint/performance/noDelete: remove the test-only global so other files stay clean
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
  });
});
