import { type RefObject, useCallback, useRef } from "react";
import { editorConfirm } from "../components/editorDialogs";
import { t } from "../i18n";
import {
  downloadMapFile,
  ensureWritePermission,
  isNativeExt,
  openMapFile,
  pickSaveHandle,
  readMapFromHandle,
  suggestedFileName,
  supportsFileSystemAccess,
  writeMapToHandle,
} from "../io/fileSystem";
import { serializeDoc } from "../io/json";
import type { MindMapDoc } from "../model/types";
import { loadMapHandle, noteRecentFile, saveMapHandle } from "../store/mapStore";

// Disk-file binding (open / save / save-as / silent autosave-to-file) via the File System Access API.
// The IndexedDB library is always the safety net; this layer adds real `.ithread` files on disk. On a
// browser without the API (Firefox/Safari/mobile) Open falls back to the import <input> and Save to a
// plain download — feature-detected so the menu items always do *something*. Lifted out of App so the
// shell isn't carrying the file plumbing inline; App wires the deps and consumes the returned handlers.

interface Options {
  /** The live (uncommitted) doc — read by ref so handlers always see the latest without re-binding. */
  liveDocRef: RefObject<MindMapDoc>;
  /** Adopt a doc as the active map (the App-owned load path). */
  load: (doc: MindMapDoc, warnings?: string[]) => void;
  setView: (view: "editor") => void;
  setFileName: (name: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setError: (message: string | null) => void;
  showHint: (message: string) => void;
}

export function useDiskFile({
  liveDocRef,
  load,
  setView,
  setFileName,
  setDirty,
  setError,
  showHint,
}: Options) {
  // map id → FileSystemFileHandle, for maps opened from / saved to a file (mirrored in IndexedDB so it
  // survives a reload). Exposed so the boot-restore + edit-autosave paths can read/rebind it.
  const handleCache = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const fileSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // On-disk freshness per map: the file's lastModified the last time we read/wrote it. Lets a Save
  // detect that the file changed underneath us (edited elsewhere, Dropbox-synced) before overwriting.
  // In-memory (per session) — re-opening a file re-establishes the baseline anyway.
  const lastMtime = useRef<Map<string, number>>(new Map());
  const conflictWarned = useRef<Set<string>>(new Set()); // ids we've already flagged during autosave

  // Stamp the on-disk file's lastModified as our baseline (after a read or a write we performed).
  const recordMtime = useCallback(async (id: string, handle: FileSystemFileHandle) => {
    try {
      lastMtime.current.set(id, (await handle.getFile()).lastModified);
      conflictWarned.current.delete(id);
    } catch {
      // best-effort — if we can't read the file, just don't track a baseline
    }
  }, []);

  // True when the on-disk file is NEWER than the version we last read/wrote (an external change). No
  // baseline ⇒ false (we can't tell, so we never block the first save).
  const diskChangedSince = useCallback(async (id: string, handle: FileSystemFileHandle) => {
    const known = lastMtime.current.get(id);
    if (known == null) return false;
    try {
      return (await handle.getFile()).lastModified > known;
    } catch {
      return false;
    }
  }, []);

  // Bind a map to a file handle: cache it, mirror to IndexedDB, and reflect it in the title bar.
  const bindFileHandle = useCallback(
    async (id: string, handle: FileSystemFileHandle) => {
      handleCache.current.set(id, handle);
      await saveMapHandle(id, handle).catch(() => {
        // handle persistence is best-effort (e.g. private mode) — the in-memory cache still works
      });
      if (id === liveDocRef.current.id) setFileName(handle.name);
    },
    [liveDocRef, setFileName],
  );

  // Adopt a doc read from a file as the active map, keeping its embedded id so re-saving overwrites the
  // same library entry (an id-less hand-built file gets a fresh one). Shared by Open + the launch queue.
  const adoptOpenedFile = useCallback(
    async (opened: MindMapDoc, handle: FileSystemFileHandle) => {
      if (!opened.id) opened.id = crypto.randomUUID();
      await bindFileHandle(opened.id, handle);
      await recordMtime(opened.id, handle); // baseline for later conflict detection
      await noteRecentFile(opened.id, handle.name); // add to Open Recent
      load(opened);
      setFileName(handle.name);
      setDirty(false);
      setView("editor");
      showHint(`Opened ${handle.name}`);
    },
    [bindFileHandle, recordMtime, load, setFileName, setDirty, setView, showHint],
  );

  // Open a foreign file (a MindManager `.mmap`) as a one-way import: convert its bytes into a fresh
  // library map via the shared import dispatcher and DON'T bind a handle — there's no save-back to
  // `.mmap` (lossy by design). The map autosaves to IndexedDB like any other; the leading banner note
  // + toast tell the user to Save as… an `.ithread` to keep it as a file.
  const importForeignFile = useCallback(
    async (handle: FileSystemFileHandle) => {
      const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      const { parseMmap } = await import("../import/mmap"); // lazy: keeps the importer out of the entry
      const { doc: next, warnings } = parseMmap(bytes);
      next.id = crypto.randomUUID(); // an import is a new library map, not a re-openable native file
      load(next, [t("app.importedFromMindmanagerSavedTo"), ...warnings]);
      setFileName(null); // library-only: not bound to a disk file
      setDirty(false);
      setView("editor");
      showHint(t("hint.importedUseSaveAs", { name: handle.name }));
    },
    [load, setFileName, setDirty, setView, showHint],
  );

  const openFile = useCallback(async () => {
    const desktop = window.iThreadDesktop;
    if (desktop) {
      try {
        const payload = await desktop.openFileDialog();
        if (!payload) return;
        const { createDesktopFileHandle } = await import("../io/desktopFileHandle");
        const handle = createDesktopFileHandle(payload, desktop);
        if (isNativeExt(handle.name))
          await adoptOpenedFile(await readMapFromHandle(handle), handle);
        else await importForeignFile(handle);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (!supportsFileSystemAccess()) {
      // No native picker — reuse the import input, which accepts .ithread/.mmst/.json/.mmap and more.
      document.getElementById("mmap-input")?.click();
      return;
    }
    try {
      const res = await openMapFile();
      if (!res) return;
      if (res.kind === "import") await importForeignFile(res.handle);
      else await adoptOpenedFile(res.doc, res.handle);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [adoptOpenedFile, importForeignFile, setError]);

  // "Save As" — pick a destination, write it, and remember the handle for plain Saves afterwards.
  const saveFileAs = useCallback(async () => {
    const d = liveDocRef.current;
    const desktop = window.iThreadDesktop;
    if (desktop) {
      try {
        const payload = await desktop.saveFileDialog(suggestedFileName(d), serializeDoc(d));
        if (!payload) return;
        const { createDesktopFileHandle } = await import("../io/desktopFileHandle");
        const handle = createDesktopFileHandle(payload, desktop);
        await bindFileHandle(d.id, handle);
        await recordMtime(d.id, handle);
        await noteRecentFile(d.id, handle.name);
        setDirty(false);
        showHint(`Saved ${handle.name}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (!supportsFileSystemAccess()) {
      downloadMapFile(d);
      showHint(`Downloaded ${suggestedFileName(d)}`);
      return;
    }
    try {
      const handle = await pickSaveHandle(d);
      if (!handle) return; // cancelled
      await writeMapToHandle(handle, d);
      await bindFileHandle(d.id, handle);
      await recordMtime(d.id, handle);
      await noteRecentFile(d.id, handle.name); // Save As binds a (new) file → add to Open Recent
      setDirty(false);
      showHint(`Saved ${handle.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [liveDocRef, bindFileHandle, recordMtime, setDirty, setError, showHint]);

  // Re-open a file from the Open-Recent list: re-bind its persisted handle (re-prompting for permission,
  // which the menu-click gesture allows), read it, and adopt it as the active map.
  const openRecentFile = useCallback(
    async (id: string) => {
      try {
        const handle = await loadMapHandle(id);
        if (!handle) {
          setError(t("app.thatFileIsNoLonger"));
          return;
        }
        if (!(await ensureWritePermission(handle, true))) {
          showHint(t("app.couldnTOpenPermissionTo"));
          return;
        }
        const opened = await readMapFromHandle(handle);
        await adoptOpenedFile(opened, handle);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [adoptOpenedFile, setError, showHint],
  );

  // "Save" (Ctrl+S) — write back to the bound file with no dialog; first save (or no API) defers to
  // Save As / download. Prompts once for write permission if the browser dropped it this session.
  const saveFile = useCallback(async () => {
    const d = liveDocRef.current;
    const handle = handleCache.current.get(d.id);
    if (!handle) {
      if (!supportsFileSystemAccess()) {
        downloadMapFile(d);
        showHint(`Downloaded ${suggestedFileName(d)}`);
        return;
      }
      await saveFileAs();
      return;
    }
    try {
      if (!(await ensureWritePermission(handle, true))) {
        showHint(t("app.couldnTSavePermissionTo"));
        return;
      }
      // The file changed on disk since we last read/wrote it — confirm before overwriting it.
      if (await diskChangedSince(d.id, handle)) {
        const overwrite = await editorConfirm({
          title: t("app.fileChangedOnDisk"),
          body: t("dialog.fileChanged.body", { name: handle.name }),
          confirmText: t("app.overwrite"),
          danger: true,
        });
        if (!overwrite) {
          showHint(t("app.saveCancelledTheFileOn"));
          return;
        }
      }
      await writeMapToHandle(handle, d);
      await recordMtime(d.id, handle);
      setDirty(false);
      showHint(`Saved ${handle.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [liveDocRef, saveFileAs, diskChangedSince, recordMtime, setDirty, setError, showHint]);

  // Background write-through after an edit — silent (never prompts): only writes when the browser still
  // holds write permission, so a denied/revoked grant simply leaves the IndexedDB copy as the record.
  const scheduleFileSave = useCallback(() => {
    if (fileSaveTimer.current) clearTimeout(fileSaveTimer.current);
    fileSaveTimer.current = setTimeout(async () => {
      const d = liveDocRef.current;
      const handle = handleCache.current.get(d.id);
      if (!handle) return;
      if (!(await ensureWritePermission(handle, false))) return; // don't prompt during autosave
      // Never silently clobber an external change — pause autosave-to-file for this map + warn once;
      // an explicit Save (which prompts to overwrite) is the way to resolve it.
      if (await diskChangedSince(d.id, handle)) {
        if (!conflictWarned.current.has(d.id)) {
          conflictWarned.current.add(d.id);
          showHint(t("hint.fileChangedOnDisk", { name: handle.name }));
        }
        return;
      }
      try {
        await writeMapToHandle(handle, d);
        await recordMtime(d.id, handle);
        if (d.id === liveDocRef.current.id) setDirty(false);
      } catch {
        // best-effort; the IndexedDB autosave still holds the edit
      }
    }, 1500);
  }, [liveDocRef, setDirty, diskChangedSince, recordMtime, showHint]);

  return {
    handleCache,
    bindFileHandle,
    adoptOpenedFile,
    importForeignFile,
    openFile,
    openRecentFile,
    saveFile,
    saveFileAs,
    scheduleFileSave,
  };
}
