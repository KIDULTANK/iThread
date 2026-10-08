import type { MutableRefObject } from "react";
import type { MindMapDoc } from "../model/types";
import {
  type DocumentCommand,
  applyDocumentCommand,
  applyDocumentCommands,
  createAgentMap,
} from "./commands";

export interface CliBridgeCommand {
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
  operations?: DocumentCommand[];
  dryRun?: boolean;
  includeMap?: boolean;
  format?: "ithread" | "markdown";
}

export interface CliExecutionOptions {
  activeDoc: MutableRefObject<MindMapDoc>;
  openDoc: (doc: MindMapDoc) => void;
  replaceActive: (doc: MindMapDoc) => boolean;
  refreshMaps: () => Promise<void>;
  listMaps: () => Promise<Array<{ id: string; title: string }>>;
  loadMap: (id: string) => Promise<MindMapDoc | null>;
  saveMap: (doc: MindMapDoc) => Promise<void>;
  parseImport: (
    file: File,
    importMmap: () => Promise<typeof import("../import/mmap")>,
  ) => Promise<{ doc: MindMapDoc; warnings: string[] }>;
  serializeDoc: (doc: MindMapDoc) => string;
  toMarkdown: (doc: MindMapDoc) => string;
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

export async function executeCliCommand(
  command: CliBridgeCommand,
  {
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
  }: CliExecutionOptions,
): Promise<unknown> {
  if (command.action === "listMaps")
    return { maps: await listMaps(), activeMapId: activeDoc.current.id };
  if (command.action === "getMap") {
    const mapId = command.mapId ?? activeDoc.current.id;
    const doc = mapId === activeDoc.current.id ? activeDoc.current : await loadMap(mapId);
    if (!doc) throw new Error(`Map not found: ${mapId}`);
    return { map: doc };
  }
  if (command.action === "openMap") {
    const mapId = command.mapId?.trim();
    if (!mapId) throw new Error("openMap requires a mapId");
    const doc = mapId === activeDoc.current.id ? activeDoc.current : await loadMap(mapId);
    if (!doc) throw new Error(`Map not found: ${mapId}`);
    openDoc(doc);
    return { mapId: doc.id, rootId: doc.root.id, title: doc.title, stats: summarizeDoc(doc) };
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
  if (command.action === "exportMap") {
    const mapId = command.mapId ?? activeDoc.current.id;
    const doc = mapId === activeDoc.current.id ? activeDoc.current : await loadMap(mapId);
    if (!doc) throw new Error(`Map not found: ${mapId}`);
    if (command.format === "markdown") {
      return {
        mapId,
        fileName: `${doc.title || "map"}.md`,
        mimeType: "text/markdown",
        contents: toMarkdown(doc),
      };
    }
    if (command.format && command.format !== "ithread")
      throw new Error(`Unsupported export format: ${command.format}`);
    return {
      mapId,
      fileName: `${doc.title || "map"}.ithread`,
      mimeType: "application/json",
      contents: serializeDoc(doc),
    };
  }
  const mapId = command.mapId ?? activeDoc.current.id;
  const source = mapId === activeDoc.current.id ? activeDoc.current : await loadMap(mapId);
  if (!source) throw new Error(`Map not found: ${mapId}`);
  const batch = command.action === "batchTopics";
  if (batch && !Array.isArray(command.operations))
    throw new Error("batchTopics requires an operations array");
  const batchResult = batch ? applyDocumentCommands(source, command.operations ?? []) : null;
  const singleResult = batch ? null : applyDocumentCommand(source, command as DocumentCommand);
  const doc = batchResult?.doc ?? singleResult?.doc;
  if (!doc) throw new Error("CLI command produced no document");
  if (command.dryRun) {
    return {
      mapId,
      dryRun: true,
      ...(batchResult ? { nodeIds: batchResult.nodeIds } : { nodeId: singleResult?.nodeId }),
      stats: summarizeDoc(doc),
      map: doc,
    };
  }
  await saveMap(doc);
  await refreshMaps();
  if (mapId === activeDoc.current.id && !replaceActive(doc)) openDoc(doc);
  return {
    mapId,
    ...(batchResult ? { nodeIds: batchResult.nodeIds } : { nodeId: singleResult?.nodeId }),
    stats: summarizeDoc(doc),
    ...(command.includeMap === false ? {} : { map: doc }),
  };
}
