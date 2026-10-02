import type { MapNode, MindMapDoc } from "../model/types";

export type IthoughtsCompatibilityIssue =
  | "richTextConverted"
  | "markersAndTags"
  | "extraHyperlinks"
  | "extraAssets"
  | "callouts"
  | "taskDetails"
  | "advancedTopicStyle"
  | "branchSettings"
  | "mapObjects"
  | "relationshipStyle"
  | "mapPresentation";

export interface IthoughtsCompatibilityReport {
  topics: number;
  notes: number;
  primaryLinks: number;
  relationships: number;
  floatingTopics: number;
  embeddedAssets: number;
  taskProgress: number;
  issues: { code: IthoughtsCompatibilityIssue; count: number }[];
  issueItems: number;
}

const embedded = (url: string | undefined): boolean => !!url && /^data:[^;,]+;base64,/i.test(url);

/**
 * Compare an iThread document with the subset written by the `.itmz` exporter. This is deliberately
 * independent from the ZIP writer so it can run cheaply in tests and stays an honest, inspectable
 * contract rather than a vague “some formatting may be lost” warning.
 */
export function analyzeIthoughtsCompatibility(doc: MindMapDoc): IthoughtsCompatibilityReport {
  const totals = {
    topics: 0,
    notes: 0,
    primaryLinks: 0,
    embeddedAssets: 0,
    taskProgress: 0,
  };
  const issues = new Map<IthoughtsCompatibilityIssue, number>();
  const add = (code: IthoughtsCompatibilityIssue, count = 1) => {
    if (count > 0) issues.set(code, (issues.get(code) ?? 0) + count);
  };

  const visit = (node: MapNode) => {
    totals.topics += 1;
    if (node.note?.trim()) totals.notes += 1;
    if (node.hyperlink) totals.primaryLinks += 1;
    if (node.task?.priority !== undefined || node.task?.progress !== undefined)
      totals.taskProgress += 1;

    if (node.topicRich) add("richTextConverted");
    add("markersAndTags", (node.icons?.length ?? 0) + (node.tags?.length ?? 0));
    add("extraHyperlinks", node.hyperlinks?.length ?? 0);
    add("callouts", node.callouts?.length ?? 0);
    add(
      "taskDetails",
      Number(!!node.task?.start) +
        Number(!!node.task?.due) +
        Number(node.task?.durationDays !== undefined) +
        (node.task?.resources?.length ?? 0),
    );

    const hasEmbeddedImage = embedded(node.image?.url);
    const embeddedAttachments = (node.attachments ?? []).filter((a) => embedded(a.dataUrl)).length;
    const totalAssets = Number(!!node.image?.url) + (node.attachments?.length ?? 0);
    const preservedAsset = hasEmbeddedImage || embeddedAttachments > 0 ? 1 : 0;
    totals.embeddedAssets += preservedAsset;
    add("extraAssets", totalAssets - preservedAsset);

    const style = node.style;
    if (
      style &&
      (style.fontWeight ||
        style.borderRadius ||
        style.shape ||
        style.border ||
        style.textDecoration ||
        style.fill ||
        style.fillImage ||
        style.shadow)
    )
      add("advancedTopicStyle");
    if (node.side || node.locked || node.layout || node.lineDash || node.rollup)
      add("branchSettings");

    for (const child of node.children) visit(child);
  };

  visit(doc.root);
  for (const floating of doc.floatingTopics ?? []) visit(floating);

  const mapObjects =
    (doc.boundaries?.length ?? 0) +
    (doc.summaries?.length ?? 0) +
    (doc.rules?.length ?? 0) +
    (doc.shapes?.length ?? 0) +
    Number(!!doc.backdrop);
  add("mapObjects", mapObjects);
  add(
    "relationshipStyle",
    (doc.links ?? []).filter(
      (link) =>
        !!link.arrow ||
        !!link.color ||
        link.width !== undefined ||
        link.curve !== undefined ||
        !!link.type ||
        link.dash === "dotted",
    ).length,
  );
  const meta = doc.meta;
  add(
    "mapPresentation",
    Number(!!doc.theme) +
      Number(!!meta?.background) +
      Number(!!meta?.backgroundImage) +
      Number(!!meta?.freeform) +
      Number(!!meta?.lineJumps) +
      Number(!!meta?.connectorStyle) +
      Number(!!meta?.branchGrowth) +
      Number(!!meta?.legend) +
      Number(!!meta?.savedViews?.length) +
      Number(!!meta?.slides?.length),
  );

  const issueList = [...issues].map(([code, count]) => ({ code, count }));
  return {
    ...totals,
    relationships: doc.links?.length ?? 0,
    floatingTopics: doc.floatingTopics?.length ?? 0,
    issues: issueList,
    issueItems: issueList.reduce((sum, issue) => sum + issue.count, 0),
  };
}
