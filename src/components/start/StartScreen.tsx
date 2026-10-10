import { useEffect, useMemo, useState } from "react";
import { t } from "../../i18n/registry";
import type { MindMapDoc } from "../../model/types";
import "./messages";
import { CommandPalette } from "./CommandPalette";
import { MapDialogs, type PendingMapAction } from "./MapDialogs";
import { StartHeader } from "./StartHeader";
import { StartHome } from "./StartHome";
import { StartSidebar } from "./StartSidebar";
import { blankDoc } from "./docBuilders";
import { About } from "./sections/About";
import { AllMaps } from "./sections/AllMaps";
import { Examples } from "./sections/Examples";
import { ImportView } from "./sections/ImportView";
import { Layouts } from "./sections/Layouts";
import { Recent } from "./sections/Recent";
import { Templates } from "./sections/Templates";
import { Trash } from "./sections/Trash";
import { startThemeVars } from "./tokens";
import type { StartContext, StartSection } from "./types";
import { useLibrary } from "./useLibrary";
import "./start.css";
import "./editorial-start.css";

function sectionTitle(section: StartSection): string {
  const key: Record<StartSection, Parameters<typeof t>[0]> = {
    start: "start.start",
    all: "toolbar.allMaps",
    recent: "toolbar.recent",
    templates: "toolbar.templates",
    examples: "toolbar.examples",
    layouts: "start.layouts",
    import: "start.import",
    about: "start.about",
    trash: "start.trash",
  };
  return t(key[section]);
}

export function StartScreen({
  dark,
  onOpen,
  onImportFiles,
  onCheckForUpdates,
  onSettings,
}: {
  /** Resolved app appearance (Phase 8) — drives the Start chrome independently of the canvas theme. */
  dark: boolean;
  onOpen: (doc: MindMapDoc, layout?: string) => void;
  onImportFiles: (files: File[]) => void;
  onCheckForUpdates?: () => void;
  onSettings?: () => void;
}) {
  const [section, setSection] = useState<StartSection>("start");
  const [cmdk, setCmdk] = useState(false);
  const [rev, setRev] = useState(0);
  const [pending, setPending] = useState<PendingMapAction>(null);
  const mapCount = useLibrary(rev).length;
  // A brand-new user hasn't completed a first edit, so the one-shot first-run flag is still unset.
  // Combined with a near-empty library, that's the signal for the "New here?" onboarding banner (O9).
  const firstRunSeen = (() => {
    try {
      return localStorage.getItem("mindmap-first-run-seen") === "1";
    } catch {
      return true; // can't read storage → assume seen, don't nag
    }
  })();
  const showNewHere = mapCount <= 1 && !firstRunSeen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === ",") {
        e.preventDefault();
        onSettings?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdk((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettings]);

  const ctx: StartContext = useMemo(
    () => ({
      onOpen,
      onImportFiles,
      go: setSection,
      libraryRev: rev,
      onLibraryChange: () => setRev((r) => r + 1),
      openCommandPalette: () => setCmdk(true),
      requestRename: (id, title) => setPending({ kind: "rename", id, title }),
      requestDelete: (id, title) => setPending({ kind: "delete", id, title }),
      onCheckForUpdates,
      showNewHere,
    }),
    [onOpen, onImportFiles, rev, onCheckForUpdates, showNewHere],
  );

  return (
    <div className="start" data-theme={dark ? "dark" : "light"} style={startThemeVars(dark)}>
      <StartSidebar
        active={section}
        mapCount={mapCount}
        onNavigate={setSection}
        onNewMap={() => onOpen(blankDoc())}
        onSettings={onSettings}
      />
      <div className="st-main">
        <StartHeader title={sectionTitle(section)} onCommand={() => setCmdk(true)} />
        <div className="st-scroll">
          {section === "start" ? <StartHome ctx={ctx} /> : null}
          {section === "all" ? <AllMaps ctx={ctx} /> : null}
          {section === "recent" ? <Recent ctx={ctx} /> : null}
          {section === "templates" ? <Templates ctx={ctx} /> : null}
          {section === "examples" ? <Examples ctx={ctx} /> : null}
          {section === "layouts" ? <Layouts ctx={ctx} /> : null}
          {section === "import" ? <ImportView ctx={ctx} /> : null}
          {section === "about" ? <About onCheckForUpdates={onCheckForUpdates} /> : null}
          {section === "trash" ? <Trash ctx={ctx} /> : null}
        </div>
      </div>
      {cmdk ? <CommandPalette ctx={ctx} onClose={() => setCmdk(false)} /> : null}
      <MapDialogs
        pending={pending}
        onClose={() => setPending(null)}
        onDone={() => setRev((r) => r + 1)}
      />
    </div>
  );
}
