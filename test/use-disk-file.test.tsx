import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "../src/io/fileSystem";
import type { MindMapDoc } from "../src/model/types";

// useDiskFile owns the File System Access layer (open / save / save-as / silent autosave-to-file) with
// download/import fallbacks. The fileSystem + store + lazy-importer modules are mocked so each branch is
// driven deterministically without a real picker or IndexedDB.

vi.mock("../src/io/fileSystem", () => ({
  supportsFileSystemAccess: vi.fn(() => true),
  openMapFile: vi.fn(),
  pickSaveHandle: vi.fn(),
  writeMapToHandle: vi.fn(async () => {}),
  readMapFromHandle: vi.fn(),
  ensureWritePermission: vi.fn(async () => true),
  downloadMapFile: vi.fn(),
  suggestedFileName: vi.fn(() => "map.mmst"),
}));
vi.mock("../src/store/mapStore", () => ({
  saveMapHandle: vi.fn(async () => {}),
  noteRecentFile: vi.fn(async () => {}),
  loadMapHandle: vi.fn(async () => null),
}));
const { editorConfirmMock } = vi.hoisted(() => ({ editorConfirmMock: vi.fn() }));
vi.mock("../src/components/editorDialogs", () => ({ editorConfirm: editorConfirmMock }));
vi.mock("../src/import/mmap", () => ({
  parseMmap: vi.fn(() => ({
    doc: { id: "", title: "Imp", root: { id: "r", topic: "R", children: [] }, schemaVersion: 1 },
    warnings: ["lost X"],
  })),
}));

import { useDiskFile } from "../src/hooks/useDiskFile";
import * as store from "../src/store/mapStore";

const mocked = fs as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockedStore = store as unknown as Record<string, ReturnType<typeof vi.fn>>;
const doc = (): MindMapDoc => ({
  id: "m1",
  title: "T",
  root: { id: "r", topic: "R", children: [] },
  schemaVersion: 1,
});
const fakeHandle = (name = "map.mmst") => ({ name }) as unknown as FileSystemFileHandle;

function setup(d: MindMapDoc = doc()) {
  const deps = {
    liveDocRef: { current: d },
    load: vi.fn(),
    setView: vi.fn(),
    setFileName: vi.fn(),
    setDirty: vi.fn(),
    setError: vi.fn(),
    showHint: vi.fn(),
  };
  const hook = renderHook(() => useDiskFile(deps));
  return { ...hook, deps };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.supportsFileSystemAccess.mockReturnValue(true);
  mocked.ensureWritePermission.mockResolvedValue(true);
  mocked.downloadMapFile.mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks?.());

describe("useDiskFile — save / save-as", () => {
  it("does not announce a completed export before the native document picker finishes", async () => {
    mocked.supportsFileSystemAccess.mockReturnValue(false);
    let finish: (value: boolean) => void = () => {};
    mocked.downloadMapFile.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    );
    const { result, deps } = setup();
    let saving: Promise<void> | undefined;
    act(() => {
      saving = result.current.saveFileAs();
    });
    expect(deps.showHint).not.toHaveBeenCalled();
    await act(async () => {
      finish(false);
      await saving;
    });
    expect(deps.showHint).not.toHaveBeenCalled();
  });
  it("Save As writes to a picked handle, binds it, and clears dirty", async () => {
    mocked.pickSaveHandle.mockResolvedValue(fakeHandle("plan.mmst"));
    const { result, deps } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    });
    expect(mocked.writeMapToHandle).toHaveBeenCalledTimes(1);
    expect(deps.setFileName).toHaveBeenCalledWith("plan.mmst"); // bindFileHandle reflects the name
    expect(deps.setDirty).toHaveBeenCalledWith(false);
    expect(deps.showHint).toHaveBeenCalledWith("Saved plan.mmst");
  });

  it("Save As is a no-op on a cancelled picker", async () => {
    mocked.pickSaveHandle.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    });
    expect(mocked.writeMapToHandle).not.toHaveBeenCalled();
  });

  it("falls back to a download when the File System Access API is absent", async () => {
    mocked.supportsFileSystemAccess.mockReturnValue(false);
    const { result, deps } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    });
    expect(mocked.downloadMapFile).toHaveBeenCalledTimes(1);
    expect(mocked.pickSaveHandle).not.toHaveBeenCalled();
    expect(deps.showHint).toHaveBeenCalledWith("Downloaded map.mmst");
  });

  it("Save defers to Save As when no handle is bound, then writes silently once bound", async () => {
    mocked.pickSaveHandle.mockResolvedValue(fakeHandle("p.mmst"));
    const { result } = setup();
    await act(async () => {
      await result.current.saveFile();
    }); // no handle → Save As path
    expect(mocked.pickSaveHandle).toHaveBeenCalledTimes(1);
    // Now a handle is cached → a second Save writes directly, no picker.
    await act(async () => {
      await result.current.saveFile();
    });
    expect(mocked.pickSaveHandle).toHaveBeenCalledTimes(1); // not called again
    expect(mocked.writeMapToHandle).toHaveBeenCalledTimes(2);
  });

  it("Save reports a denied write permission instead of writing", async () => {
    mocked.pickSaveHandle.mockResolvedValue(fakeHandle());
    const { result, deps } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    }); // bind a handle
    mocked.writeMapToHandle.mockClear();
    mocked.ensureWritePermission.mockResolvedValue(false);
    await act(async () => {
      await result.current.saveFile();
    });
    expect(mocked.writeMapToHandle).not.toHaveBeenCalled();
    expect(deps.showHint).toHaveBeenCalledWith(
      "Couldn't save — permission to write the file was denied.",
    );
  });
});

describe("useDiskFile — external-file conflict detection", () => {
  // A handle whose getFile() reports a mutable lastModified, so a test can simulate the file changing
  // on disk between the baseline (Save As) and a later Save.
  const mtimeHandle = (name: string, getMtime: () => number) =>
    ({
      name,
      getFile: async () => ({ lastModified: getMtime() }),
    }) as unknown as FileSystemFileHandle;

  it("prompts to overwrite when the file changed on disk, and aborts on cancel", async () => {
    let mtime = 1000;
    mocked.pickSaveHandle.mockResolvedValue(mtimeHandle("plan.mmst", () => mtime));
    const { result, deps } = setup();
    await act(async () => {
      await result.current.saveFileAs(); // writes + records baseline mtime=1000
    });
    mocked.writeMapToHandle.mockClear();
    mtime = 5000; // the file was changed elsewhere
    editorConfirmMock.mockResolvedValue(false); // user declines to overwrite
    await act(async () => {
      await result.current.saveFile();
    });
    expect(editorConfirmMock).toHaveBeenCalledTimes(1);
    expect(mocked.writeMapToHandle).not.toHaveBeenCalled(); // aborted — disk file left as-is
    expect(deps.showHint).toHaveBeenCalledWith(expect.stringMatching(/Save cancelled/i));
  });

  it("overwrites when the user confirms the conflict", async () => {
    let mtime = 1000;
    mocked.pickSaveHandle.mockResolvedValue(mtimeHandle("plan.mmst", () => mtime));
    const { result } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    });
    mocked.writeMapToHandle.mockClear();
    mtime = 5000;
    editorConfirmMock.mockResolvedValue(true); // user chooses Overwrite
    await act(async () => {
      await result.current.saveFile();
    });
    expect(mocked.writeMapToHandle).toHaveBeenCalledTimes(1);
  });

  it("does not prompt when the file is unchanged since we last wrote it", async () => {
    const mtime = 1000;
    mocked.pickSaveHandle.mockResolvedValue(mtimeHandle("plan.mmst", () => mtime));
    const { result } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    });
    mocked.writeMapToHandle.mockClear();
    await act(async () => {
      await result.current.saveFile(); // mtime still 1000 → no conflict
    });
    expect(editorConfirmMock).not.toHaveBeenCalled();
    expect(mocked.writeMapToHandle).toHaveBeenCalledTimes(1);
  });
});

describe("useDiskFile — openRecentFile (Open Recent)", () => {
  it("re-opens a recent file: re-binds the handle, reads it, and adopts it", async () => {
    mockedStore.loadMapHandle.mockResolvedValue(fakeHandle("recent.mmst"));
    mocked.readMapFromHandle.mockResolvedValue({ ...doc(), id: "recent" });
    const { result, deps } = setup();
    await act(async () => {
      await result.current.openRecentFile("recent");
    });
    expect(deps.load).toHaveBeenCalledWith(expect.objectContaining({ id: "recent" }));
    expect(deps.showHint).toHaveBeenCalledWith("Opened recent.mmst");
  });

  it("errors when the recent file's handle is gone", async () => {
    mockedStore.loadMapHandle.mockResolvedValue(null);
    const { result, deps } = setup();
    await act(async () => {
      await result.current.openRecentFile("missing");
    });
    expect(deps.setError).toHaveBeenCalledWith(expect.stringMatching(/no longer available/i));
    expect(deps.load).not.toHaveBeenCalled();
  });

  it("reports a denied permission instead of opening", async () => {
    mockedStore.loadMapHandle.mockResolvedValue(fakeHandle("recent.mmst"));
    mocked.ensureWritePermission.mockResolvedValue(false);
    const { result, deps } = setup();
    await act(async () => {
      await result.current.openRecentFile("recent");
    });
    expect(deps.showHint).toHaveBeenCalledWith(expect.stringMatching(/permission/i));
    expect(deps.load).not.toHaveBeenCalled();
  });
});

describe("useDiskFile — open / import", () => {
  it("Open adopts a native file (loads it, enters the editor)", async () => {
    const opened = { ...doc(), id: "opened" };
    mocked.openMapFile.mockResolvedValue({
      kind: "open",
      doc: opened,
      handle: fakeHandle("o.mmst"),
    });
    const { result, deps } = setup();
    await act(async () => {
      await result.current.openFile();
    });
    expect(deps.load).toHaveBeenCalledWith(opened);
    expect(deps.setView).toHaveBeenCalledWith("editor");
    expect(deps.setFileName).toHaveBeenCalledWith("o.mmst");
    expect(deps.showHint).toHaveBeenCalledWith("Opened o.mmst");
  });

  it("Open imports a foreign .mmap as a library map (no handle bound, warns)", async () => {
    const handle = {
      name: "x.mmap",
      getFile: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    } as unknown as FileSystemFileHandle;
    mocked.openMapFile.mockResolvedValue({ kind: "import", handle });
    const { result, deps } = setup();
    await act(async () => {
      await result.current.openFile();
    });
    expect(deps.load).toHaveBeenCalledTimes(1);
    expect(deps.load.mock.calls[0][1]).toEqual(expect.arrayContaining(["lost X"])); // import warnings forwarded
    expect(deps.setFileName).toHaveBeenCalledWith(null); // library-only, not bound
    expect(deps.setView).toHaveBeenCalledWith("editor");
  });

  it("Open surfaces an error via setError", async () => {
    mocked.openMapFile.mockRejectedValue(new Error("boom"));
    const { result, deps } = setup();
    await act(async () => {
      await result.current.openFile();
    });
    expect(deps.setError).toHaveBeenCalledWith("boom");
  });

  it("Open clicks the import <input> when the File System Access API is absent", async () => {
    mocked.supportsFileSystemAccess.mockReturnValue(false);
    const input = document.createElement("input");
    input.id = "mmap-input";
    document.body.appendChild(input);
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    const { result } = setup();
    await act(async () => {
      await result.current.openFile();
    });
    expect(click).toHaveBeenCalledTimes(1);
    input.remove();
  });
});

describe("useDiskFile — scheduleFileSave (silent autosave-to-file)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes to a bound handle after the 1.5s debounce, silently (no prompt)", async () => {
    mocked.pickSaveHandle.mockResolvedValue(fakeHandle());
    const { result, deps } = setup();
    await act(async () => {
      await result.current.saveFileAs();
    }); // bind a handle
    mocked.writeMapToHandle.mockClear();
    deps.setDirty.mockClear();
    act(() => result.current.scheduleFileSave());
    expect(mocked.writeMapToHandle).not.toHaveBeenCalled(); // debounced
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mocked.ensureWritePermission).toHaveBeenLastCalledWith(expect.anything(), false); // never prompts
    expect(mocked.writeMapToHandle).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the map has no bound handle", async () => {
    const { result } = setup();
    act(() => result.current.scheduleFileSave());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mocked.writeMapToHandle).not.toHaveBeenCalled();
  });
});
