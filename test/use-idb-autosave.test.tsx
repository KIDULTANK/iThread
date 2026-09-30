import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MindMapDoc } from "../src/model/types";

// useIdbAutosave owns the debounced IndexedDB write-through plus the tab-close flush + beforeunload
// guard. The store is mocked so persistence is observed without a real IndexedDB.

vi.mock("../src/store/mapStore", () => ({
  saveMap: vi.fn(async () => {}),
  setLastOpened: vi.fn(async () => {}),
}));

import { useIdbAutosave } from "../src/hooks/useIdbAutosave";
import * as store from "../src/store/mapStore";

const mocked = store as unknown as Record<string, ReturnType<typeof vi.fn>>;
const doc = (id = "m1"): MindMapDoc => ({
  id,
  title: "T",
  root: { id: "r", topic: "R", children: [] },
  schemaVersion: 1,
});

function setup(d: MindMapDoc = doc()) {
  const deps = {
    liveDocRef: { current: d },
    dirtyRef: { current: false },
    refreshMaps: vi.fn(async () => {}),
    maybeSnapshot: vi.fn(),
  };
  return { ...renderHook(() => useIdbAutosave(deps)), deps };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.saveMap.mockResolvedValue(undefined);
  mocked.setLastOpened.mockResolvedValue(undefined);
});

describe("useIdbAutosave — persist", () => {
  it("writes the doc, records last-opened, and refreshes the library", async () => {
    const { result, deps } = setup();
    await act(async () => {
      await result.current.persist(doc("m9"));
    });
    expect(mocked.saveMap).toHaveBeenCalledTimes(1);
    expect(mocked.setLastOpened).toHaveBeenCalledWith("m9");
    expect(deps.refreshMaps).toHaveBeenCalledTimes(1);
    expect(deps.maybeSnapshot).not.toHaveBeenCalled(); // no snapshot unless asked
    expect(result.current.saveState).toBe("saved"); // badge can show "Saved locally" truthfully
  });

  it("feeds the version snapshot only on an edit-driven save (snapshot=true)", async () => {
    const { result, deps } = setup();
    await act(async () => {
      await result.current.persist(doc(), true);
    });
    expect(deps.maybeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("surfaces a store error as saveState='error' (no throw) so the badge can't lie", async () => {
    mocked.saveMap.mockRejectedValueOnce(new Error("quota"));
    const { result, deps } = setup();
    await act(async () => {
      await result.current.persist(doc(), true);
    });
    expect(deps.maybeSnapshot).not.toHaveBeenCalled(); // threw before the snapshot, but didn't propagate
    expect(result.current.saveState).toBe("error");
  });

  it("serializes overlapping writes so an older slow save cannot finish last", async () => {
    let releaseFirst: (() => void) | undefined;
    mocked.saveMap
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const { result } = setup();
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.persist(doc("older"));
      second = result.current.persist(doc("newer"));
    });
    await act(async () => {});
    expect(mocked.saveMap).toHaveBeenCalledTimes(1);
    expect(mocked.saveMap.mock.calls[0][0].id).toBe("older");
    expect(result.current.saveState).toBe("saving");

    releaseFirst?.();
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(mocked.saveMap.mock.calls.map(([saved]) => saved.id)).toEqual(["older", "newer"]);
    expect(result.current.saveState).toBe("saved");
  });
});

describe("useIdbAutosave — scheduleSave + lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces a snapshotting save 500ms after the last call", async () => {
    const { result } = setup(doc("live"));
    act(() => result.current.scheduleSave());
    act(() => result.current.scheduleSave()); // resets the debounce
    expect(mocked.saveMap).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mocked.saveMap).toHaveBeenCalledTimes(1);
    expect(mocked.setLastOpened).toHaveBeenCalledWith("live");
  });

  it("shows saveState='saving' as soon as an edit is pending, then 'saved' once it lands", async () => {
    const { result } = setup(doc("live2"));
    act(() => result.current.scheduleSave());
    expect(result.current.saveState).toBe("saving"); // pending immediately, before the debounce fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.saveState).toBe("saved");
  });

  it("flushes a pending save the moment the tab is hidden", async () => {
    const { result } = setup();
    act(() => result.current.scheduleSave()); // pending (not yet fired)
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {}); // let the flushed promise settle
    expect(mocked.saveMap).toHaveBeenCalledTimes(1); // flushed immediately, not after 500ms
    // the debounce was cancelled, so advancing time does NOT fire a second save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mocked.saveMap).toHaveBeenCalledTimes(1);
  });

  it("does nothing on hide when no save is pending", async () => {
    setup();
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {});
    expect(mocked.saveMap).not.toHaveBeenCalled();
  });

  it("flushes a pending save on pagehide even without a visibility event", async () => {
    const { result } = setup(doc("closing"));
    act(() => result.current.scheduleSave());
    act(() => window.dispatchEvent(new Event("pagehide")));
    await act(async () => {});
    expect(mocked.saveMap).toHaveBeenCalledTimes(1);
    expect(mocked.saveMap).toHaveBeenCalledWith(expect.objectContaining({ id: "closing" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mocked.saveMap).toHaveBeenCalledTimes(1);
  });
});

describe("useIdbAutosave — beforeunload guard", () => {
  it("blocks unload only while the linked file is dirty", () => {
    const deps = {
      liveDocRef: { current: doc() },
      dirtyRef: { current: false },
      refreshMaps: vi.fn(),
      maybeSnapshot: vi.fn(),
    };
    renderHook(() => useIdbAutosave(deps));

    const fire = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(fire()).toBe(false); // clean → unload allowed
    deps.dirtyRef.current = true;
    expect(fire()).toBe(true); // dirty → blocked
  });
});
