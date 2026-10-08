import type { MapNode, MindMapDoc } from "../model/types";

export type DocumentCommand =
  | { action: "addTopic"; parentId: string; topic: string; id?: string; index?: number }
  | { action: "updateTopic"; nodeId: string; topic: string }
  | { action: "moveTopic"; nodeId: string; parentId: string; index?: number }
  | { action: "deleteTopic"; nodeId: string; confirm: true };

export interface CommandResult {
  doc: MindMapDoc;
  nodeId?: string;
}

export interface BatchCommandResult {
  doc: MindMapDoc;
  nodeIds: string[];
}

function walk(node: MapNode, visit: (node: MapNode) => boolean): boolean {
  if (visit(node)) return true;
  return node.children.some((child) => walk(child, visit));
}

function findNode(doc: MindMapDoc, id: string): MapNode | null {
  let found: MapNode | null = null;
  const match = (node: MapNode): boolean => {
    if (node.id !== id) return false;
    found = node;
    return true;
  };
  if (walk(doc.root, match)) return found;
  for (const floating of doc.floatingTopics ?? []) {
    if (walk(floating, match)) return found;
  }
  return null;
}

function detach(doc: MindMapDoc, id: string): MapNode | null {
  const remove = (parent: MapNode): MapNode | null => {
    const index = parent.children.findIndex((child) => child.id === id);
    if (index >= 0) return parent.children.splice(index, 1)[0] ?? null;
    for (const child of parent.children) {
      const found = remove(child);
      if (found) return found;
    }
    return null;
  };
  const nested = remove(doc.root);
  if (nested) return nested;
  const floating = doc.floatingTopics ?? [];
  const index = floating.findIndex((node) => node.id === id);
  return index >= 0 ? (floating.splice(index, 1)[0] ?? null) : null;
}

function contains(node: MapNode, id: string): boolean {
  return walk(node, (candidate) => candidate.id === id);
}

function insert(parent: MapNode, node: MapNode, index?: number): void {
  const at =
    index === undefined
      ? parent.children.length
      : Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(at, 0, node);
}

function applyMutable(doc: MindMapDoc, command: DocumentCommand): string | undefined {
  if (command.action === "addTopic") {
    const parent = findNode(doc, command.parentId);
    if (!parent) throw new Error(`Parent topic not found: ${command.parentId}`);
    const node: MapNode = {
      id: command.id ?? crypto.randomUUID(),
      topic: command.topic,
      children: [],
    };
    if (findNode(doc, node.id)) throw new Error(`Topic id already exists: ${node.id}`);
    insert(parent, node, command.index);
    return node.id;
  }
  if (command.action === "updateTopic") {
    const node = findNode(doc, command.nodeId);
    if (!node) throw new Error(`Topic not found: ${command.nodeId}`);
    node.topic = command.topic;
    node.topicRich = undefined;
    return node.id;
  }
  if (command.action === "deleteTopic") {
    if (command.confirm !== true) throw new Error("deleteTopic requires explicit confirmation");
    if (command.nodeId === doc.root.id) throw new Error("The central topic cannot be deleted");
    if (!detach(doc, command.nodeId)) throw new Error(`Topic not found: ${command.nodeId}`);
    return undefined;
  }
  if (command.action !== "moveTopic")
    throw new Error(`Unsupported document command: ${(command as { action?: unknown }).action}`);
  if (command.nodeId === doc.root.id) throw new Error("The central topic cannot be moved");
  const moving = findNode(doc, command.nodeId);
  const parent = findNode(doc, command.parentId);
  if (!moving) throw new Error(`Topic not found: ${command.nodeId}`);
  if (!parent) throw new Error(`Parent topic not found: ${command.parentId}`);
  if (contains(moving, parent.id)) throw new Error("A topic cannot be moved into its own branch");
  const detached = detach(doc, command.nodeId);
  if (!detached) throw new Error(`Topic not found: ${command.nodeId}`);
  insert(parent, detached, command.index);
  return detached.id;
}

/** Apply an agent command without mutating the caller's document. */
export function applyDocumentCommand(source: MindMapDoc, command: DocumentCommand): CommandResult {
  const doc = structuredClone(source);
  return { doc, nodeId: applyMutable(doc, command) };
}

/** Apply a whole generated edit plan on one clone. If any operation fails, the caller's document and
 * storage remain untouched, so agents can safely submit large trees as one undoable transaction. */
export function applyDocumentCommands(
  source: MindMapDoc,
  commands: readonly DocumentCommand[],
): BatchCommandResult {
  if (commands.length === 0) throw new Error("A batch requires at least one operation");
  if (commands.length > 10_000) throw new Error("A batch cannot exceed 10,000 operations");
  const doc = structuredClone(source);
  const nodeIds: string[] = [];
  for (const command of commands) {
    const nodeId = applyMutable(doc, command);
    if (nodeId) nodeIds.push(nodeId);
  }
  return { doc, nodeIds };
}

export function createAgentMap(title: string, rootTopic = title): MindMapDoc {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    root: { id: crypto.randomUUID(), topic: rootTopic, children: [] },
    meta: { createdAt: new Date(now).toISOString(), updatedAt: now },
  };
}
