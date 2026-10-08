import { useEffect } from "react";
import { parseImport } from "../io/importDispatch";
import { serializeDoc } from "../io/json";
import { toMarkdown } from "../io/markdown";
import type { MindMapDoc } from "../model/types";
import { listMaps, loadMap, saveMap } from "../store/mapStore";

interface Options {
  activeDoc: React.MutableRefObject<MindMapDoc>;
  openDoc: (doc: MindMapDoc) => void;
  replaceActive: (doc: MindMapDoc) => boolean;
  refreshMaps: () => Promise<void>;
}

/** Connect the editor to either the token-authenticated desktop bridge or Vite's development bridge. */
export function useCliBridge({ activeDoc, openDoc, replaceActive, refreshMaps }: Options): void {
  useEffect(() => {
    let disconnect: (() => void) | undefined;
    void import("./cliLink").then((bridge) => {
      disconnect = bridge.connect([
        activeDoc,
        openDoc,
        replaceActive,
        refreshMaps,
        listMaps,
        loadMap,
        saveMap,
        parseImport,
        serializeDoc,
        toMarkdown,
      ]);
    });
    return () => disconnect?.();
  }, [activeDoc, openDoc, replaceActive, refreshMaps]);
}
