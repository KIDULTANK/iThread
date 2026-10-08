// Ambient declarations for the File System Access API + Launch Queue API.
//
// lib.dom ships `FileSystemFileHandle` / `FileSystemWritableFileStream`, but as of
// TypeScript 5.9 it still omits the window-level pickers (`showOpenFilePicker`,
// `showSaveFilePicker`), the per-handle permission methods, and the PWA file-handling
// `launchQueue`. We use those for native open/save + Windows file association, so the
// few members we touch are declared here (deliberately minimal — not the full spec).

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  /** Re-opens the picker in the directory last used for this id. */
  id?: string;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  id?: string;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface LaunchParams {
  readonly files: readonly FileSystemFileHandle[];
  readonly targetURL?: string;
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

interface DesktopOpenFilePayload {
  name: string;
  bytes: Uint8Array;
  token: string;
  lastModified: number;
  writable: boolean;
}

interface DesktopBoundFilePayload {
  name: string;
  bytes: Uint8Array;
  lastModified: number;
}

type DesktopUpdateResult =
  | {
      status: "available";
      currentVersion: string;
      latestVersion: string;
      url: string;
    }
  | {
      status: "up-to-date";
      currentVersion: string;
      latestVersion: string;
      url: string;
    }
  | {
      status: "unavailable";
      currentVersion: string;
      url: string;
    };

interface IThreadDesktopBridge {
  checkForUpdates(): Promise<DesktopUpdateResult>;
  openReleasePage(url: string): Promise<boolean>;
  openFileDialog(): Promise<DesktopOpenFilePayload | null>;
  saveFileDialog(suggestedName: string, contents: string): Promise<DesktopOpenFilePayload | null>;
  readBoundFile(token: string): Promise<DesktopBoundFilePayload>;
  writeBoundFile(token: string, contents: string): Promise<boolean>;
  cliNextCommand?(): Promise<Record<string, unknown> | null>;
  cliPostResult?(id: string, payload: unknown): Promise<boolean>;
  onOpenFile(listener: (payload: DesktopOpenFilePayload) => void): () => void;
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  readonly launchQueue?: LaunchQueue;
  readonly iThreadDesktop?: IThreadDesktopBridge;
}
