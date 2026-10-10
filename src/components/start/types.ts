import type { MindMapDoc } from "../../model/types";

// Shared types for the start screen.

/** The sidebar sections, in nav order. */
export type StartSection =
  | "start"
  | "all"
  | "recent"
  | "templates"
  | "examples"
  | "layouts"
  | "import"
  | "about"
  | "trash";

/** Props every section view receives — read-only data + the one callback that lands a doc in the
 *  editor. Sections read the store directly for the live library; `onOpen` hands a built/loaded doc
 *  to App (which persists it + switches to the editor). */
export interface StartContext {
  /** Open a doc in the editor (App persists + switches view). Optional layout applies the editor's
   *  layout for that map (used by the Layouts section). */
  onOpen: (doc: MindMapDoc, layout?: string) => void;
  /** Hand dropped/picked files to App's import pipeline (lands the result in the editor). */
  onImportFiles: (files: File[]) => void;
  /** Jump to another section (deep links from Home). */
  go: (section: StartSection) => void;
  /** Library refresh tick — bumped after a delete/rename so sections re-read the store. */
  libraryRev: number;
  /** Notify App that the library changed (delete/rename/duplicate) so it can refresh. */
  onLibraryChange: () => void;
  /** Open the ⌘K command palette (so e.g. the "Learn the app" ⌘K tip card can actually open it). */
  openCommandPalette?: () => void;
  /** Open the themed rename dialog for a map (instead of a native window.prompt). */
  requestRename?: (id: string, title: string) => void;
  /** Open the themed delete-confirm dialog for a map (instead of a native window.confirm). */
  requestDelete?: (id: string, title: string) => void;
  /** Trigger a manual PWA update check (About → "Check for updates"). App maps the result to a
   *  toast; the Start screen now renders that toast surface, so the result is visible here. */
  onCheckForUpdates?: () => void;
  /** True for a brand-new user (no real edits yet, ≤1 map) — e.g. someone who opened a shared
   *  `?map=` deep link and lands on Home with an unfamiliar, imported-only library. Drives the
   *  dismissible "New here?" onboarding banner on StartHome (O9). */
  showNewHere?: boolean;
}
