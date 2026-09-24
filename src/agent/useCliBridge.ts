import { useEffect } from "react";
import { parseImport } from "../io/importDispatch";
import type { MindMapDoc } from "../model/types";
import { listMaps, loadMap, saveMap } from "../store/mapStore";
import { type DocumentCommand, applyDocumentCommand, createAgentMap } from "./commands";

interface BridgeCommand {
  requestId: string;
  id?: string;
  action: string;
  mapId?: string;
  title?: string;
  rootTopic?: string;
  open?: boolean;
  parentId?: string;
  nodeId?: string;
  topic?: string;
  index?: number;
  confirm?: true;
  fileName?: string;
  fileBase64?: string;
}

interface Options {
  activeDoc: React.MutableRefObject<MindMapDoc>;
  openDoc: (doc: MindMapDoc) => void;
  replaceActive: (doc: MindMapDoc) => boolean;
  refreshMaps: () => Promise<void>;
}

async function postResult(id: string, payload: unknown): Promise<void> {
  await fetch(`/__ithread_cli/v1/commands/${encodeURIComponent(id)}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

function summarizeDoc(doc: MindMapDoc) {
  let topics = 0;
  let images = 0;
  let collapsedTopics = 0;
  const visit = (node: MindMapDoc["root"]) => {
    topics += 1;
    if (node.image || node.style?.fillImage) images += 1;
    if (node.collapsed) collapsedTopics += 1;
    node.children.forEach(visit);
  };
  visit(doc.root);
  doc.floatingTopics?.forEach(visit);
  return {
    topics,
    images,
    collapsedTopics,
    floatingTopics: doc.floatingTopics?.length ?? 0,
  };
}

/** Connect the running development app to the localhost-only CLI queue exposed by Vite. */
export function useCliBridge({ activeDoc, openDoc, replaceActive, refreshMaps }: Options): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let stopped = false;
    const execute = async (command: BridgeCommand): Promise<unknown> => {
      if (command.action === "listMaps")
        return { maps: await listMaps(), activeMapId: activeDoc.current.id };
      if (command.action === "getMap") {
        const mapId = command.mapId ?? activeDoc.current.id;
        const doc = mapId === activeDoc.current.id ? activeDoc.current : await loadMap(mapId);
        if (!doc) throw new Error(`Map not found: ${mapId}`);
        return { map: doc };
      }
      if (command.action === "createMap") {
        const title = command.title?.trim();
        if (!title) throw new Error("createMap requires a title");
        const doc = createAgentMap(title, command.rootTopic?.trim() || title);
        await saveMap(doc);
        await refreshMaps();
        if (command.open !== false) openDoc(doc);
        return { mapId: doc.id, rootId: doc.root.id, map: doc };
      }
      if (command.action === "importFile") {
        const fileName = command.fileName?.trim();
        if (!fileName || !command.fileBase64)
          throw new Error("importFile requires fileName and fileBase64");
        const file = new File([decodeBase64(command.fileBase64)], fileName);
        const { doc, warnings } = await parseImport(file, () => import("../import/mmap"));
        doc.id = crypto.randomUUID();
        await saveMap(doc);
        await refreshMaps();
        if (command.open !== false) openDoc(doc);
        return {
          mapId: doc.id,
          rootId: doc.root.id,
          title: doc.title,
          warnings,
          stats: summarizeDoc(doc),
        };
      }
      const mapId = command.mapId ?? activeDoc.current.id;
      const source = mapId === activeDoc.current.id ? activeDoc.current : await loadMap(mapId);
      if (!source) throw new Error(`Map not found: ${mapId}`);
      const result = applyDocumentCommand(source, command as DocumentCommand);
      await saveMap(result.doc);
      await refreshMaps();
      if (mapId === activeDoc.current.id && !replaceActive(result.doc)) openDoc(result.doc);
      return { mapId, nodeId: result.nodeId, map: result.doc };
    };
    const poll = async () => {
      while (!stopped) {
        try {
          const response = await fetch("/__ithread_cli/v1/commands/next", { cache: "no-store" });
          if (response.status === 200) {
            const command = (await response.json()) as BridgeCommand;
            try {
              await postResult(command.requestId, { ok: true, result: await execute(command) });
            } catch (error) {
              await postResult(command.requestId, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        } catch {
          // The dev server may be restarting. The next poll reconnects automatically.
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    };
    void poll();
    return () => {
      stopped = true;
    };
  }, [activeDoc, openDoc, replaceActive, refreshMaps]);
}
