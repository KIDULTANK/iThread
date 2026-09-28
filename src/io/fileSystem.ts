import { t } from "../i18n/registry";
// Native file open / save / autosave, on top of the lossless JSON serializer.
//
// iThread's library always lives in IndexedDB (the safety net — see store/mapStore).
// This module adds *disk* files: a user can Open an `.ithread` from anywhere, Save back to it
// with no dialog, and have edits autosaved through to that same file. It's a thin wrapper
// over the File System Access API (Chromium desktop) with a download/upload fallback for
// browsers that lack it, so the rest of the app can stay oblivious to which path is live.
//
// `.ithread` is our native extension; the bytes are exactly the same schema-v1 JSON that
// `serializeDoc` produces. The former `.mmst` extension and plain `.json` remain losslessly readable.

import type { MindMapDoc } from "../model/types";
import { downloadBlob } from "./download";
import { safeFileStem } from "./fileName";
import { parseDoc, serializeDoc } from "./json";

/** Native file extension (a custom extension is what lets Windows associate the PWA with it). */
export const NATIVE_EXT = ".ithread";
/** Former native extension. Kept indefinitely so existing user files never become stranded. */
export const LEGACY_NATIVE_EXT = ".mmst";
/** MIME type recorded for the native file — the content is JSON. */
export const NATIVE_MIME = "application/json";

/** Extensions we can open *natively* (parse losslessly + bind for save-back): our own format + JSON. */
const NATIVE_EXTS = [NATIVE_EXT, LEGACY_NATIVE_EXT, ".json"];
/** Extensions we open as a one-way *import* (converted to a library map, never written back). */
const IMPORT_EXTS = [".mmap", ".mmp"];

/** Picker filter: Save offers `.ithread`; Open also accepts legacy `.mmst` and JSON files. */
// FUNCTIONS, not consts: these are read when the picker opens, and a module-scope t() would freeze
// the description at import.
const saveTypes = (): FilePickerAcceptType[] => [
  { description: t("io.picker.studioMap"), accept: { [NATIVE_MIME]: [NATIVE_EXT] } },
];
const openTypes = (): FilePickerAcceptType[] => [
  { description: t("io.picker.studioMap"), accept: { [NATIVE_MIME]: NATIVE_EXTS } },
  {
    description: t("io.picker.mindManagerMap"),
    accept: { "application/octet-stream": IMPORT_EXTS },
  },
];

/** True for a file we open natively (`.ithread`/`.mmst`/`.json`) vs a one-way import. */
export function isNativeExt(name: string): boolean {
  const lower = name.toLowerCase();
  return NATIVE_EXTS.some((ext) => lower.endsWith(ext));
}

/** True when the browser exposes the File System Access pickers (Chromium desktop, HTTPS/localhost). */
export function supportsFileSystemAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showOpenFilePicker === "function" &&
    typeof window.showSaveFilePicker === "function"
  );
}

/** A filesystem-safe filename for a doc: its title, stripped of illegal characters, + `.ithread`. */
export function suggestedFileName(doc: MindMapDoc): string {
  return `${safeFileStem(doc.title)}${NATIVE_EXT}`;
}

/** Parse an `.ithread`/`.mmst`/`.json` File into a doc. */
export async function readMapFile(file: File): Promise<MindMapDoc> {
  return parseDoc(await file.text());
}

/** Read the doc out of a live file handle (used by Open and by the file-association launch path). */
export async function readMapFromHandle(handle: FileSystemFileHandle): Promise<MindMapDoc> {
  return readMapFile(await handle.getFile());
}

/**
 * Ensure we hold read/write permission on a handle. Returns true if granted.
 * `interactive: false` only checks (no prompt) — used by silent autosave so a background
 * write never pops a permission dialog; the explicit Save path passes `interactive: true`.
 */
export async function ensureWritePermission(
  handle: FileSystemFileHandle,
  interactive: boolean,
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission?.(opts)) === "granted") return true;
  if (!interactive) return false;
  return (await handle.requestPermission?.(opts)) === "granted";
}

/**
 * The picker can return either kind of file, known only after the user picks:
 * - `native`  — `.ithread`/`.mmst`/`.json`: parsed losslessly and bound for save-back.
 * - `import`  — `.mmap`/`.mmp`: a one-way MindManager import; the caller converts the handle's bytes
 *   into a new library map (no save-back binding). Parsing is deferred so the importer stays lazy.
 */
export type OpenResult =
  | { kind: "native"; doc: MindMapDoc; handle: FileSystemFileHandle }
  | { kind: "import"; handle: FileSystemFileHandle };

/** Open the system file picker and classify the chosen file. Returns null if the user cancels. */
export async function openMapFile(): Promise<OpenResult | null> {
  if (!window.showOpenFilePicker) return null;
  let handle: FileSystemFileHandle | undefined;
  try {
    [handle] = await window.showOpenFilePicker({
      types: openTypes(),
      multiple: false,
      id: "mindmap",
    });
  } catch (err) {
    if (isAbort(err)) return null; // user dismissed the picker
    throw err;
  }
  if (!handle) return null;
  if (!isNativeExt(handle.name)) return { kind: "import", handle };
  return { kind: "native", doc: await readMapFromHandle(handle), handle };
}

/** "Save As" — pick a destination and return its handle (caller then writes + remembers it). */
export async function pickSaveHandle(doc: MindMapDoc): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null;
  try {
    return await window.showSaveFilePicker({
      suggestedName: suggestedFileName(doc),
      types: saveTypes(),
      id: "mindmap",
    });
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

/** Write a doc's serialized bytes to an existing handle (overwrites it). */
export async function writeMapToHandle(
  handle: FileSystemFileHandle,
  doc: MindMapDoc,
): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(serializeDoc(doc));
  } finally {
    await writable.close();
  }
}

/** Fallback download (browsers without the save picker): emit the doc as an `.ithread` download. */
export function downloadMapFile(doc: MindMapDoc): void {
  const blob = new Blob([serializeDoc(doc)], { type: NATIVE_MIME });
  downloadBlob(blob, suggestedFileName(doc));
}

/** A user-cancelled picker rejects with an AbortError — treated as "no selection", not an error. */
function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
