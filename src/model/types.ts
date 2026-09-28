// Canonical, format-agnostic mind-map model.
// Every importer/exporter and renderer targets THIS shape — it is the single
// source of truth, so the rendering engine and file formats stay replaceable.

export type NodeId = string;

export interface TaskInfo {
  start?: string;
  due?: string;
  durationDays?: number;
  /** 0..1 */
  progress?: number;
  /** 1 (highest) .. 9 */
  priority?: number;
  resources?: string[];
}

/** Node outline shape. The first three are CSS rounded rectangles (set via borderRadius);
 *  the rest ("geometric") paint an SVG backdrop — the flowchart vocabulary. */
export type NodeShape =
  | "round"
  | "rect"
  | "pill"
  | "ellipse"
  | "diamond"
  | "parallelogram"
  | "hexagon"
  | "cylinder"
  | "trapezoid"
  | "octagon"
  | "document"
  | "callout"
  | "star"
  | "cloud";

export interface NodeStyle {
  color?: string;
  background?: string;
  /** CSS size string, e.g. "20px" — matches the editor's node-style shape. */
  fontSize?: string;
  fontWeight?: string;
  /** Per-topic shape (CSS border-radius, e.g. "4px" box, "999px" pill). */
  borderRadius?: string;
  /** Per-topic geometric shape (diamond/ellipse/parallelogram/hexagon/cylinder/trapezoid/
   *  octagon/document/callout/star/cloud). When set to a geometric shape the node is drawn as
   *  an SVG path; otherwise borderRadius rules. */
  shape?: NodeShape;
  /** Per-topic outline (CSS border shorthand, e.g. "2px solid #e23"). */
  border?: string;
  fontFamily?: string;
  textDecoration?: string;
  /** Fill treatment derived from the topic's branch colour (or its explicit `background`): a soft
   *  branch-colour `tint`, or a vertical `gradient`. Absent = a flat fill (today's look). */
  fill?: "tint" | "gradient";
  /** Image that fills the whole topic (a data: URL), covering the card — distinct from the side
   *  `image`. Takes precedence over `background` / `fill`. Lossless in .json; ignored by flat formats. */
  fillImage?: string;
  /** Max topic width as a CSS px string (e.g. "180px"): a long label wraps to this width instead of
   *  stretching. Honoured by the layout estimate, the canvas, and the SVG export. */
  maxWidth?: string;
  /** Raised look: a soft drop shadow under the topic card (canvas CSS + SVG export filter). */
  shadow?: boolean;
}

export interface MapImage {
  url: string;
  width?: number;
  height?: number;
}

/** A file attached to a topic, stored inline as a data URL so maps stay offline + portable. */
export interface MapAttachment {
  name: string;
  /** The file contents as a data: URL. */
  dataUrl: string;
  /** Size in bytes (for display). */
  size: number;
}

/** A small annotation bubble anchored to a node (MindManager "callout"). */
export interface Callout {
  id: string;
  text: string;
  /** Offset of the bubble from the node's right edge / vertical centre, in flow units. */
  dx: number;
  dy: number;
  /** Colour override (the bubble's accent); absent = the default sticky-yellow. Lossless in .json. */
  color?: string;
}

export interface MapNode {
  id: NodeId;
  /** Stable id from the source document. Importers keep this separate from the editor id so a
   *  foreign container can later be updated without discarding unknown source-only fields. */
  sourceId?: string;
  /** Plain-text topic — always kept in sync as the fallback for search, outline, and exports. */
  topic: string;
  /**
   * Optional inline rich-text HTML (a sanitised subset: bold/italic/underline/strike + safe
   * spans) shown on the React Flow canvas. `topic` stays the plain fallback, so every io/*
   * exporter, search, and the outline are untouched. Lossless in .json; ignored by flat formats.
   */
  topicRich?: string;
  note?: string;
  hyperlink?: string;
  /**
   * Additional hyperlinks beyond the primary `hyperlink` (a topic can point at more than one place).
   * The primary stays canonical — the canvas 🔗, exporters, and single-link consumers use it — while
   * these extras are managed in the inspector and picked up by search + the cross-map/in-map backlink
   * scans. Additive + optional: a clean node omits it; absent ⇒ no extras.
   */
  hyperlinks?: string[];
  image?: MapImage;
  /** Marker / icon ids (priority, progress, flags, ...). */
  icons?: string[];
  tags?: string[];
  /** Files attached to this topic (inline data URLs); lossless in .json, ignored by flat formats. */
  attachments?: MapAttachment[];
  style?: NodeStyle;
  collapsed?: boolean;
  task?: TaskInfo;
  /** Anchored annotation bubbles (MindManager callouts); lossless in .json, ignored by flat formats. */
  callouts?: Callout[];
  children: MapNode[];
  /** For the two-sided radial layout; left undefined = engine decides. */
  side?: "left" | "right";
  /** Free-canvas position (top-left, in flow coords). Used only when the map is in freeform mode
   *  (`meta.freeform`); the auto-layouts ignore it. Lossless in .json, ignored by flat exporters. */
  pos?: { x: number; y: number };
  /** Pin this node in place: in freeform mode it can't be dragged and align / distribute skip it, so a
   *  carefully-placed topic stays put. Inert in the auto-layouts. Lossless in .json, ignored by flat
   *  exporters. */
  locked?: boolean;
  /** Per-branch layout override: this node's subtree lays out with this layout kind (a `LayoutKind`)
   *  instead of the map's. Lossless in .json, ignored by flat exporters. */
  layout?: string;
  /** Per-branch connector colour (`#rrggbb`): overrides the auto-cycled palette for this node AND its
   *  subtree's branches (the subtree inherits it). Lossless in .json, ignored by flat exporters. */
  branchColor?: string;
  /** Line style of THIS node's incoming branch connector; absent = solid. Lossless in .json. */
  lineDash?: "solid" | "dashed" | "dotted";
  /** Roll-up source: the library map id this node mirrors. On "Refresh roll-ups" the node's children
   *  are replaced with a fresh copy of that map's branches — so one map can aggregate several others.
   *  Lossless in .json, ignored by flat exporters. */
  rollup?: string;
  /** Created (ms epoch), stamped when the node is born. Lossless in .json, ignored by flat exporters
   *  and never drawn on the canvas; shown in the inspector facts line. Optional → pre-timestamp maps
   *  are valid and backfill `createdAt` on their first content edit. */
  createdAt?: number;
  /** Last content-edit time (ms epoch), bumped on any content/property edit (not pure restructuring).
   *  Lossless in .json, ignored by flat exporters; shown in the inspector facts line. */
  modifiedAt?: number;
}

/** A labelled cross-link between two nodes (MindManager "relationship"). The optional style fields
 *  are json-lossless and ignored by flat exporters; when absent the link renders with today's look
 *  (a single arrowhead at the target, the shared accent colour, 1.5px dashed). */
export interface CrossLink {
  id: string;
  from: NodeId;
  to: NodeId;
  label?: string;
  /** Which end(s) carry an arrowhead. Absent = "to" (the historical single-headed default). */
  arrow?: "to" | "from" | "both" | "none";
  /** Stroke colour override; absent = the shared CROSSLINK_COLOR accent. */
  color?: string;
  /** Stroke width override (px); absent = CROSSLINK_WIDTH. */
  width?: number;
  /** Line style; absent = "dashed" (the historical CROSSLINK_DASH). */
  dash?: "dashed" | "solid" | "dotted";
  /** Signed perpendicular offset (px) of the arc's midpoint from the straight chord — the draggable
   *  curve handle / inspector sets it to bow the relationship around clutter. Absent = a gentle
   *  auto-bow. Lossless in .json, ignored by flat exporters. */
  curve?: number;
  /** Semantic category of the relationship (a small fixed vocabulary). Absent = "relates-to" (the
   *  historical plain relationship). Drives the optional on-canvas type pill, conditional formatting
   *  ("relationshipType" rules), and the Power Filter's "has relationship" query. Lossless in .json,
   *  dropped by flat exporters (incl. .mmap — MindManager has its own relationship-type system). */
  type?: RelationshipType;
}

/** The fixed vocabulary of relationship categories (see CrossLink.type). "relates-to" is the default
 *  (an absent `type`), matching today's plain relationship. */
export type RelationshipType = "relates-to" | "depends-on" | "causes" | "supports" | "blocks";

/** A visual grouping around a set of nodes (MindManager "boundary"). */
export interface Boundary {
  id: string;
  nodeIds: NodeId[];
  label?: string;
  /** Stroke/fill override; absent = the shared boundary accent. Lossless in .json. */
  color?: string;
  /** Outline shape; absent = "roundRect" (the historical rounded box). Lossless in .json. */
  shape?: "roundRect" | "rect" | "ellipse" | "cloud" | "polygon";
  /** Outline line style; absent = solid. Lossless in .json. */
  dash?: "solid" | "dashed" | "dotted";
}

/** A labelled bracket spanning a node + its subtree (MindManager "summary topic"). Like a Boundary,
 *  but drawn as a bracket to one side with a label, rather than a box enclosing the nodes. */
export interface Summary {
  id: string;
  nodeIds: NodeId[];
  label?: string;
  /** Bracket/label colour override; absent = the default green. Lossless in .json. */
  color?: string;
}

/** What a single condition (the rule's primary kind/value, or an `also` clause) matches:
 *  - `tag` / `marker` — the node carries `value`
 *  - `completed` — task rolled up to 100%
 *  - `overdue` — a task past its due date and not finished
 *  - `dueSoon` — a task due within the filter/search "soon" window, not finished
 *  - `priority` — task priority at or above `value` (1=High; matches priority ≤ value)
 *  - `textContains` — the topic text includes `value` (case-insensitive)
 *  - `hasAttachment` — the node has at least one attached file
 *  - `relationshipType` — the node is an endpoint (source or target) of a relationship whose
 *    `type` equals `value` (a `RelationshipType`; blank `value` = any typed or plain relationship) */
export type RuleConditionKind =
  | "tag"
  | "marker"
  | "completed"
  | "overdue"
  | "dueSoon"
  | "priority"
  | "textContains"
  | "hasAttachment"
  | "relationshipType";

/** One extra AND-ed clause in a rule's `also` list (see `ConditionalRule`). */
export interface RuleCondition {
  kind: RuleConditionKind;
  /** The tag/marker/text to match, the priority threshold, or the relationship type (unused for
   *  completed/overdue/dueSoon/hasAttachment). */
  value?: string;
  /** Invert this clause's match. */
  negate?: boolean;
}

/** A conditional-formatting rule: topics matching `kind`/`value` (AND every clause in `also`, each
 *  optionally negated) get `style` applied (view-only). */
export interface ConditionalRule {
  id: string;
  kind: RuleConditionKind;
  /** The tag/marker/text to match, the priority threshold, or the relationship type (unused for
   *  completed/overdue/dueSoon/hasAttachment). */
  value?: string;
  /** Invert the primary `kind`/`value` match. */
  negate?: boolean;
  /** Extra conditions AND-ed with the primary one (each independently negatable). Absent/empty =
   *  the primary condition alone, unchanged from before this field existed. */
  also?: RuleCondition[];
  /** View-only style layered onto a matching node (under its own explicit style). */
  style: NodeStyle;
  /** Action: markers auto-applied to a matching node (view-only, unioned with the node's own). */
  icons?: string[];
  /** Action: branch colour applied to a matching node + its subtree (a manual `branchColor` wins). */
  branchColor?: string;
}

/** A dedicated diagram backdrop drawn behind freely-positioned topics (a geometric frame). The
 *  region labels are ordinary topics placed at the frame's anchors — the backdrop is just the shape. */
export type BackdropKind = "onion" | "funnel" | "venn2" | "venn3";
export interface Backdrop {
  kind: BackdropKind;
  /** Ring/stage count for onion + funnel (ignored by the fixed venn frames). */
  rings?: number;
  /** Stroke/fill override; absent = the default backdrop accent. Lossless in .json. */
  color?: string;
}

/** A free background shape drawn behind the topics for ad-hoc composition — SWOT quadrants, Venn
 *  frames, block arrows, chevrons (Tier 4 item 23). Unlike the singleton `backdrop`, shapes are
 *  multi-instance and freely positioned + sized. Adding one flips free-canvas mode on, but rendering is
 *  ungated (a shape shows whenever present). Lossless in .json, ignored by flat exporters, carried into
 *  the image/PDF/HTML export (canvas == export). */
export type CanvasShapeKind = "rect" | "ellipse" | "blockArrow" | "chevron" | "swimlane" | "matrix";
export interface CanvasShape {
  id: string;
  kind: CanvasShapeKind;
  /** Top-left corner in flow coords. */
  pos: { x: number; y: number };
  /** Width/height in flow units. */
  size: { w: number; h: number };
  /** Stroke/fill accent (`#rrggbb`); absent = the default shape accent. */
  color?: string;
  /** Optional label centred in the shape (a shape caption; lane/cell headers for containers). */
  label?: string;
  /** Lane count (swimlane) or column count (matrix); ignored by plain shapes. Container kinds only. */
  lanes?: number;
  /** Row count (matrix only). */
  rows?: number;
}

// --- Saved views + the filter criteria they capture -------------------------
//
// These live in the model rather than beside the filter/view UI because they are now part of the
// PERSISTED document (meta.savedViews) — a saved view captures a viewport and a drilled-in topic id,
// both meaningless outside their map. `filter.ts` and `savedViews.ts` re-export them, so every
// existing import site is unchanged.

/** Due-date filter mode: any (off), has a date, overdue, or due within ~a week. */
export type DueMode = "" | "dated" | "overdue" | "soon";

/** "Has relationship" direction (see FilterCriteria.relDir). Undefined = the constraint is off. */
export type RelDir = "out" | "in" | "either";

/** Completion-status filter mode: any (off), fully done, not done, or partially done. */
export type CompletionMode = "" | "complete" | "incomplete" | "in-progress";

export interface FilterCriteria {
  text: string;
  /** A node must carry at least one of these markers (icons). Empty = no marker constraint. */
  markers: string[];
  /** A node must carry at least one of these tags. Empty = no tag constraint. */
  tags: string[];
  /** Due-date constraint (optional, so older saved filters without it still load). */
  due?: DueMode;
  /** Task-priority constraint: 1=High..3=Low, or 0/undefined for "any". */
  priority?: number;
  /** Completion constraint over the node's rolled-up progress; only task-bearing nodes match.
   *  "" / undefined = any. (Optional, so older saved filters still load.) */
  completion?: CompletionMode;
  /** "Has relationship" constraint: the node must be an endpoint of a relationship in this direction
   *  (outgoing = its `from`, incoming = its `to`, either = both). Undefined = off. */
  relDir?: RelDir;
  /** Narrow the "has relationship" constraint to relationships of this type; undefined = any type. */
  relType?: RelationshipType;
}

/** A bookmarked perspective on a map: viewport + drill target + the Power Filter that was on. */
export interface SavedView {
  id: string;
  name: string;
  viewport: { x: number; y: number; zoom: number };
  /** The drilled-in topic id, or null for the whole map. */
  drillId: string | null;
  /** The active Power-Filter criteria, or null when no filter was on. */
  criteria: FilterCriteria | null;
}

export interface MindMapDoc {
  schemaVersion: 1;
  id: string;
  title: string;
  root: MapNode;
  links?: CrossLink[];
  boundaries?: Boundary[];
  /** Conditional-formatting rules (style topics by tag/marker/completed); view-only, per map. */
  rules?: ConditionalRule[];
  /** Summary brackets (a labelled bracket beside a node's subtree). */
  summaries?: Summary[];
  /** A dedicated diagram backdrop (onion / funnel / Venn) drawn behind freely-positioned topics. */
  backdrop?: Backdrop;
  /** Free background shapes + smart containers drawn behind the topics (Tier 4 items 23 + 22). */
  shapes?: CanvasShape[];
  /** Top-level topics not attached to the central hierarchy (legends, notes). */
  floatingTopics?: MapNode[];
  theme?: string;
  meta?: {
    createdAt?: string;
    /** Last-edited time (ms epoch), stamped on every save; drives the start screen's Recent grouping. */
    updatedAt?: number;
    /** Where this doc came from: "sample" | "mmap" | "markdown" | ... */
    source?: string;
    /** Per-map canvas background colour (CSS colour); overrides the theme. Lossless in .json,
     *  ignored by flat exporters; carried into the image/PDF export. */
    background?: string;
    /** Per-map canvas background image, stored inline as a data: URL (like node images) so maps
     *  stay offline + portable. Drawn behind everything, on top of the background colour. Lossless
     *  in .json, ignored by flat exporters; carried into the image/PDF/HTML export. */
    backgroundImage?: string;
    /** Free-canvas (whiteboard) mode: nodes use their own `pos` instead of an auto-layout, and
     *  dragging a node moves it freely rather than re-parenting it. */
    freeform?: boolean;
    /** Line-jumps: draw a small semicircular "hop" where two relationship lines cross, so the
     *  crossing reads as "passes over", not "joins" (MindManager convention). Off by default.
     *  Lossless in .json, ignored by flat exporters; carried into the image/PDF/HTML export. */
    lineJumps?: boolean;
    /** Connector (branch line) style for the whole map: "organic" (the adaptive tapered default),
     *  "curved", "elbow" (right-angle), or "straight". Absent = "organic". Lossless in .json, ignored
     *  by flat exporters; carried into the image/PDF/HTML export. */
    connectorStyle?: "organic" | "curved" | "elbow" | "straight";
    /** Branch "growth" weight for the whole map: how thick the branch lines render — "fine", "regular"
     *  (absent = the historical default), or "bold". A Design sets it so applying a theme also picks a
     *  coherent line weight. Lossless in .json, ignored by flat exporters; carried into the image/PDF/
     *  HTML export (canvas == export). */
    branchGrowth?: BranchGrowth;
    /** Map-wide accent colour: the default stroke for relationships + boundaries when they carry no
     *  per-object colour (a Design sets it so applying a theme recolours them coherently). Absent =
     *  the historical purple accent. Lossless in .json. */
    accentColor?: string;
    /** Outline-numbering scheme used when numbering is shown: "decimal" (1, 1.1, 1.1.1 — the default)
     *  or "outline" (the legal outline I, A, 1, a, i by level). Absent = "decimal". Lossless in .json. */
    numberStyle?: NumberStyle;
    /** Show the map legend (markers / tags / conditional rules in use) on the canvas + in exports.
     *  Off by default. Lossless in .json, ignored by flat exporters. */
    legend?: boolean;
    /** Bookmarked perspectives on this map (viewport + drill target + filter). Stored on the doc
     *  rather than in localStorage so they travel with a `.json`/`.ithread` export and across machines;
     *  a view references this map's own topic ids, so it belongs to the document. Migrated once from
     *  the old per-map `mindmap-views:<id>` localStorage key. Lossless in .json, ignored by flat
     *  exporters. */
    savedViews?: SavedView[];
    /** Show a small type pill (e.g. "causes") on every relationship that carries a non-default `type`.
     *  Off by default. Lossless in .json, ignored by flat exporters; carried into the image/PDF/HTML
     *  export (canvas == export). */
    showLinkTypes?: boolean;
    /** Map-wide base font family (CSS family list) used as the default for every topic; a per-topic
     *  `NodeStyle.fontFamily` still overrides it. Absent = the canvas default. Lossless in .json,
     *  carried into the SVG/image/PDF export (canvas == export). */
    fontFamily?: string;
    /** Map-wide font-size scale applied on top of the per-depth defaults: "compact" (0.85×),
     *  "comfortable" (1×, the default), or "large" (1.2×). A per-topic `NodeStyle.fontSize` still
     *  overrides it. Absent = "comfortable". Threaded through the layout estimate, the canvas, and the
     *  export so all three agree. Lossless in .json. */
    fontScale?: FontScale;
    /** Custom presentation deck: an explicit, ordered list of slides (overriding the auto walk-through
     *  of overview + one slide per top branch). Each entry points at a topic by `nodeId` (the sentinel
     *  `"overview"` = the root overview slide) with an optional per-slide speaker `note` that overrides
     *  the topic's own note in the presenter view. Absent/empty ⇒ the auto deck. Entries whose `nodeId`
     *  no longer resolves are skipped. Additive + lossless in .json. */
    slides?: SlideRef[];
    /** Pinned/favourited: the user curated this map to stay at the top of the library lists,
     *  independent of recency. Additive + lossless in .json. */
    pinned?: boolean;
    /** Soft-delete timestamp (ms epoch): when set, the map is in the Trash — hidden from the normal
     *  library but recoverable (Restore) until permanently deleted. Absent ⇒ live. Additive. */
    trashedAt?: number;
    /** Library folder this map is filed under (a Folder id from the local `folders` list). Absent ⇒
     *  top-level ("All maps"). Additive + lossless in .json; carried in the library backup. (C2) */
    folderId?: string;
  };
}

/** One entry in a custom presentation deck (see meta.slides). */
export interface SlideRef {
  /** The topic to present, by id; the sentinel `"overview"` selects the root overview slide. */
  nodeId: string;
  /** Optional speaker note shown for this slide, overriding the topic's own `note`. */
  note?: string;
}

/** Outline-numbering scheme (see meta.numberStyle). */
export type NumberStyle = "decimal" | "outline";

/** Map-wide font-size scale (see meta.fontScale). */
export type FontScale = "compact" | "comfortable" | "large";

/** Branch line-weight ("growth") for the whole map (see meta.branchGrowth). "regular" = the historical
 *  default widths; "fine" thins every branch, "bold" thickens them. */
export type BranchGrowth = "fine" | "regular" | "bold";
