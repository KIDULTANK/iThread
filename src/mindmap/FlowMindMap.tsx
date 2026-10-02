import "@xyflow/react/dist/style.css";
import {
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ContextMenu, MenuItem, MenuLabel, MenuSeparator } from "../design/primitives";
import { colors, motion } from "../design/tokens";
import { useLongPress } from "../hooks/useLongPress";
// `../i18n/registry`, NOT the `../i18n` barrel: the barrel pulls in the eager core catalogue, which
// would drag the whole chrome catalogue into this lazy chunk. The side-effect import registers the
// canvas catalogue when this chunk loads. There's a test asserting the canvas strings stay out of the
// entry chunk.
import { t } from "../i18n/registry";
import { MARKER_PALETTE, markerImage } from "../icons";
import "./flow/messages";
import { parseOutline } from "../io/pasteOutline";
import { hasFormatting, parseInlineMarkdown, richToPlain, sanitizeRich } from "../io/richText";
import { isDangerousUrl } from "../io/urlSafety";
import type { Boundary, CanvasShape, MapNode, MindMapDoc, Summary } from "../model/types";
import { PRIORITY_LEVELS, cyclePriority, priorityLabel } from "../priority";
import { stepTaskProgress } from "../progress";
import { isStandalonePwa } from "../pwa/standalone";
import { setSavedViews } from "../savedViews";
import { getBranches, setBranches } from "../store/branchClipboard";
import { todayISO } from "../taskDate";
import { useIsMobile } from "../useIsMobile";
import {
  type CanvasSession,
  type DocSnapshot,
  type MindMapHandle,
  type MindMapProps,
  type SelectedOverlay,
  classifyLink,
} from "./contract";
import { BackgroundImage } from "./flow/BackgroundImage";
import { Boundaries } from "./flow/Boundaries";
import { BraceConnectors } from "./flow/BraceConnectors";
import { BranchEdge } from "./flow/BranchEdge";
import { BulkNodeMenu } from "./flow/BulkNodeMenu";
import { type CalloutAnchor, Callouts } from "./flow/Callouts";
import { CoachMark, DropLabel, LegendPanel, MinimapPanel, StatusBar } from "./flow/CanvasOverlays";
import { CanvasOverlaysSR } from "./flow/CanvasOverlaysSR";
import { CanvasRelationshipsSR } from "./flow/CanvasRelationshipsSR";
import { CrosslinkEdge } from "./flow/CrosslinkEdge";
import { DiagramBackdrop } from "./flow/DiagramBackdrop";
import { NodePopover } from "./flow/NodePopover";
import { ShapeLayer } from "./flow/ShapeLayer";
import { Summaries } from "./flow/Summaries";
import { TopicNode } from "./flow/TopicNode";
import {
  LAYOUT_ANIM_MS,
  easeOutQuint,
  lerp,
  prefersReducedMotion,
  shouldAnimateLayout,
} from "./flow/animateLayout";
import { type BraceGroup, computeBraces } from "./flow/brace";
import { type BuildFlowStateResult, buildFlowState } from "./flow/buildFlowState";
import { resolveDropTarget } from "./flow/dropTarget";
import { EditingContext } from "./flow/editing";
import { type NodeRect, buildFlowSvg } from "./flow/exportSvg";
import { nodeAtPoint } from "./flow/floating";
import {
  buildFlowStateFallback,
  shouldBuildFlowStateInWorker,
  startFlowStateWorkerBuild,
} from "./flow/flowStateWorkerClient";
import {
  type History,
  createHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
} from "./flow/history";
import { keyIntent } from "./flow/keyIntent";
import type { LinkCandidate } from "./flow/linkAutocomplete";
import { LinkEditContext } from "./flow/linkEdit";
import { countDescendants, subtreeIds, walkTree as walkNodeTree } from "./flow/nodeWalk";
import {
  type OpResult,
  addAttachment,
  addCallout,
  addChild,
  addFloatingTopic,
  addHyperlink,
  addLink,
  addShape,
  addSibling,
  addSiblingBefore,
  addStickyNote,
  addSubtree,
  alignNodes,
  applyAcrossIds,
  assignBranchColors,
  balanceMap,
  bulkToggleIcon,
  bulkToggleTag,
  clearBackdrop,
  deleteBoundary,
  deleteCallout,
  deleteLink,
  deleteNode,
  deleteNodes,
  deleteShape,
  deleteSummary,
  deleteTag,
  detachBranch,
  distributeNodes,
  findAnyNode,
  findNode,
  findParent,
  groupBranch,
  groupNodes,
  groupSummary,
  indent,
  isolateBranch,
  maximalBranchIds,
  mergeStyle,
  moveInTree,
  moveSelectionInTree,
  moveSibling,
  nextSelectionId,
  outdent,
  pasteBranch,
  removeAttachment,
  removeHyperlink,
  renameTag,
  reparent,
  replaceTopics,
  selectionFields,
  selectionMarkers,
  selectionTags,
  setAccentColor,
  setAllExpanded,
  setBackdrop,
  setBackdropColor,
  setBackdropRings,
  setBackground,
  setBackgroundImage,
  setBoundaryColor,
  setBoundaryDash,
  setBoundaryLabel,
  setBoundaryShape,
  setBranchColor,
  setBranchExpandedToLevel,
  setBranchGrowth,
  setCalloutColor,
  setCalloutText,
  setConnectorStyle,
  setDue,
  setExpandedToLevel,
  setFontFamily,
  setFontScale,
  setFreeform,
  setHyperlink,
  setIcons,
  setImage,
  setLegend,
  setLineDash,
  setLineJumps,
  setLinkArrow,
  setLinkLabel,
  setLinkStyle,
  setNodeLayout,
  setNodePos,
  setNodePositions,
  setNodeSide,
  setNote,
  setNumberStyle,
  setPriority,
  setProgress,
  setRollup,
  setRules,
  setShapeColor,
  setShapeKind,
  setShapeRect,
  setShowLinkTypes,
  setSlides,
  setStart,
  setSummaryColor,
  setSummaryLabel,
  setTags,
  setTopic,
  setTopicRich,
  shiftDates,
  sortChildren,
  subtreeExportDoc,
  toggleCollapse,
  toggleIcon,
  toggleLocked,
  viewDoc,
} from "./flow/ops";
import type { NodeSizes } from "./flow/ops";
import {
  type OverlaySelect,
  resolveSelectedEdge,
  resolveSelectedNode,
  resolveSelectedOverlay,
} from "./flow/selectionResolve";
import { moveShapeAndCapture } from "./flow/shapeCapture";
import { type GuideLine, computeSnap } from "./flow/snap";
import type { EdgeData, FlowEdge, TopicNode as TopicNodeT } from "./flow/types";
import { useLatestRef } from "./flow/useLatestRef";
import { shouldVirtualize } from "./flow/virtualize";
import { mindManagerTheme } from "./theme";

// React Flow canvas — a fully editable engine. Inline topic editing (double-click / F2),
// keyboard tree-building (Enter/Tab/Shift+Tab/Delete), drag-to-reparent, a right-click context
// menu, undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, doc-snapshot stack), theming via CSS vars,
// SVG export (native <text>, authored from the model + live node rects), and the model-mutating
// MindMapHandle methods. Every edit is a pure op on the canonical doc → re-project → re-layout →
// onChange, so the model is the single source of truth.

const nodeTypes = { topic: TopicNode };
const edgeTypes = { branch: BranchEdge, crosslink: CrosslinkEdge };

// Undo coalescing window (S4): repeated same-key cycle edits (priority/progress/task) inside this many
// ms collapse into one undo step, so a chip-spree reverts in a single Ctrl+Z.
const COALESCE_MS = 600;

// Per-overlay-kind op table: routes a label / colour / delete edit to the right boundary / summary /
// callout op, so the three-way kind dispatch lives in ONE place instead of being re-spelled in each
// overlay handle method (add a 4th overlay kind → one entry here, not three edits).
const OVERLAY_OPS: Record<
  SelectedOverlay["kind"],
  {
    label: (
      doc: MindMapDoc,
      sel: SelectedOverlay,
      value: string,
    ) => ReturnType<typeof setBoundaryLabel>;
    color: (
      doc: MindMapDoc,
      sel: SelectedOverlay,
      value: string,
    ) => ReturnType<typeof setBoundaryColor>;
    del: (doc: MindMapDoc, sel: SelectedOverlay) => ReturnType<typeof deleteBoundary>;
  }
> = {
  boundary: {
    label: (d, s, v) => setBoundaryLabel(d, s.id, v),
    color: (d, s, v) => setBoundaryColor(d, s.id, v),
    del: (d, s) => deleteBoundary(d, s.id),
  },
  summary: {
    label: (d, s, v) => setSummaryLabel(d, s.id, v),
    color: (d, s, v) => setSummaryColor(d, s.id, v),
    del: (d, s) => deleteSummary(d, s.id),
  },
  callout: {
    label: (d, s, v) => setCalloutText(d, s.nodeId ?? "", s.id, v),
    color: (d, s, v) => setCalloutColor(d, s.nodeId ?? "", s.id, v),
    del: (d, s) => deleteCallout(d, s.nodeId ?? "", s.id),
  },
};

// Shared empty arrays so the boundary/summary overlays get a stable prop ref when the doc has none
// (a fresh `[]` each render would defeat their React.memo). Frozen to flag them as never-mutated.
const EMPTY_BOUNDARIES: readonly Boundary[] = Object.freeze([]);
const EMPTY_SUMMARIES: readonly Summary[] = Object.freeze([]);
const EMPTY_SHAPES: CanvasShape[] = [];

type TopicMenuItem = {
  id: string;
  label: string;
  run: () => void;
  danger?: boolean;
  shortcut?: string;
};

function themeVars(theme: MindMapProps["theme"]): CSSProperties {
  const v = (theme ?? mindManagerTheme).cssVar;
  return {
    "--mm-node-bg": v["--bgcolor"],
    "--mm-color": v["--color"],
    "--mm-root-bg": v["--root-bgcolor"],
    "--mm-root-color": v["--root-color"],
    "--mm-line-color": v["--line-color"],
    background: v["--main-bgcolor"],
  } as CSSProperties;
}

function FlowInner({
  doc,
  theme,
  direction = "side",
  numbered = false,
  spellcheck = false,
  litIds = null,
  hideUnmatched = false,
  highlightIds = null,
  drillId = null,
  onChange,
  onSelect,
  onSelectionCount,
  onSelectionFields,
  onSelectionMarkerTags,
  onSelectEdge,
  onSelectOverlay,
  onOpenNote,
  onMapLink,
  onDropFilesOnNode,
  onExportBranch,
  onHistory,
  onDelete,
  onHint,
  initialSession,
  libraryMaps = [],
  reducedMotion = false,
  activeView = "map",
  onSetView,
  ref,
}: MindMapProps) {
  const palette = (theme ?? mindManagerTheme).palette;
  const isMobile = useIsMobile();
  // Latest-value ref so the many viewport-animation callsites can read the current reduced-motion
  // preference without each callback/handle taking it as a dependency (refs are exempt from
  // exhaustive-deps). Each animation duration becomes 0 when motion is reduced.
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  // Drill-in (#4): re-root the *view* at `drillId` so its subtree fills the canvas. `viewDoc` returns
  // the full doc unchanged when not drilled, so the normal path is untouched; edits still run on the
  // full doc (docRef), making drilling a pure view transform.
  const viewOf = useMemo(() => viewDoc(doc, drillId), [doc, drillId]);
  // Avoid doing the expensive first projection/layout during React render. Small maps still paint in
  // the first frame; a fully expanded large map starts empty and is populated by sync()'s worker.
  const deferInitialFlow = useMemo(() => shouldBuildFlowStateInWorker(viewOf), [viewOf]);
  const initialFlow = useMemo<BuildFlowStateResult>(() => {
    if (deferInitialFlow) return { nodes: [], edges: [] };
    return buildFlowState({
      doc: viewOf,
      palette,
      numbered,
      kind: viewOf.meta?.freeform ? "freeform" : direction,
      measured: [],
      selectedIds: new Set(),
      selectedEdgeId: null,
      litIds,
      hideUnmatched,
      highlightIds,
      rollupTitles: new Map(libraryMaps.map((m) => [m.id, m.title])),
    });
  }, [
    deferInitialFlow,
    viewOf,
    palette,
    numbered,
    direction,
    litIds,
    hideUnmatched,
    highlightIds,
    libraryMaps,
  ]);
  const [nodes, setNodes, onNodesChange] = useNodesState<TopicNodeT>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialFlow.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Multi-selection: this set drives the canvas selection flags; `selectedId` is the anchor (the
  // last-touched node) that every single-node behaviour — keyboard, popover, per-item edits — keeps
  // using. For a single selection the set is just {anchor}.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // The selected relationship (cross-link) edge, if any. Mutually exclusive with node selection —
  // selecting an edge clears the node anchor/set and vice-versa; drives the EdgeInspector + the halo.
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // The selected overlay object (boundary / summary / callout), if any. The 4th selection channel —
  // mutually exclusive with node + edge; drives the OverlayInspector + the overlay halo.
  const [selectedOverlay, setSelectedOverlay] = useState<SelectedOverlay | null>(null);
  // The selected free background shape / container (Tier 4 items 23 + 22), if any. A peer selection
  // channel — mutually exclusive with node / edge / overlay; drives the shape halo + inline toolbar.
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Optional initial text for explicit edit entry points such as the slash command menu.
  // (caret at end); null for a normal edit (double-click / F2 / new node → seed topic, select all).
  const [editSeed, setEditSeed] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  // Relationship right-click menu (edit label / arrow / line / type / delete) — the edge counterpart
  // of the node menu, replacing the old jump-straight-to-delete confirm.
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  // Empty-pane right-click menu (add topic / paste branch / fit / reset zoom). Separate from the node
  // menu above; opened from the canvas wrapper's onContextMenu when the bare pane is the target.
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);
  // Touch/pen long-press on the bare canvas → the same pane menu right-click opens (touch has no
  // right-click). The target guard mirrors onContextMenu so a press on a node/control doesn't fire it.
  const paneLongPress = useLongPress((e) => {
    if ((e.target as HTMLElement)?.classList?.contains("react-flow__pane")) {
      setMenu(null);
      setPaneMenu({ x: e.clientX, y: e.clientY });
    }
  });
  // Right-click menu for overlays (boundary / summary / callout) — recolour / shape / delete. Kept
  // separate from the node `menu` (which is keyed by node id) since it carries the selected overlay.
  const [overlayMenu, setOverlayMenu] = useState<{
    x: number;
    y: number;
    overlay: { kind: SelectedOverlay["kind"]; id: string; nodeId?: string };
  } | null>(null);
  // While set, the next node click completes a relationship from this node (the "Link to…" gesture).
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  // The corner minimap can be collapsed (it covers dense maps); the choice persists. It defaults open
  // on desktop but closed on a phone, where an open minimap covers a big share of the small canvas and
  // overlaps the bottom status bar — an explicit stored choice still wins.
  const [minimapOpen, setMinimapOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("mindmap-minimap-open");
      if (stored !== null) return stored !== "false";
      return !isMobile;
    } catch {
      return !isMobile;
    }
  });
  const toggleMinimap = () =>
    setMinimapOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("mindmap-minimap-open", String(next));
      } catch {
        // preference is best-effort
      }
      return next;
    });
  // The current doc, mirrored for render-time consumers (boundary + callout overlays). The
  // canvas is model-first: edits update docRef + RF state via sync(); App keeps the `doc` prop
  // stable during a session, so the overlays must track this live copy, not the prop.
  const [renderDoc, setRenderDoc] = useState(doc);
  // The empty-map coachmark (#1) is dismissed for good on the first edit (any path into edit mode).
  const [coachDismissed, setCoachDismissed] = useState(false);
  // During a drag-to-reparent, the node the dragged topic would drop under (highlighted live). (#11)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // During a drag-to-reorder, the sibling edge an insertion line marks (drop before/after). (#8)
  const [insertEdge, setInsertEdge] = useState<{ id: string; after: boolean } | null>(null);
  // Free-canvas alignment guide lines shown while dragging (cleared on drag stop).
  const [guides, setGuides] = useState<GuideLine[]>([]);
  // The cross-link whose label is being inline-edited on the canvas (double-click), or null.
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const {
    fitView,
    getNodes,
    setCenter,
    getViewport,
    setViewport,
    screenToFlowPosition,
    zoomTo,
    zoomIn,
    zoomOut,
  } = useReactFlow();
  const initialized = useNodesInitialized();

  // Refs so the stable callbacks below always read the latest values.
  const docRef = useRef(doc);
  // Seed from a restored tab session (lossless tab switching) when one is supplied; else fresh.
  // Captured once at mount: App deletes the cached session right after restore (one-shot), so reading
  // the live prop later would flip ReactFlow's fitView false→true and re-fit away the restored
  // viewport. FlowInner remounts on a real tab/version change (its key), so this stays correct.
  const mountSession = useRef(initialSession);
  const historyRef = useRef<History<DocSnapshot>>(
    mountSession.current?.history ?? createHistory<DocSnapshot>(),
  );
  // Undo coalescing (S4): rapid repeated edits to the SAME node+field (priority / progress / task chip
  // spree) within COALESCE_MS collapse into ONE undo step — `apply` skips pushing a new snapshot while
  // the key matches inside the window, so undoing once jumps back to the pre-spree state. Any other
  // edit (no key / different key) resets it, preserving normal undo granularity.
  const coalesceRef = useRef<{ key: string; at: number } | null>(null);
  // Mirror refs: each tracks the latest prop/state so the stable callbacks below read live values
  // without re-creating. (docRef/historyRef/mountSession are NOT mirrors — they hold their own state.)
  const paletteRef = useLatestRef(palette);
  const directionRef = useLatestRef(direction);
  const drillIdRef = useLatestRef(drillId);
  const numberedRef = useLatestRef(numbered);
  const litIdsRef = useLatestRef(litIds);
  const hideUnmatchedRef = useLatestRef(hideUnmatched);
  const highlightIdsRef = useLatestRef(highlightIds);
  const libraryMapsRef = useLatestRef(libraryMaps);
  const selectedRef = useLatestRef(selectedId);
  const selectedIdsRef = useLatestRef(selectedIds);
  const selectedEdgeIdRef = useLatestRef(selectedEdgeId);
  const onSelectEdgeRef = useLatestRef(onSelectEdge);
  const selectedOverlayRef = useLatestRef(selectedOverlay);
  const onSelectOverlayRef = useLatestRef(onSelectOverlay);
  const editingRef = useLatestRef(editingId);
  // The id of the node just created via an add-and-edit (Tab/Enter/＋), so leaving it empty (Escape or
  // click-away) can discard it instead of stranding a blank node — MindManager-style. Cleared on commit.
  const justAddedRef = useRef<string | null>(null);
  // Set to a node id by runSlashCommand: the editor is about to unmount and its blur would otherwise
  // commit/discard the "/query" buffer, clobbering the command's effect. This makes the next
  // commit/cancel for that id a no-op. Self-clears when consumed; also reset on entering a fresh edit.
  const suppressCommitRef = useRef<string | null>(null);
  const linkingFromRef = useLatestRef(linkingFrom);
  const onChangeRef = useLatestRef(onChange);
  const onSelectRef = useLatestRef(onSelect);
  const onMapLinkRef = useLatestRef(onMapLink);
  const onOpenNoteRef = useLatestRef(onOpenNote);
  const onDropFilesOnNodeRef = useLatestRef(onDropFilesOnNode);
  const onExportBranchRef = useLatestRef(onExportBranch);
  const onHistoryRef = useLatestRef(onHistory);
  const onDeleteRef = useLatestRef(onDelete);
  const onHintRef = useLatestRef(onHint);
  // On mount, report the (possibly restored) history depths so the chrome's undo/redo buttons match a
  // restored tab session. A fresh canvas reports nothing-to-undo, which is also correct.
  useEffect(() => {
    const h = historyRef.current;
    onHistoryRef.current?.(h.past.length > 0, h.future.length > 0);
  }, []);
  const themeRef = useLatestRef(theme);

  // Layout-transition tween bookkeeping (#16): the in-flight rAF id + the loop's start timestamp.
  const layoutRaf = useRef<number | null>(null);
  const layoutStart = useRef<number | null>(null);
  // At most one large-map worker is alive. A later edit terminates it before starting the next build;
  // the generation check is a second guard against a late message overwriting a newer document.
  const flowBuildRef = useRef<ReturnType<typeof startFlowStateWorkerBuild>>(null);
  const flowGenerationRef = useRef(0);
  const pendingInitialFitRef = useRef(deferInitialFlow && !mountSession.current?.viewport);
  // Cancel running visual/background work if the canvas unmounts mid-calculation.
  useEffect(
    () => () => {
      if (layoutRaf.current != null) cancelAnimationFrame(layoutRaf.current);
      flowGenerationRef.current += 1;
      flowBuildRef.current?.cancel();
      flowBuildRef.current = null;
    },
    [],
  );

  // Re-project + re-layout from a doc (with measured sizes when available, else estimated).
  const sync = useCallback(
    (newDoc: MindMapDoc, nextSelected?: string | null, animate = false) => {
      // Cancel any in-flight layout tween — a fresh sync supersedes it (whether it animates or not).
      if (layoutRaf.current != null) {
        cancelAnimationFrame(layoutRaf.current);
        layoutRaf.current = null;
      }
      docRef.current = newDoc;
      // The view is re-rooted when drilled (pure transform); docRef stays the FULL doc so every edit,
      // undo, and onChange still operate on the whole map. Overlays read renderDoc, so it's the view.
      const view = viewDoc(newDoc, drillIdRef.current);
      setRenderDoc(view);
      // A structural op passes its result node as the next anchor → selection collapses to it. A
      // bulk edit passes nothing → the multi-selection set is preserved across the re-render.
      if (nextSelected !== undefined) {
        selectedRef.current = nextSelected;
        selectedIdsRef.current = nextSelected ? new Set([nextSelected]) : new Set();
      }
      // Free-canvas mode overrides the picked layout: nodes sit at their own `pos`. The kind also
      // drives project()'s org-chart elbow stamping, so compute it before projecting.
      const kind = newDoc.meta?.freeform ? "freeform" : directionRef.current;
      const measured = getNodes();
      // The whole model→canvas transform (project → layout → attachSide/attachBow → selection/dimming
      // flags) is pure. Only measured dimensions cross the worker boundary — React node data can hold
      // values that structured cloning cannot safely copy.
      const args = {
        doc: view,
        palette: paletteRef.current,
        numbered: numberedRef.current,
        kind,
        measured: measured.map(({ id, measured }) => ({ id, measured })),
        selectedIds: new Set(selectedIdsRef.current),
        selectedEdgeId: selectedEdgeIdRef.current,
        litIds: litIdsRef.current ? new Set(litIdsRef.current) : null,
        hideUnmatched: hideUnmatchedRef.current,
        highlightIds: highlightIdsRef.current ? new Set(highlightIdsRef.current) : null,
        rollupTitles: new Map(libraryMapsRef.current.map((m) => [m.id, m.title])),
      };
      const from = animate ? new Map(measured.map((n) => [n.id, n.position])) : null;
      const commit = ({ nodes, edges }: BuildFlowStateResult) => {
        // A deferred first paint needs an explicit fit: React Flow's mount-time fit ran while the
        // canvas was empty. Restored tab sessions keep their saved viewport and never enter this path.
        if (pendingInitialFitRef.current && nodes.length > 0) {
          pendingInitialFitRef.current = false;
          requestAnimationFrame(() =>
            fitView({ duration: reducedMotionRef.current ? 0 : motion.dur.fit }),
          );
        }
        const entering = new Set(from ? nodes.filter((n) => !from.has(n.id)).map((n) => n.id) : []);
        const moves =
          !!from &&
          shouldAnimateLayout(nodes.length) &&
          !prefersReducedMotion() &&
          (entering.size > 0 ||
            nodes.some((n) => {
              const f = from.get(n.id);
              return f && (f.x !== n.position.x || f.y !== n.position.y);
            }));
        if (!moves) {
          setEdges(edges);
          setNodes(nodes);
          return;
        }
        const nodeById = new Map(nodes.map((n) => [n.id, n]));
        const parentById = new Map(
          edges
            .filter((edge) => !edge.data?.crosslink)
            .map((edge) => [edge.target, edge.source] as const),
        );
        const originFor = (id: string) => {
          const parentId = parentById.get(id);
          return parentId
            ? (from.get(parentId) ?? nodeById.get(parentId)?.position)
            : nodeById.get(id)?.position;
        };
        const nodesAt = (e: number) =>
          nodes.map((n) => {
            const f = from.get(n.id) ?? originFor(n.id);
            return {
              ...n,
              position: f
                ? { x: lerp(f.x, n.position.x, e), y: lerp(f.y, n.position.y, e) }
                : n.position,
              data: entering.has(n.id) ? { ...n.data, motionProgress: e } : n.data,
            };
          });
        const edgesAt = (e: number): FlowEdge[] =>
          edges.map((edge) => {
            if (!entering.has(edge.target) || !edge.data) return edge;
            return { ...edge, data: { ...edge.data, motionProgress: e } };
          });
        // Put the first frame into the DOM immediately, then glide to the computed layout. A newly
        // revealed topic starts at its parent's anchor, fading/scaling in as its branch grows outward.
        setNodes(nodesAt(0));
        setEdges(edgesAt(0));
        const tick = (now: number) => {
          if (layoutStart.current == null) layoutStart.current = now;
          const t = Math.min(1, (now - layoutStart.current) / LAYOUT_ANIM_MS);
          const e = easeOutQuint(t);
          setNodes(nodesAt(e));
          if (entering.size > 0) setEdges(edgesAt(e));
          if (t < 1) {
            layoutRaf.current = requestAnimationFrame(tick);
          } else {
            setNodes(nodes);
            setEdges(edges);
            layoutRaf.current = null;
            layoutStart.current = null;
          }
        };
        layoutStart.current = null;
        layoutRaf.current = requestAnimationFrame(tick);
      };

      const generation = ++flowGenerationRef.current;
      flowBuildRef.current?.cancel();
      flowBuildRef.current = null;
      if (shouldBuildFlowStateInWorker(view)) {
        const build = startFlowStateWorkerBuild(generation, args);
        if (build) {
          flowBuildRef.current = build;
          void build.promise
            .then((state) => {
              if (generation !== flowGenerationRef.current) return;
              flowBuildRef.current = null;
              commit(state);
            })
            .catch(() => {
              if (generation !== flowGenerationRef.current) return;
              flowBuildRef.current = null;
              // Worker creation/runtime failure must not strand the canvas; pay the synchronous cost
              // once, while retaining the same freshness guard.
              commit(buildFlowStateFallback(args));
            });
          return;
        }
      }
      commit(buildFlowStateFallback(args));
    },
    [getNodes, setNodes, setEdges, fitView],
  );

  // Large first mounts deliberately skipped render-time layout above. Start their worker after React
  // commits, keeping the browser responsive enough to paint the app shell immediately.
  useEffect(() => {
    if (deferInitialFlow) sync(docRef.current);
  }, [deferInitialFlow, sync]);

  // Re-project + refit when the drill target changes (enter / exit / switch). Skips the initial mount
  // so it doesn't fight the restored-session viewport; thereafter a drill change re-roots and fits.
  const drillMounted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync reads drillIdRef; refit only on change.
  useEffect(() => {
    if (!drillMounted.current) {
      drillMounted.current = true;
      return;
    }
    sync(docRef.current);
    const raf = requestAnimationFrame(() =>
      fitView({ duration: reducedMotionRef.current ? 0 : motion.dur.fit }),
    );
    return () => cancelAnimationFrame(raf);
  }, [drillId, sync, fitView]);

  const fireSelect = useCallback((id: string | null) => {
    onSelectRef.current?.(resolveSelectedNode(docRef.current, id));
  }, []);

  // Emit the selected relationship (resolved, defaults filled) to the app's EdgeInspector, or null.
  const fireSelectEdge = useCallback((id: string | null) => {
    onSelectEdgeRef.current?.(resolveSelectedEdge(docRef.current, id));
  }, []);

  // Clear any selected relationship (when a node / the pane is selected — they're mutually exclusive).
  const clearEdgeSelection = useCallback(() => {
    if (selectedEdgeIdRef.current !== null) {
      setSelectedEdgeId(null);
      onSelectEdgeRef.current?.(null);
    }
  }, []);

  // Resolve + emit the selected overlay (boundary/summary/callout) to the OverlayInspector, or null.
  // The label is the raw stored value (the inspector edits it; the canvas applies display defaults).
  const fireSelectOverlay = useCallback((sel: OverlaySelect | null) => {
    if (!sel) {
      setSelectedOverlay(null);
      onSelectOverlayRef.current?.(null);
      return;
    }
    const resolved = resolveSelectedOverlay(docRef.current, sel);
    if (!resolved) return; // the overlay is gone — leave the current selection unchanged
    setSelectedOverlay(resolved);
    setSelectedShapeId(null); // overlay selection clears the shape channel
    onSelectOverlayRef.current?.(resolved);
  }, []);

  // Clear any selected overlay (mutually exclusive with node + edge selection).
  const clearOverlaySelection = useCallback(() => {
    if (selectedOverlayRef.current !== null) {
      setSelectedOverlay(null);
      onSelectOverlayRef.current?.(null);
    }
  }, []);

  // Collapse the selection to a single anchor (the single-select path), or clear it (id = null).
  const selectOnly = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedIds(id ? new Set([id]) : new Set());
  }, []);

  // Select a free background shape / container (Tier 4 items 23 + 22): clear the node / edge / overlay
  // channels (mutual exclusion) and set the shape as the active object.
  const selectShape = useCallback(
    (id: string) => {
      setMenu(null);
      setLinkingFrom(null);
      selectOnly(null);
      fireSelect(null);
      clearEdgeSelection();
      clearOverlaySelection();
      setSelectedShapeId(id);
    },
    [selectOnly, fireSelect, clearEdgeSelection, clearOverlaySelection],
  );

  // Mirror React Flow's own selection (marquee drag-select + Shift/Ctrl-click) into our set. Guarded
  // by a set-equality check so the round-trip with the selection-flag effect can't loop: once the
  // flags match the set, RF re-fires this with the same ids and we bail.
  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: { id: string }[] }) => {
      const ids = new Set(selNodes.map((n) => n.id));
      const cur = selectedIdsRef.current;
      if (ids.size === cur.size && [...ids].every((x) => cur.has(x))) return;
      if (ids.size > 0) {
        // node selection is mutually exclusive with edge + overlay + shape
        clearEdgeSelection();
        clearOverlaySelection();
        setSelectedShapeId(null);
      }
      setSelectedIds(ids);
      // Keep the anchor if it's still selected, else adopt the most-recently-selected node.
      const anchor =
        selectedRef.current && ids.has(selectedRef.current)
          ? selectedRef.current
          : (selNodes[selNodes.length - 1]?.id ?? null);
      setSelectedId(anchor);
      fireSelect(anchor);
    },
    [fireSelect, clearEdgeSelection, clearOverlaySelection],
  );

  // Push the current undo/redo depths up so the Row-1 undo/redo buttons can live-enable/disable (#8).
  const reportHistory = useCallback(() => {
    const h = historyRef.current;
    onHistoryRef.current?.(h.past.length > 0, h.future.length > 0);
  }, []);

  // Apply a pure op: persist + re-render; optionally enter edit on the resulting node.
  const apply = useCallback(
    (result: OpResult, edit = false, animate = true, coalesceKey?: string) => {
      if (result.doc !== docRef.current) {
        // Coalesce repeated same-key edits within a short window into one undo step (S4): on a matching
        // key inside COALESCE_MS, skip pushing a snapshot (the pre-spree doc is already on top of `past`).
        const now = Date.now();
        const prevCoalesce = coalesceRef.current;
        const coalesce =
          coalesceKey !== undefined &&
          prevCoalesce?.key === coalesceKey &&
          now - prevCoalesce.at < COALESCE_MS;
        if (!coalesce) {
          // Snapshot the old doc + the anchor selected with it, so undo restores the selection.
          historyRef.current = record(historyRef.current, {
            doc: docRef.current,
            anchor: selectedRef.current,
          });
          reportHistory();
        }
        // Track the key for the next click; a non-keyed apply clears it, breaking the coalesce chain.
        coalesceRef.current = coalesceKey !== undefined ? { key: coalesceKey, at: now } : null;
        sync(result.doc, result.selectId, animate);
        onChangeRef.current?.(result.doc);
      }
      if (result.selectId !== undefined) {
        selectOnly(result.selectId);
        fireSelect(result.selectId);
        if (edit) {
          setEditSeed(null); // a new node seeds with its (empty) topic, not a leftover typed char
          setEditingId(result.selectId);
          justAddedRef.current = result.selectId; // discardable if left empty (Escape / click-away)
        }
      }
    },
    [sync, fireSelect, selectOnly, reportHistory],
  );

  // Enter inline edit for a node; `seed` supplies explicit initial text (for example `/`), or null
  // for a normal edit (seed the existing topic + select all).
  const startEdit = useCallback((id: string, seed: string | null = null) => {
    suppressCommitRef.current = null; // a fresh edit is never a leftover slash-command suppression
    setEditSeed(seed);
    setEditingId(id);
  }, []);

  // Undo/redo restore a snapshot (doc + its selection anchor) without recording it. Passing the anchor
  // as sync's nextSelected re-selects it — and re-fires it to the inspector — so undo restores what was
  // selected, not just the structure (MindManager-style). The anchor may be absent in the restored doc
  // (it's just not highlighted then), so this is safe.
  const restore = useCallback(
    (snap: DocSnapshot) => {
      sync(snap.doc, snap.anchor);
      // selectOnly drives the React selection STATE (not just the imperative ref sync writes) — without
      // it the state→ref mirror (useLatestRef) reverts the anchor on the next render, so the highlight,
      // the StatusBar count, and the next keyboard op would all stay on the pre-undo node.
      selectOnly(snap.anchor);
      fireSelect(snap.anchor);
      onChangeRef.current?.(snap.doc);
    },
    [sync, selectOnly, fireSelect],
  );
  const undoAction = useCallback(() => {
    coalesceRef.current = null; // an undo breaks any open coalesce chain (S4)
    const r = undoHistory(historyRef.current, { doc: docRef.current, anchor: selectedRef.current });
    if (r) {
      historyRef.current = r.history;
      reportHistory();
      restore(r.value);
    }
  }, [restore, reportHistory]);
  const redoAction = useCallback(() => {
    coalesceRef.current = null; // a redo breaks any open coalesce chain (S4)
    const r = redoHistory(historyRef.current, { doc: docRef.current, anchor: selectedRef.current });
    if (r) {
      historyRef.current = r.history;
      reportHistory();
      restore(r.value);
    }
  }, [restore, reportHistory]);

  // Discard a just-created node that was left empty (no text, no children) — e.g. Tab/Enter spawned it
  // and the user pressed Escape or clicked away without typing. Removes ONLY that node from the current
  // doc (so any text committed onto a sibling in the same gesture — e.g. Enter, which commits the prior
  // node then adds this one — is preserved), then pops the add's snapshot so create+discard nets to
  // nothing in undo, and re-selects what was selected before the add — the way MindManager drops an
  // abandoned new topic. Returns false (caller leaves it be) if it isn't empty.
  const discardJustAdded = useCallback(
    (id: string): boolean => {
      coalesceRef.current = null; // popping the add's snapshot must not be coalesced into (S4)
      const node = findAnyNode(docRef.current, id);
      if (!node || node.topic.trim() || node.children.length > 0) return false;
      const r = deleteNode(docRef.current, id);
      if (r.doc === docRef.current) return false; // couldn't remove (shouldn't happen for a non-root)
      const past = historyRef.current.past;
      const anchor = past.length > 0 ? past[past.length - 1].anchor : (r.selectId ?? null);
      if (past.length > 0)
        historyRef.current = { past: past.slice(0, -1), future: historyRef.current.future };
      reportHistory();
      sync(r.doc, anchor);
      selectOnly(anchor);
      fireSelect(anchor);
      onChangeRef.current?.(r.doc);
      return true;
    },
    [sync, selectOnly, fireSelect, reportHistory],
  );

  // Where a dragged topic would land: the node whose box contains the dragged node's centre (excluding
  // the dragged node + its own subtree), plus WHERE within it — the top quarter inserts the dragged
  // node as a sibling *before* the target, the bottom quarter *after* it, the broad middle nests it as
  // a *child* (the same band rule the outline panel uses, via outlineDropWhere). The root has no parent,
  // so before/after collapses to child there. Single source of truth for the live indicator + the drop.
  const findDropTarget = useCallback(
    (dragId: string, dropPos: { x: number; y: number }) =>
      resolveDropTarget(
        getNodes(),
        dragId,
        subtreeIds(findAnyNode(docRef.current, dragId)),
        dropPos,
        docRef.current.root.id,
      ),
    [getNodes],
  );

  // Live drop-target highlight while dragging (skipped in free-canvas mode, where a drag just moves
  // the node). The exact node this resolves is the one handleDragStop will re-parent under.
  // The dragged box + the other nodes' boxes, for free-canvas alignment snapping. Pulled from the live
  // React Flow nodes (measured sizes), excluding the dragged node.
  const snapFor = useCallback(
    (dragId: string, dragPos: { x: number; y: number }) => {
      const nodes = getNodes();
      const dn = nodes.find((n) => n.id === dragId);
      const w = dn?.measured?.width ?? 0;
      const h = dn?.measured?.height ?? 0;
      const others = nodes
        .filter((n) => n.id !== dragId && n.measured?.width && n.measured?.height)
        .map((n) => ({
          x: n.position.x,
          y: n.position.y,
          w: n.measured?.width ?? 0,
          h: n.measured?.height ?? 0,
        }));
      return computeSnap({ x: dragPos.x, y: dragPos.y, w, h }, others);
    },
    [getNodes],
  );

  const handleDrag = useCallback(
    (dragId: string, dragPos: { x: number; y: number }) => {
      if (docRef.current.meta?.freeform) {
        setDropTargetId(null);
        // A group drag moves the whole selection together (React Flow does the visual move); skip the
        // single-node alignment guides — they'd only track the cursor node, not the group.
        const ids = selectedIdsRef.current;
        if (ids.size > 1 && ids.has(dragId)) {
          setGuides([]);
          return;
        }
        // Preview alignment guides while dragging; the node itself snaps into place on release (below).
        setGuides(snapFor(dragId, dragPos).guides);
        return;
      }
      // Tree mode: highlight a child drop-target ring, or show an insertion line for a sibling reorder.
      const t = findDropTarget(dragId, dragPos);
      if (!t) {
        setDropTargetId(null);
        setInsertEdge(null);
      } else if (t.where === "child") {
        setDropTargetId(t.id);
        setInsertEdge(null);
      } else {
        setDropTargetId(null);
        setInsertEdge({ id: t.id, after: t.where === "after" });
      }
    },
    [findDropTarget, snapFor],
  );

  // Drag a node onto another to re-parent it; an invalid/empty drop snaps it back. In free-canvas
  // mode a drag instead persists the node's new (alignment-snapped) position (no re-parenting).
  const handleDragStop = useCallback(
    (
      dragId: string,
      dropPos: { x: number; y: number },
      mods?: { shift?: boolean; ctrl?: boolean },
    ) => {
      setDropTargetId(null);
      setInsertEdge(null);
      if (docRef.current.meta?.freeform) {
        setGuides([]);
        // Group drag: the whole selection moved together, so persist EVERY selected node's new
        // position (read live off the React Flow nodes, which onNodesChange kept in step) in one undo
        // step — otherwise only the cursor node would stick and the rest would snap back to layout.
        const ids = selectedIdsRef.current;
        if (ids.size > 1 && ids.has(dragId)) {
          const live = getNodes();
          const positions = [...ids]
            .map((id) => {
              const n = live.find((m) => m.id === id);
              if (!n || findAnyNode(docRef.current, id)?.locked) return null;
              return { id, x: n.position.x, y: n.position.y };
            })
            .filter((p): p is { id: string; x: number; y: number } => p !== null);
          if (positions.length > 0) apply(setNodePositions(docRef.current, positions));
          return;
        }
        // A locked node is draggable:false so this rarely fires, but guard the write anyway.
        if (findAnyNode(docRef.current, dragId)?.locked) return;
        const snap = snapFor(dragId, dropPos);
        apply(setNodePos(docRef.current, dragId, snap.x, snap.y));
        return;
      }
      // Tree mode: nest as a child (centre) or reorder as a sibling before/after the target (edges).
      const t = findDropTarget(dragId, dropPos);
      if (!t) {
        // Shift+drop on empty canvas DETACHES the branch to a floating topic (MindManager's
        // drag-out-to-detach) instead of snapping back; a plain empty drop still snaps back.
        if (mods?.shift && dragId !== docRef.current.root.id) {
          const d = detachBranch(docRef.current, dragId);
          if (d.doc !== docRef.current) {
            apply(d);
            return;
          }
        }
        sync(docRef.current); // no valid target → snap back to the computed layout
        return;
      }
      // Ctrl/⌘+drop COPIES the branch (fresh ids) as a child of the target instead of moving it —
      // the original stays put (the re-layout after apply snaps it back to its computed position).
      if (mods?.ctrl && dragId !== docRef.current.root.id) {
        const node = findAnyNode(docRef.current, dragId);
        const c = node ? addSubtree(docRef.current, t.id, [node]) : { doc: docRef.current };
        if (c.doc !== docRef.current) apply(c);
        else sync(docRef.current);
        return;
      }
      // Group drag: when the grabbed node is part of a multi-selection, move every selected branch to
      // the target in one undo step (previously only the grabbed node moved — a silent surprise).
      const sel = selectedIdsRef.current;
      const r =
        sel.size > 1 && sel.has(dragId)
          ? moveSelectionInTree(docRef.current, [...sel], dragId, t.id, t.where)
          : moveInTree(docRef.current, dragId, t.id, t.where);
      if (r.doc !== docRef.current) apply(r);
      else sync(docRef.current); // snap back to the computed layout
    },
    [apply, sync, findDropTarget, snapFor, getNodes],
  );

  // Centre + select a node by id (shared by the imperative handle and the in-map jump links).
  const focusNodeById = useCallback(
    (id: string) => {
      const n = getNodes().find((m) => m.id === id);
      if (!n) return;
      selectOnly(id);
      fireSelect(id);
      const w = n.measured?.width ?? 0;
      const h = n.measured?.height ?? 0;
      setCenter(n.position.x + w / 2, n.position.y + h / 2, {
        zoom: 1,
        duration: reducedMotionRef.current ? 0 : motion.dur.fit,
      });
    },
    [getNodes, fireSelect, setCenter, selectOnly],
  );

  // Cinematic framing: animate the camera to fit a node's whole SUBTREE (zoom + pan), the building
  // block of the cinematic guided walk — stepping root→child→leaf progressively zooms in, Prezi-style.
  // Uses React Flow's fitView node filter so the zoom level adapts to the branch's on-screen size.
  const frameBranch = useCallback(
    (id: string, opts?: { duration?: number; padding?: number }) => {
      const node = findAnyNode(docRef.current, id);
      if (!node) return;
      selectOnly(id);
      fireSelect(id);
      const ids = [...subtreeIds(node)].map((nid) => ({ id: nid }));
      fitView({
        nodes: ids,
        duration: reducedMotionRef.current ? 0 : (opts?.duration ?? motion.dur.fit),
        padding: opts?.padding ?? 0.2,
      });
    },
    [fitView, selectOnly, fireSelect],
  );

  // Editing API for the topic nodes. Commits arrive as raw contenteditable HTML; sanitise to a
  // safe inline subset, derive the plain-text fallback, and store both — topicRich is dropped
  // when the text carries no formatting, so plain topics stay tidy.
  const editingApi = useMemo(() => {
    const parse = (html: string) => {
      const clean = sanitizeRich(html);
      const plain = richToPlain(clean);
      return hasFormatting(clean) ? { rich: clean, plain } : parseInlineMarkdown(plain);
    };
    const changed = (n: MapNode | null, rich: string | undefined, plain: string) =>
      !!n && (n.topic !== plain || (n.topicRich ?? undefined) !== rich);
    return {
      editingId,
      seed: editSeed,
      beginEdit: (id: string) => startEdit(id),
      // Escape passes the live editor buffer (`html`) so we can tell a typed-but-uncommitted new topic
      // from an empty one: an existing node just reverts (no commit), a brand-new node keeps what you
      // typed (commit) or — if still empty — is discarded rather than left as a blank box.
      cancelEdit: (html?: string) => {
        const id = editingRef.current;
        setEditingId(null);
        setEditSeed(null);
        // A slash command already handled this node (and its "/query" buffer); don't discard/revert it.
        if (id && suppressCommitRef.current === id) {
          suppressCommitRef.current = null;
          justAddedRef.current = null;
          return;
        }
        const wasJustAdded = !!id && id === justAddedRef.current;
        justAddedRef.current = null;
        if (!id || !wasJustAdded) return; // existing node → plain cancel (its committed text stands)
        const { rich, plain } = parse(html ?? "");
        if (!plain.trim()) {
          discardJustAdded(id);
          return;
        }
        const n = findNode(docRef.current, id);
        if (changed(n, rich, plain)) apply(setTopicRich(docRef.current, id, rich, plain));
      },
      commitEdit: (id: string, html: string, keepSelected = false) => {
        setEditingId(null);
        setEditSeed(null);
        // The editor unmounting after a slash command fires this blur with the stale "/query" buffer —
        // ignore it so the command's effect (and the node's real topic) stands.
        if (suppressCommitRef.current === id) {
          suppressCommitRef.current = null;
          justAddedRef.current = null;
          return;
        }
        const { rich, plain } = parse(html);
        // Enter explicitly accepts an empty topic. Click-away still treats a never-confirmed empty
        // creation as abandoned; Escape retains its existing cancel semantics.
        const wasJustAdded = id === justAddedRef.current;
        justAddedRef.current = null;
        if (wasJustAdded && !keepSelected && !plain.trim() && discardJustAdded(id)) return;
        const n = id ? findNode(docRef.current, id) : null;
        if (changed(n, rich, plain)) {
          const result = setTopicRich(docRef.current, id, rich, plain);
          apply(keepSelected ? { ...result, selectId: id } : result);
        } else if (keepSelected) {
          selectOnly(id);
          fireSelect(id);
        }
      },
      commitAndAdd: (id: string, html: string, what: "sibling" | "child") => {
        let d = docRef.current;
        const n = findNode(d, id);
        const { rich, plain } = parse(html);
        if (changed(n, rich, plain)) d = setTopicRich(d, id, rich, plain).doc;
        apply(what === "child" ? addChild(d, id) : addSibling(d, id), true);
      },
      toggleCollapse: (id: string) => apply(toggleCollapse(docRef.current, id), false, true),
      // On-canvas wrap-width grip (10b Layer 2): merge a maxWidth onto the node's style. Coalesced by
      // node id so an entire drag collapses into ONE undo step (like a slider spree, S4).
      setWrapWidth: (id: string, maxWidth: string) =>
        apply(mergeStyle(docRef.current, id, { maxWidth }), false, false, `wrap:${id}`),
      // Follow a node's hyperlink: jump within the map (#node=), open another map (#map=), or
      // open an external URL in a new tab. Dangerous schemes are refused (the app-wide XSS guard).
      openLink: (url: string) => {
        const link = classifyLink(url);
        if (link.kind === "node") focusNodeById(link.id);
        else if (link.kind === "map") onMapLinkRef.current?.(link.id, link.nodeId);
        else if (!isDangerousUrl(link.url)) window.open(link.url, "_blank", "noopener,noreferrer");
      },
      // Click the on-canvas priority chip to step priority: none → High → Med → Low → none.
      cyclePriority: (id: string) => {
        const n = findNode(docRef.current, id);
        if (n)
          apply(
            setPriority(docRef.current, id, cyclePriority(n.task?.priority)),
            false,
            false,
            `priority:${id}`,
          );
      },
      // Click the node's 📝 indicator → select it and ask the app to open the Notes tab.
      openNote: (id: string) => {
        selectOnly(id);
        fireSelect(id);
        onOpenNoteRef.current?.();
      },
      // Drop a marker dragged from the palette onto a node — toggles it on that topic.
      dropMarker: (id: string, marker: string) => apply(toggleIcon(docRef.current, id, marker)),
      // Slash `/` command menu: the "/query" lives only in the uncommitted editor buffer, so leave edit
      // mode WITHOUT committing (the node keeps its real committed topic — empty for a fresh node) and
      // suppress the unmount blur, then apply the picked command's effect in one undo step. Add-commands
      // re-enter edit on the new node (apply select=true); the rest just stamp the attribute.
      runSlashCommand: (id: string, commandId: string) => {
        const d = docRef.current;
        suppressCommitRef.current = id;
        setEditingId(null);
        setEditSeed(null);
        justAddedRef.current = null;
        switch (commandId) {
          case "child":
            apply(addChild(d, id), true);
            return;
          case "sibling":
            apply(addSibling(d, id), true);
            return;
          case "todo":
            apply(setProgress(d, id, 0));
            return;
          case "done":
            apply(setProgress(d, id, 100));
            return;
          case "due-today":
            apply(setDue(d, id, todayISO()));
            return;
          case "priority-high":
            apply(setPriority(d, id, PRIORITY_LEVELS[0]));
            return;
          case "boundary":
            apply(groupBranch(d, id));
            return;
          case "marker-star":
            apply(toggleIcon(d, id, "⭐"));
            return;
          case "note":
            // No doc mutation — just select the node and open the inspector's Notes tab.
            selectOnly(id);
            fireSelect(id);
            onOpenNoteRef.current?.();
            return;
          default:
            break; // unknown id: nothing to do (the "/query" buffer is discarded on unmount)
        }
      },
      // `[[`/`@` link autocomplete: every named topic in this map (tree + floating), minus the one being
      // edited (no self-link). The picker inserts the label into the text + attaches the link.
      linkCandidates: (excludeId: string) => {
        const out: LinkCandidate[] = [];
        const walk = (n: MapNode) => {
          if (n.id !== excludeId && n.topic.trim())
            out.push({ id: n.id, label: n.topic, link: `#node=${n.id}`, kind: "node" });
          for (const c of n.children) walk(c);
        };
        walk(docRef.current.root);
        for (const f of docRef.current.floatingTopics ?? []) walk(f);
        return out;
      },
      // Attach an autocompleted link: the first link becomes the visible primary hyperlink (canvas 🔗),
      // any further ones its additional hyperlinks. Edit stays open — the user keeps typing the topic.
      addNodeLink: (id: string, link: string) => {
        const n = findNode(docRef.current, id);
        apply(
          n?.hyperlink
            ? addHyperlink(docRef.current, id, link)
            : setHyperlink(docRef.current, id, link),
        );
      },
      // Inline #tag accelerator: every tag used anywhere in the map (deduped), for the suggestion list.
      tagCandidates: () => {
        const seen = new Set<string>();
        const walk = (n: MapNode) => {
          for (const t of n.tags ?? []) seen.add(t);
          for (const c of n.children) walk(c);
        };
        walk(docRef.current.root);
        for (const f of docRef.current.floatingTopics ?? []) walk(f);
        return [...seen];
      },
      // Commit an inline-picked tag: add it to the node's tags (setTags dedupes). Edit stays open.
      addNodeTag: (id: string, tag: string) => {
        const t = tag.trim();
        if (!t) return;
        const n = findAnyNode(docRef.current, id);
        const tags = n?.tags ?? [];
        if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return; // already tagged
        apply(setTags(docRef.current, id, [...tags, t]));
      },
      // Native browser spell-check on the topic editors (view setting; off by default).
      spellcheck,
    };
  }, [
    editingId,
    editSeed,
    startEdit,
    apply,
    focusNodeById,
    selectOnly,
    fireSelect,
    spellcheck,
    discardJustAdded,
  ]);

  // Inline relationship-label editing (double-click a cross-link). Mirrors the topic editing context.
  const linkEditApi = useMemo(
    () => ({
      editingId: editingLinkId,
      commit: (id: string, label: string) => {
        apply(setLinkLabel(docRef.current, id, label.trim()));
        setEditingLinkId(null);
      },
      cancel: () => setEditingLinkId(null),
      // The on-canvas midpoint reshape handle (#1): set this relationship's perpendicular bow.
      setCurve: (id: string, curve: number) => apply(setLinkStyle(docRef.current, id, { curve })),
    }),
    [editingLinkId, apply],
  );

  // Flatten every node's callouts for the overlay, from the live doc (so freshly-added ones show).
  const calloutItems = useMemo<CalloutAnchor[]>(() => {
    const out: CalloutAnchor[] = [];
    const walk = (m: MapNode) => {
      for (const c of m.callouts ?? []) out.push({ nodeId: m.id, callout: c });
      for (const ch of m.children) walk(ch);
    };
    walk(renderDoc.root);
    for (const f of renderDoc.floatingTopics ?? []) walk(f);
    return out;
  }, [renderDoc]);

  // Brace-map fork connectors — only in the brace layout; positions resolve in the overlay.
  const braces = useMemo<BraceGroup[]>(
    () => (direction === "brace" ? computeBraces(renderDoc) : []),
    [direction, renderDoc],
  );

  // Stable array refs for the boundary + summary overlays: the raw `?? []` fallback would mint a new
  // empty array on every render and defeat those components' React.memo. When the doc actually has
  // boundaries/summaries the ref is already stable (same doc → same array), so this only pins the
  // empty-case identity. The overlays are memoised, so a stable ref lets them skip unrelated renders.
  const boundaries = renderDoc.boundaries ?? EMPTY_BOUNDARIES;
  const summaries = renderDoc.summaries ?? EMPTY_SUMMARIES;

  // Empty-state coachmark (#1): when the map is just the bare root (≤1 topic), anchor a one-time
  // hint under it teaching the core add/rename gestures. Hidden once anything is added or edited.
  const showCoach =
    renderDoc.root.children.length === 0 &&
    !(renderDoc.floatingTopics?.length ?? 0) &&
    editingId === null &&
    !coachDismissed;

  // Stable overlay callbacks (deps: the stable `apply`) so the memoised Summaries/Callouts aren't
  // re-rendered by a fresh inline closure every render. Each reads docRef.current for live state.
  // Summary labels edit IN PLACE on the canvas (Summaries owns the input; this just commits) — an
  // empty committed label removes the summary, same semantics as the old prompt.
  const handleCommitSummaryLabel = useCallback(
    (sid: string, next: string) => {
      apply(
        next.trim()
          ? setSummaryLabel(docRef.current, sid, next)
          : deleteSummary(docRef.current, sid),
      );
    },
    [apply],
  );
  const handleCommitCallout = useCallback(
    (nid: string, cid: string, text: string) =>
      apply(setCalloutText(docRef.current, nid, cid, text)),
    [apply],
  );
  const handleDeleteCallout = useCallback(
    (nid: string, cid: string) => apply(deleteCallout(docRef.current, nid, cid)),
    [apply],
  );

  // Keep node selection flags in sync with the selection set (no re-layout). Drives the highlight
  // for app-side selection changes (click, keyboard, focus); React Flow's own marquee/Ctrl-click
  // round-trips through onSelectionChange, which the equality guard there keeps from looping.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.selected === selectedIds.has(n.id) ? n : { ...n, selected: selectedIds.has(n.id) },
      ),
    );
  }, [selectedIds, setNodes]);

  // Mirror the selected relationship into the edges' `selected` flag (drives the halo), the same way
  // the node effect above does — so app-side edge selection + the live RF click stay in lockstep.
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) =>
        e.selected === (e.id === selectedEdgeId) ? e : { ...e, selected: e.id === selectedEdgeId },
      ),
    );
  }, [selectedEdgeId, setEdges]);

  // Prune a dangling edge selection: if the selected link is gone (deleted, or pruned with a node, or
  // an undo/redo restored a doc without it), clear it so the inspector doesn't show a stale edge.
  useEffect(() => {
    if (selectedEdgeId && !(renderDoc.links ?? []).some((l) => l.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
      onSelectEdgeRef.current?.(null);
    }
  }, [renderDoc, selectedEdgeId]);

  // Prune a dangling overlay selection: if the selected boundary/summary/callout is gone (deleted, a
  // node pruned its callout, or undo/redo restored a doc without it), clear it.
  useEffect(() => {
    const sel = selectedOverlay;
    if (!sel) return;
    const gone =
      sel.kind === "boundary"
        ? !(renderDoc.boundaries ?? []).some((b) => b.id === sel.id)
        : sel.kind === "summary"
          ? !(renderDoc.summaries ?? []).some((s) => s.id === sel.id)
          : !findAnyNode(renderDoc, sel.nodeId ?? "")?.callouts?.some((c) => c.id === sel.id);
    if (gone) {
      setSelectedOverlay(null);
      onSelectOverlayRef.current?.(null);
    }
  }, [renderDoc, selectedOverlay]);

  // Dismiss the empty-map coachmark permanently once the user enters edit mode by any path
  // (double-click, F2, slash menu, or creating a branch) — it never nags again this session.
  useEffect(() => {
    if (editingId) setCoachDismissed(true);
  }, [editingId]);

  // Report the selection count up (the inspector switches to bulk mode when >1).
  const onSelectionCountRef = useLatestRef(onSelectionCount);
  useEffect(() => {
    onSelectionCountRef.current?.(selectedIds.size);
  }, [selectedIds]);

  // Report a per-field "mixed" summary of the selection, so the inspector can blank-out + label a
  // task field the selected topics disagree on (instead of showing the anchor's value). Keyed on the
  // live doc too, so a bulk edit re-fires and collapses "Mixed" → the just-applied uniform value.
  const onSelectionFieldsRef = useLatestRef(onSelectionFields);
  useEffect(() => {
    onSelectionFieldsRef.current?.(selectionFields(renderDoc, selectedIds));
  }, [selectedIds, renderDoc]);

  // Markers/tags-on-all-vs-some summary for tri-state bulk chips. Keyed on the live doc too, so a
  // bulk toggle re-fires and a value flips between "all" and "some" as topics gain/lose it.
  const onSelectionMarkerTagsRef = useLatestRef(onSelectionMarkerTags);
  useEffect(() => {
    onSelectionMarkerTagsRef.current?.({
      markers: selectionMarkers(renderDoc, selectedIds),
      tags: selectionTags(renderDoc, selectedIds),
    });
  }, [selectedIds, renderDoc]);

  // Re-layout on a live layout-kind change (initial mount is already laid out).
  const firstRun = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `direction` is the trigger; sync reads directionRef.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    sync(docRef.current);
    const raf = requestAnimationFrame(() =>
      fitView({ duration: reducedMotionRef.current ? 0 : motion.dur.fit }),
    );
    return () => cancelAnimationFrame(raf);
  }, [direction, sync, fitView]);

  // Re-project + re-layout when auto-numbering is toggled (number prefixes change node widths).
  const firstNumberRun = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `numbered` is the trigger; sync reads numberedRef.
  useEffect(() => {
    if (firstNumberRun.current) {
      firstNumberRun.current = false;
      return;
    }
    sync(docRef.current);
  }, [numbered, sync]);

  // Apply the read-only Power Filter by toggling node/edge opacity in place — no re-layout, since
  // dimming doesn't change sizes. Lit = matches + their ancestors (computed in App); null = off.
  // The "hide" mode instead removes non-lit nodes/edges (React Flow `hidden`); that interacts with the
  // brace-map's own hidden ribbons, so it can't be done in place — a full rebuild gets it right. We
  // also rebuild on the frame hide turns OFF (wasHideRef) so stale `hidden` flags clear cleanly.
  const wasHideRef = useRef(false);
  useEffect(() => {
    if (hideUnmatched || wasHideRef.current) {
      wasHideRef.current = hideUnmatched;
      sync(docRef.current);
      return;
    }
    setNodes((ns) =>
      ns.map((n) => {
        const dimmed = litIds ? !litIds.has(n.id) : false;
        const matched = highlightIds ? highlightIds.has(n.id) : false;
        return Boolean(n.data.dimmed) === dimmed && Boolean(n.data.matched) === matched
          ? n
          : { ...n, data: { ...n.data, dimmed, matched } };
      }),
    );
    setEdges((es) =>
      es.map((e) => {
        const dimmed = litIds ? !(litIds.has(e.source) && litIds.has(e.target)) : false;
        return Boolean(e.data?.dimmed) === dimmed
          ? e
          : { ...e, data: { ...(e.data as EdgeData), dimmed } };
      }),
    );
  }, [litIds, highlightIds, hideUnmatched, sync, setNodes, setEdges]);

  // Reflect the live drag-to-reparent target as a node-data flag so TopicNode rings it (#11). Only
  // the target's `data` changes (the equality guard skips the rest); cleared when the drag ends.
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => {
        const isTarget = n.id === dropTargetId;
        return Boolean(n.data.dropTarget) === isTarget
          ? n
          : { ...n, data: { ...n.data, dropTarget: isTarget } };
      }),
    );
  }, [dropTargetId, setNodes]);

  // One-time refine once React Flow has measured the nodes (better sizing than estimates).
  const refined = useRef(false);
  useEffect(() => {
    // A deferred large-map mount starts with zero nodes; do not consume the one refinement pass until
    // the worker's estimated layout has actually landed and React Flow has measured its topics.
    if (!initialized || nodes.length === 0 || refined.current) return;
    refined.current = true;
    sync(docRef.current);
  }, [initialized, nodes.length, sync]);

  // Delete a node and its branch immediately — no blocking "Are you sure?" modal (#9). The delete is
  // a normal undoable edit, and App turns the onDelete report into a "… deleted — Undo" toast wired
  // to undo(), so it's always reversible. Shared by the keyboard Delete, the context menu, and the
  // on-node popover. A no-op (deleting the root / a missing node) reports nothing.
  const deleteNodeWithUndo = useCallback(
    (id: string) => {
      const node = findAnyNode(docRef.current, id);
      const r = deleteNode(docRef.current, id);
      if (r.doc === docRef.current) {
        // No-op: the central topic can't be deleted. Tell the user why nothing happened (a missing
        // node — already gone — is silent; only the root case reaches here with a live node).
        if (node && id === docRef.current.root.id)
          onHintRef.current?.(t("canvas.hint.rootUndeletable"));
        return;
      }
      apply(r);
      onDeleteRef.current?.(node?.topic?.trim() || "topic", node ? countDescendants(node) : 0);
    },
    [apply],
  );

  // Delete the WHOLE selection (every selected node's branch) as one undoable edit — the Delete key
  // and the inspector's Delete both route here. A single selection keeps the original per-topic
  // "… deleted — Undo" wording; a multi-select reports "N topics". Returns false if nothing's selected.
  const deleteSelectionWithUndo = useCallback((): boolean => {
    const ids = [...selectedIdsRef.current];
    const list = ids.length > 0 ? ids : selectedRef.current ? [selectedRef.current] : [];
    if (list.length === 0) return false;
    if (list.length === 1) {
      deleteNodeWithUndo(list[0]);
      return true;
    }
    const r = deleteNodes(docRef.current, list);
    if (r.doc === docRef.current) {
      // Every selected id was the root / already gone (e.g. only the central topic was selected).
      if (list.includes(docRef.current.root.id))
        onHintRef.current?.(t("canvas.hint.rootUndeletable"));
      return true;
    }
    apply(r);
    onDeleteRef.current?.(`${r.removed} topic${r.removed === 1 ? "" : "s"}`, 0);
    return true;
  }, [apply, deleteNodeWithUndo]);

  // Keyboard tree-building (when a node is selected and we're not inline-editing or in a field). The
  // pure key→intent mapping lives in flow/keyIntent.ts; here we only wire the listener + dispatch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Fit-to-view shortcuts: Shift+1 = fit all, Shift+2 = fit the current selection. Keyed on e.code
      // (Digit1/Digit2) so they're keyboard-layout robust — e.key would be "!"/"@" with Shift held.
      // Skipped while inline-editing or focused in a field.
      if (e.shiftKey && (e.code === "Digit1" || e.code === "Digit2") && !editingRef.current) {
        const tgt = e.target as HTMLElement | null;
        const inField =
          !!tgt?.isContentEditable ||
          (tgt?.tagName ? /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName) : false);
        if (!inField) {
          e.preventDefault();
          if (e.code === "Digit1")
            fitView({ duration: reducedMotionRef.current ? 0 : motion.dur.fit });
          else {
            const ids = [...selectedIdsRef.current];
            fitView({
              duration: reducedMotionRef.current ? 0 : motion.dur.fit,
              maxZoom: 1.5,
              nodes: ids.length ? ids.map((id) => ({ id })) : undefined,
            });
          }
          return;
        }
      }
      const intent = keyIntent(
        {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          target: e.target as HTMLElement | null,
        },
        {
          editing: !!editingRef.current,
          // First-run: on an empty map (bare root, nothing selected) fall back to the root, so the
          // coachmark's advertised Tab / Enter keys act on it instead of no-op'ing on
          // a null selection. Doesn't touch the mount render (the fresh-map Map panel is unchanged).
          selectedId:
            selectedRef.current ??
            (docRef.current.root.children.length === 0 &&
            !(docRef.current.floatingTopics?.length ?? 0)
              ? docRef.current.root.id
              : null),
          linking: !!linkingFromRef.current,
          freeform: !!docRef.current.meta?.freeform,
          pwa: isStandalonePwa(),
        },
      );
      if (!intent) return;
      // Every intent but the two clears consumes the key.
      if (intent.kind !== "clearLinking" && intent.kind !== "clearDropTarget") e.preventDefault();
      switch (intent.kind) {
        case "clearLinking":
          setLinkingFrom(null);
          break;
        case "startLinking":
          setLinkingFrom(intent.id);
          onHintRef.current?.(t("canvas.hint.linkingKeyboard"));
          break;
        case "completeLink": {
          const from = linkingFromRef.current;
          if (from && from !== intent.id) {
            // Same silent-create + inline-label flow as the mouse paths: draw the relationship,
            // then open its label editor on the line (type to label, Escape keeps it unlabelled).
            const r = addLink(docRef.current, from, intent.id);
            if (r.doc !== docRef.current) {
              apply(r);
              const created = (r.doc.links ?? []).find(
                (l) => l.from === from && l.to === intent.id,
              );
              if (created) setEditingLinkId(created.id);
            }
          }
          setLinkingFrom(null);
          break;
        }
        case "nudge": {
          // Keyboard reposition in freeform (WCAG 2.5.7). Base off the node's stored pos, or its live
          // on-screen position if it's never been dragged; locked nodes don't move.
          const n = findAnyNode(docRef.current, intent.id);
          if (n && !n.locked) {
            const live = getNodes().find((m) => m.id === intent.id);
            const base =
              n.pos ?? (live ? { x: live.position.x, y: live.position.y } : { x: 0, y: 0 });
            const STEP = 10;
            const dx = intent.dir === "left" ? -STEP : intent.dir === "right" ? STEP : 0;
            const dy = intent.dir === "up" ? -STEP : intent.dir === "down" ? STEP : 0;
            apply(setNodePos(docRef.current, intent.id, base.x + dx, base.y + dy));
          }
          break;
        }
        case "setPriority":
          apply(setPriority(docRef.current, intent.id, intent.level));
          break;
        case "zoomIn":
          void zoomIn({ duration: reducedMotionRef.current ? 0 : motion.dur.viewport });
          break;
        case "zoomOut":
          void zoomOut({ duration: reducedMotionRef.current ? 0 : motion.dur.viewport });
          break;
        case "zoomReset":
          void zoomTo(1, { duration: reducedMotionRef.current ? 0 : motion.dur.viewport });
          break;
        case "clearDropTarget":
          setDropTargetId(null); // clear a stray drag-reparent indicator
          break;
        case "undo":
          undoAction();
          break;
        case "redo":
          redoAction();
          break;
        case "addChild":
          apply(addChild(docRef.current, intent.id), true);
          break;
        case "addSibling":
          apply(addSibling(docRef.current, intent.id), true);
          break;
        case "addSiblingBefore":
          apply(addSiblingBefore(docRef.current, intent.id), true);
          break;
        // Indent / outdent apply to the WHOLE selection (one undo step) when several are selected —
        // not just the anchor — so multi-select restructuring matches multi-select Delete.
        case "outdent": {
          const ids = selectedIdsRef.current;
          if (ids.size > 1) apply(applyAcrossIds(docRef.current, ids, outdent));
          else apply(outdent(docRef.current, intent.id));
          break;
        }
        case "indent": {
          const ids = selectedIdsRef.current;
          if (ids.size > 1) apply(applyAcrossIds(docRef.current, ids, indent));
          else apply(indent(docRef.current, intent.id));
          break;
        }
        case "moveUp":
          apply(moveSibling(docRef.current, intent.id, "up"));
          break;
        case "moveDown":
          apply(moveSibling(docRef.current, intent.id, "down"));
          break;
        case "toggleCollapse":
          apply(toggleCollapse(docRef.current, intent.id), false, true);
          break;
        case "setExpandedLevel":
          apply(setBranchExpandedToLevel(docRef.current, intent.id, intent.level), false, true);
          break;
        case "delete":
          deleteSelectionWithUndo();
          break;
        case "openNote":
          editingApi.openNote(intent.id);
          break;
        case "rename":
          startEdit(intent.id);
          break;
        case "openSlashMenu":
          startEdit(intent.id, "/");
          break;
        case "stepProgress": {
          const n = findNode(docRef.current, intent.id);
          if (n)
            apply(
              setProgress(
                docRef.current,
                intent.id,
                stepTaskProgress(n.task?.progress, intent.direction),
              ),
              false,
              false,
              `progress:${intent.id}`,
            );
          break;
        }
        case "selectDir": {
          const next = nextSelectionId(docRef.current, intent.id, intent.dir);
          if (next) focusNodeById(next);
          break;
        }
        case "copyBranch": {
          // Multi-select copies every selected branch (minus any nested inside another); a single
          // selection copies just the anchor. Both land in the cross-map clipboard for paste.
          const sel = selectedIdsRef.current;
          const ids = sel.size > 1 ? maximalBranchIds(docRef.current, [...sel]) : [intent.id];
          const nodes = ids
            .map((id) => findAnyNode(docRef.current, id))
            .filter((n): n is MapNode => Boolean(n))
            .map((n) => structuredClone(n));
          if (nodes.length === 0) break;
          setBranches(nodes);
          // One plural message, not a hand-written `=== 1` ternary: English needs two forms here but
          // Slavic languages need four, and `Intl.PluralRules` picks the arm from `n`.
          onHintRef.current?.(t("canvas.hint.branchCopied", { n: nodes.length }));
          break;
        }
        case "duplicateBranch": {
          const n = findAnyNode(docRef.current, intent.id);
          if (!n || intent.id === docRef.current.root.id) {
            onHintRef.current?.(t("canvas.hint.selectToDuplicate"));
            break;
          }
          // Paste a clone under the same parent → a sibling (or floating if the node has no parent).
          const parent = findParent(docRef.current, intent.id);
          apply(pasteBranch(docRef.current, parent?.id ?? null, structuredClone(n)));
          onHintRef.current?.(t("canvas.hint.branchDuplicated"));
          break;
        }
        case "pasteBranch": {
          const clips = getBranches();
          if (clips.length === 0) {
            onHintRef.current?.(t("canvas.hint.nothingToPaste"));
            break;
          }
          // Graft all copied branches under the selection in one undo step (addSubtree re-ids them).
          apply(addSubtree(docRef.current, intent.id, clips));
          onHintRef.current?.(t("canvas.hint.branchPasted", { n: clips.length }));
          break;
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    apply,
    undoAction,
    redoAction,
    deleteSelectionWithUndo,
    startEdit,
    focusNodeById,
    editingApi,
    fitView,
    getNodes,
    zoomIn,
    zoomOut,
    zoomTo,
  ]);

  // (The context menu's own outside-pointerdown + Escape close lives in the ContextMenu primitive.)

  const withSelected = useCallback((fn: (id: string) => void): boolean => {
    const id = selectedRef.current;
    if (!id) return false;
    fn(id);
    return true;
  }, []);

  // Fold a pure op over every selected node and commit the result as ONE undo step. Used by the
  // value-setting bulk edits (style / progress / dates / priority) — for a single selection this is
  // identical to the old single-node path (the set is {anchor}). Per-item edits (note / image /
  // hyperlink / attachments / tags / markers) stay on `withSelected` (the anchor only).
  const withSelectedAll = useCallback(
    (op: (doc: MindMapDoc, id: string) => OpResult): boolean => {
      const ids = [...selectedIdsRef.current];
      if (ids.length === 0) return false;
      let doc = docRef.current;
      for (const id of ids) doc = op(doc, id).doc;
      if (doc !== docRef.current) apply({ doc });
      return true;
    },
    [apply],
  );

  // Measured on-canvas node sizes (id → w/h), for align/distribute (centre + right/bottom need widths).
  const measuredSizes = useCallback((): NodeSizes => {
    const out: NodeSizes = {};
    for (const n of getNodes())
      out[n.id] = { w: n.measured?.width ?? 0, h: n.measured?.height ?? 0 };
    return out;
  }, [getNodes]);

  // Apply a pure cross-link op to the selected relationship edge (the edge-inspector path); false if
  // no edge is selected. Mirrors withSelected for nodes.
  const withSelectedLink = useCallback(
    (op: (doc: MindMapDoc, id: string) => OpResult): boolean => {
      const id = selectedEdgeIdRef.current;
      if (!id) return false;
      apply(op(docRef.current, id));
      // Re-resolve the selected edge from the UPDATED doc so the inspector's controls (direction /
      // width / dash / curve highlights) reflect the edit live — the SelectedEdge handed to the app
      // is otherwise captured at selection time and would show stale state after a preset / control.
      // For deleteLink the id no longer resolves → null, which simply clears the inspector.
      fireSelectEdge(id);
      return true;
    },
    [apply, fireSelectEdge],
  );

  // Apply a pure op to the selected overlay (the op picks the right transform by kind); false if none.
  const withSelectedOverlay = useCallback(
    (op: (sel: SelectedOverlay) => OpResult): boolean => {
      const sel = selectedOverlayRef.current;
      if (!sel) return false;
      apply(op(sel));
      return true;
    },
    [apply],
  );

  // Delete the selected overlay (boundary / summary / callout). Shared by the imperative handle and the
  // keyboard listener below — pressing Delete with an overlay selected used to be a silent no-op.
  const deleteSelectedOverlay = useCallback((): boolean => {
    const ok = withSelectedOverlay((sel) => OVERLAY_OPS[sel.kind].del(docRef.current, sel));
    if (ok) clearOverlaySelection();
    return ok;
  }, [withSelectedOverlay, clearOverlaySelection]);

  // Keyboard delete for overlays. keyIntent only fires for node selections (and node selection is
  // cleared while an overlay is selected), so a boundary/summary/callout needs its own Delete listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedOverlayRef.current || editingRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      deleteSelectedOverlay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteSelectedOverlay]);

  // Select an overlay (clears node + edge first — mutually exclusive), then resolve + fire.
  const selectOverlay = useCallback(
    (sel: { kind: SelectedOverlay["kind"]; id: string; nodeId?: string }) => {
      setMenu(null);
      setLinkingFrom(null);
      selectOnly(null);
      fireSelect(null);
      clearEdgeSelection();
      fireSelectOverlay(sel);
    },
    [selectOnly, fireSelect, clearEdgeSelection, fireSelectOverlay],
  );
  // Right-click an overlay → select it (so the mutators target it) + open its context menu.
  const openOverlayMenu = useCallback(
    (
      e: React.MouseEvent,
      overlay: { kind: SelectedOverlay["kind"]; id: string; nodeId?: string },
    ) => {
      e.preventDefault();
      selectOverlay(overlay);
      setOverlayMenu({ x: e.clientX, y: e.clientY, overlay });
    },
    [selectOverlay],
  );
  // Open the full node right-click menu at a node by id — the popover's "More…" opener (C6). The node's
  // on-screen rect comes from the DOM (useReactFlow() here doesn't expose flowToScreenPosition); the
  // ContextMenu primitive clamps to the viewport, so a node near an edge still opens on-screen.
  const openNodeMenuAt = useCallback(
    (id: string) => {
      clearEdgeSelection();
      clearOverlaySelection();
      selectOnly(id);
      fireSelect(id);
      const rect = document
        .querySelector(`.react-flow__node[data-id="${id}"]`)
        ?.getBoundingClientRect();
      if (!rect) return;
      setMenu({ x: rect.left + rect.width / 2, y: rect.top, id });
    },
    [clearEdgeSelection, clearOverlaySelection, selectOnly, fireSelect],
  );
  const handleSelectBoundary = useCallback(
    (id: string) => selectOverlay({ kind: "boundary", id }),
    [selectOverlay],
  );
  const handleSelectSummaryOverlay = useCallback(
    (id: string) => selectOverlay({ kind: "summary", id }),
    [selectOverlay],
  );
  const handleSelectCallout = useCallback(
    (nodeId: string, calloutId: string) =>
      selectOverlay({ kind: "callout", id: calloutId, nodeId }),
    [selectOverlay],
  );

  useImperativeHandle(
    ref,
    (): MindMapHandle => ({
      replaceDocument: (next) => apply({ doc: next }),
      // Author a clean native-text SVG straight from the model + the live node rects
      // (position + measured size). Flows through useMapExports.cleanSvg() to drive
      // png/svg/html/pdf — and, unlike the old export, carries arrow + boundary labels.
      exportSvg: (rootId?: string) => {
        // Scoped ("Export this branch", B4): render a subtree doc rooted at `rootId`, keeping the live
        // node positions (subtreeExportDoc preserves ids) filtered to that subtree so the branch renders
        // exactly as on canvas, framed to its own bounds. No rootId → the whole map (unchanged).
        const exportDoc = rootId
          ? (subtreeExportDoc(docRef.current, rootId) ?? docRef.current)
          : docRef.current;
        const keep = rootId ? new Set(subtreeIds(exportDoc.root)) : null;
        const rects = new Map<string, NodeRect>();
        for (const n of getNodes()) {
          if (keep && !keep.has(n.id)) continue;
          rects.set(n.id, {
            x: n.position.x,
            y: n.position.y,
            w: n.measured?.width ?? 0,
            h: n.measured?.height ?? 0,
          });
        }
        const cssVar = (themeRef.current ?? mindManagerTheme).cssVar;
        const svg = buildFlowSvg(
          exportDoc,
          rects,
          paletteRef.current,
          cssVar,
          numberedRef.current,
          todayISO(),
          directionRef.current === "brace" ? computeBraces(exportDoc) : undefined,
          exportDoc.meta?.freeform ? "freeform" : directionRef.current,
        );
        return new Blob([svg], { type: "image/svg+xml" });
      },
      fit: () => fitView({ duration: reducedMotionRef.current ? 0 : motion.dur.fit }),
      // Snapshot viewport + undo/redo stacks so the tab switcher can restore them on a remount.
      getSession: (): CanvasSession => ({ viewport: getViewport(), history: historyRef.current }),
      getViewport: () => getViewport(),
      setViewport: (vp) =>
        setViewport(vp, { duration: reducedMotionRef.current ? 0 : motion.dur.viewport }),
      focusNode: focusNodeById,
      frameBranch,
      setSelectedImage: (image) => withSelected((id) => apply(setImage(docRef.current, id, image))),
      // Id-based variants for the drag-a-file-onto-a-topic path (the target is the dropped-on node,
      // not necessarily the selected one). Return false if the node no longer exists.
      setNodeImage: (id, image) => {
        if (!findNode(docRef.current, id)) return false;
        apply(setImage(docRef.current, id, image));
        return true;
      },
      addNodeAttachment: (id, attachment) => {
        if (!findNode(docRef.current, id)) return false;
        apply(addAttachment(docRef.current, id, attachment));
        return true;
      },
      setSelectedNote: (note) => withSelected((id) => apply(setNote(docRef.current, id, note))),
      toggleSelectedIcon: (icon) =>
        withSelected((id) => apply(toggleIcon(docRef.current, id, icon))),
      bulkToggleSelectedIcon: (icon) => {
        const ids = [...selectedIdsRef.current];
        if (ids.length === 0) return false;
        apply(bulkToggleIcon(docRef.current, ids, icon));
        return true;
      },
      bulkToggleSelectedTag: (tag) => {
        const ids = [...selectedIdsRef.current];
        if (ids.length === 0) return false;
        apply(bulkToggleTag(docRef.current, ids, tag));
        return true;
      },
      replaceTopics: (query, replacement, scope) => {
        const res = replaceTopics(docRef.current, query, replacement, scope);
        if (res.count > 0) apply({ doc: res.doc });
        return res.count;
      },
      setAllExpanded: (expanded) => apply(setAllExpanded(docRef.current, expanded), false, true),
      setExpandedToLevel: (level) => apply(setExpandedToLevel(docRef.current, level)),
      setNodeSide: (id, side) => apply(setNodeSide(docRef.current, id, side)),
      balanceMap: () => apply(balanceMap(docRef.current)),
      setFreeform: (on) => {
        if (on) {
          // Seed each node's pos from where it currently sits, so the switch is seamless.
          const positions = new Map<string, { x: number; y: number }>();
          for (const n of getNodes()) positions.set(n.id, { x: n.position.x, y: n.position.y });
          apply(setFreeform(docRef.current, true, positions));
        } else {
          apply(setFreeform(docRef.current, false));
        }
      },
      setBackdrop: (kind) => {
        // Add the frame and switch to free-canvas mode so topics drag into its regions (one undo).
        const positions = new Map<string, { x: number; y: number }>();
        for (const n of getNodes()) positions.set(n.id, { x: n.position.x, y: n.position.y });
        const withBackdrop = setBackdrop(docRef.current, kind).doc;
        apply({ doc: setFreeform(withBackdrop, true, positions).doc });
      },
      setBackdropRings: (delta) => apply(setBackdropRings(docRef.current, delta)),
      clearBackdrop: () => apply(clearBackdrop(docRef.current)),
      addShape: (kind) => {
        // Drop the shape at the viewport centre + switch to free-canvas mode (preserving node
        // positions), in one undo step, then select it so its inline toolbar shows.
        const pane = document.querySelector(".react-flow__pane");
        const rect = pane?.getBoundingClientRect();
        const centre = rect
          ? screenToFlowPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
          : { x: 0, y: 0 };
        const positions = new Map<string, { x: number; y: number }>();
        for (const n of getNodes()) positions.set(n.id, { x: n.position.x, y: n.position.y });
        const res = addShape(docRef.current, kind, centre);
        apply({ doc: setFreeform(res.doc, true, positions).doc });
        if (res.selectId) selectShape(res.selectId);
      },
      setSelectedStyle: (patch) => withSelectedAll((doc, id) => mergeStyle(doc, id, patch)),
      setSelectedBranchColor: (color) =>
        withSelectedAll((doc, id) => setBranchColor(doc, id, color)),
      copySelectedStyle: () => {
        const id = selectedRef.current;
        return id ? (findAnyNode(docRef.current, id)?.style ?? {}) : null;
      },
      shuffleBranchColors: () => apply(assignBranchColors(docRef.current, paletteRef.current)),
      alignSelection: (mode) =>
        apply(alignNodes(docRef.current, selectedIdsRef.current, mode, measuredSizes())),
      distributeSelection: (axis) =>
        apply(distributeNodes(docRef.current, selectedIdsRef.current, axis, measuredSizes())),
      toggleLocked: (id) => apply(toggleLocked(docRef.current, id)),
      setSelectedHyperlink: (url) =>
        withSelected((id) => apply(setHyperlink(docRef.current, id, url))),
      addSelectedHyperlink: (url) =>
        withSelected((id) => apply(addHyperlink(docRef.current, id, url))),
      removeSelectedHyperlink: (index) =>
        withSelected((id) => apply(removeHyperlink(docRef.current, id, index))),
      groupBranch: (id) => {
        apply(groupBranch(docRef.current, id));
        return Boolean(findAnyNode(docRef.current, id));
      },
      sortChildren: (id, by) => {
        const node = findAnyNode(docRef.current, id);
        if (!node) return false;
        apply(sortChildren(docRef.current, id, by));
        return true;
      },
      groupSelection: () => {
        const ids = [...selectedIdsRef.current];
        if (ids.length < 2) return false;
        apply(groupNodes(docRef.current, ids));
        return true;
      },
      groupSummary: (id) => {
        apply(groupSummary(docRef.current, id));
        return Boolean(findAnyNode(docRef.current, id));
      },
      isolateBranch: (id) => {
        const before = docRef.current;
        apply(isolateBranch(docRef.current, id));
        return docRef.current !== before;
      },
      detachBranch: (id) => {
        const before = docRef.current;
        apply(detachBranch(docRef.current, id));
        return docRef.current !== before;
      },
      renameMap: (title) => apply(setTopic(docRef.current, docRef.current.root.id, title)),
      renameNode: (id, topic) => apply(setTopic(docRef.current, id, topic)),
      indentNode: (id, dir) =>
        apply(dir === "in" ? indent(docRef.current, id) : outdent(docRef.current, id)),
      moveOutlineNode: (dragId, targetId, where) =>
        apply(moveInTree(docRef.current, dragId, targetId, where)),
      addOutlineChild: (id) => {
        const res = addChild(docRef.current, id);
        if (res.selectId) apply(res);
        return res.selectId ?? null;
      },
      addOutlineSibling: (id) => {
        const res = addSibling(docRef.current, id);
        if (res.selectId) apply(res);
        return res.selectId ?? null;
      },
      setBackground: (color) => apply(setBackground(docRef.current, color)),
      setAccentColor: (color) => apply(setAccentColor(docRef.current, color)),
      setBackgroundImage: (url) => apply(setBackgroundImage(docRef.current, url)),
      setLineJumps: (on) => apply(setLineJumps(docRef.current, on)),
      setSavedViews: (views) => apply({ doc: setSavedViews(docRef.current, views) }),
      setConnectorStyle: (style) => apply(setConnectorStyle(docRef.current, style)),
      setBranchGrowth: (growth) => apply(setBranchGrowth(docRef.current, growth)),
      setNumberStyle: (style) => apply(setNumberStyle(docRef.current, style)),
      setFontFamily: (family) => apply(setFontFamily(docRef.current, family)),
      setFontScale: (scale) => apply(setFontScale(docRef.current, scale)),
      setLegend: (on) => apply(setLegend(docRef.current, on)),
      setShowLinkTypes: (on) => {
        apply(setShowLinkTypes(docRef.current, on));
        // Re-resolve the selected edge so the EdgeInspector's "Show type labels" checkbox reflects the
        // new map-wide state live (edge.showTypes is captured at selection time otherwise).
        if (selectedEdgeIdRef.current) fireSelectEdge(selectedEdgeIdRef.current);
      },
      setRules: (rules) => apply(setRules(docRef.current, rules)),
      setSlides: (slides) => apply(setSlides(docRef.current, slides)),
      setSelectedTags: (tags) => withSelected((id) => apply(setTags(docRef.current, id, tags))),
      setNodeTags: (id, tags) => {
        if (!findAnyNode(docRef.current, id)) return false;
        apply(setTags(docRef.current, id, tags));
        return true;
      },
      setNodeMarkers: (id, icons) => {
        if (!findAnyNode(docRef.current, id)) return false;
        apply(setIcons(docRef.current, id, icons));
        return true;
      },
      setNodeDue: (id, due) => {
        if (!findAnyNode(docRef.current, id)) return false;
        apply(setDue(docRef.current, id, due));
        return true;
      },
      renameTag: (from, to) => apply(renameTag(docRef.current, from, to)),
      deleteTag: (tag) => apply(deleteTag(docRef.current, tag)),
      setSelectedProgress: (progress) =>
        withSelectedAll((doc, id) => setProgress(doc, id, progress)),
      setSelectedDue: (due) => withSelectedAll((doc, id) => setDue(doc, id, due)),
      setSelectedStart: (start) => withSelectedAll((doc, id) => setStart(doc, id, start)),
      setSelectedPriority: (priority) =>
        withSelectedAll((doc, id) => setPriority(doc, id, priority)),
      shiftDates: (days, scope) => {
        // "map" → whole map (root scope); "branch" → the selected node's subtree (needs a selection).
        const scopeId =
          scope === "map" ? docRef.current.root.id : (selectedRef.current ?? undefined);
        if (scope === "branch" && !scopeId) return false;
        const r = shiftDates(docRef.current, days, scopeId);
        if (r.doc === docRef.current) return false; // nothing dated in scope → no-op, report false
        apply(r);
        return true;
      },
      addSelectedAttachment: (attachment) =>
        withSelected((id) => apply(addAttachment(docRef.current, id, attachment))),
      removeSelectedAttachment: (index) =>
        withSelected((id) => apply(removeAttachment(docRef.current, id, index))),
      addSubtreeToSelected: (nodes) =>
        withSelected((id) => apply(addSubtree(docRef.current, id, nodes))),
      addStickyNote: (color) => apply(addStickyNote(docRef.current, undefined, color)),
      addFloatingTopic: (text) => {
        const t = text.trim();
        if (!t) return;
        apply(addFloatingTopic(docRef.current, t), true);
      },
      setSelectedRollup: (mapId) =>
        withSelected((id) => apply(setRollup(docRef.current, id, mapId || undefined))),
      quickAdd: (text) => {
        const t = text.trim();
        if (!t) return;
        const parentId = selectedRef.current ?? docRef.current.root.id;
        // Burst capture: a pasted MULTI-line outline becomes a whole subtree (indentation/headings →
        // nesting) in one undo step. A single line is captured verbatim — parseOutline would strip a
        // leading bullet/number/heading from a lone topic (e.g. "1. Intro" → "Intro"). addSubtree re-ids.
        const parsed = t.includes("\n") ? parseOutline(t) : [];
        const nodes = parsed.length ? parsed : [{ id: "q", topic: t, children: [] }];
        // Apply without a selectId so the parent stays selected — rapid entry adds siblings.
        const res = addSubtree(docRef.current, parentId, nodes);
        apply({ doc: res.doc });
      },
      addChildToSelected: () => withSelected((id) => apply(addChild(docRef.current, id), true)),
      // Start drawing a relationship FROM the selected topic (the ⌘K / command path for the keyboard
      // Ctrl/⌘+Shift+L gesture): arm linking mode, then the next click on another topic completes it
      // (with the label prompt). False if nothing is selected.
      startLinkFromSelected: () => withSelected((id) => setLinkingFrom(id)),
      deleteSelected: () => deleteSelectionWithUndo(),
      undo: undoAction,
      redo: redoAction,
      // Relationship (cross-link) edits — applied to the selected edge (false if none selected).
      setLinkLabel: (label) => withSelectedLink((doc, id) => setLinkLabel(doc, id, label)),
      setLinkArrow: (arrow) => withSelectedLink((doc, id) => setLinkArrow(doc, id, arrow)),
      setLinkStyle: (patch) => withSelectedLink((doc, id) => setLinkStyle(doc, id, patch)),
      deleteLink: () => {
        const ok = withSelectedLink((doc, id) => deleteLink(doc, id));
        if (ok) {
          setSelectedEdgeId(null);
          onSelectEdgeRef.current?.(null);
        }
        return ok;
      },
      // Overlay (boundary / summary / callout) edits — applied to the selected overlay by kind.
      setOverlayLabel: (label) =>
        withSelectedOverlay((sel) => OVERLAY_OPS[sel.kind].label(docRef.current, sel, label)),
      setOverlayColor: (color) => {
        const sel = selectedOverlayRef.current;
        const ok = withSelectedOverlay((s) => OVERLAY_OPS[s.kind].color(docRef.current, s, color));
        // Re-emit the (unchanged) selection so the inspector's swatch reflects the new colour.
        if (ok && sel) fireSelectOverlay({ kind: sel.kind, id: sel.id, nodeId: sel.nodeId });
        return ok;
      },
      setOverlayShape: (shape) => {
        const sel = selectedOverlayRef.current;
        if (sel?.kind !== "boundary") return false;
        const ok = withSelectedOverlay((s) => setBoundaryShape(docRef.current, s.id, shape));
        if (ok) fireSelectOverlay({ kind: sel.kind, id: sel.id, nodeId: sel.nodeId });
        return ok;
      },
      setOverlayDash: (dash) => {
        const sel = selectedOverlayRef.current;
        if (sel?.kind !== "boundary") return false;
        const ok = withSelectedOverlay((s) => setBoundaryDash(docRef.current, s.id, dash));
        if (ok) fireSelectOverlay({ kind: sel.kind, id: sel.id, nodeId: sel.nodeId });
        return ok;
      },
      deleteOverlay: () => deleteSelectedOverlay(),
      setBackdropColor: (color) => apply(setBackdropColor(docRef.current, color)),
    }),
    [
      fitView,
      getNodes,
      getViewport,
      setViewport,
      screenToFlowPosition,
      apply,
      withSelected,
      withSelectedAll,
      withSelectedLink,
      withSelectedOverlay,
      measuredSizes,
      deleteSelectedOverlay,
      fireSelectEdge,
      fireSelectOverlay,
      focusNodeById,
      frameBranch,
      selectShape,
      deleteSelectionWithUndo,
      undoAction,
      redoAction,
    ],
  );

  // Terse selection narration for the canvas live region (the SVG graph is otherwise silent to AT).
  // Kept short so a marquee drag doesn't produce a chatty stream of announcements.
  const selectionAnnounce =
    selectedIds.size === 0
      ? ""
      : selectedIds.size === 1
        ? `Selected: ${findAnyNode(renderDoc, [...selectedIds][0])?.topic?.trim() || "topic"}`
        : `${selectedIds.size} topics selected`;

  // Memoised so the read-only SR overview only re-renders when the doc changes (not on every
  // selection/hover), keeping its O(nodes) list off the hot path.
  const relationshipsSr = useMemo(
    () => (
      <>
        <CanvasRelationshipsSR doc={renderDoc} />
        <CanvasOverlaysSR doc={renderDoc} />
      </>
    ),
    [renderDoc],
  );

  return (
    <EditingContext.Provider value={editingApi}>
      <LinkEditContext.Provider value={linkEditApi}>
        <section
          // Name the principal region so assistive tech can identify the canvas (otherwise the
          // ReactFlow SVG graph is an anonymous box) and the skip-link has a target (#mm-canvas).
          // A <section> with an accessible name is a navigable landmark — better than role on a div.
          id="mm-canvas"
          tabIndex={-1}
          aria-roledescription="mind map canvas"
          aria-label={t("canvas.region.label", {
            title: renderDoc.title?.trim() || t("canvas.region.untitledMap"),
          })}
          {...paneLongPress}
          style={{
            height: "100%",
            width: "100%",
            ...themeVars(theme),
            // Per-map background overrides the theme's canvas colour (reads the live mirror).
            ...(renderDoc.meta?.background ? { background: renderDoc.meta.background } : {}),
          }}
          // Drop a link (or text) from the browser onto the canvas → a new floating topic.
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes("Files") ||
              e.dataTransfer.types.includes("text/uri-list") ||
              e.dataTransfer.types.includes("text/plain")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            // Desktop files dropped onto a topic → attach to that topic (image = its picture, anything
            // else = an attachment). Resolve the drop target by hit-testing the flow-space point against
            // the live node boxes; ignore file drops that miss every node.
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length > 0) {
              e.preventDefault();
              const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
              const id = nodeAtPoint(getNodes(), p.x, p.y);
              if (id) onDropFilesOnNodeRef.current?.(id, files);
              return;
            }
            const raw = (
              e.dataTransfer.getData("text/uri-list") ||
              e.dataTransfer.getData("text/plain") ||
              ""
            ).trim();
            const first = raw.split(/\r?\n/).find((l) => l && !l.startsWith("#")) ?? "";
            if (!first) return;
            e.preventDefault();
            let topic = first;
            let link: string | undefined;
            if (/^https?:\/\//i.test(first) && !isDangerousUrl(first)) {
              link = first;
              try {
                topic = new URL(first).hostname.replace(/^www\./, "") || first;
              } catch {
                topic = first;
              }
            }
            apply(addFloatingTopic(docRef.current, topic, link));
          }}
          // Double-click the empty canvas to drop a new floating topic and edit it straight away (#6).
          // Node double-clicks stopPropagation (→ inline edit), so only bare-pane double-clicks reach
          // here; the target guard keeps clicks on the controls / minimap from creating stray topics.
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement)?.classList?.contains("react-flow__pane")) {
              apply(addFloatingTopic(docRef.current, ""), true);
            }
          }}
          // Right-click the bare pane → a canvas menu (add topic / paste branch / fit / reset zoom). The
          // pane-target guard means a right-click on a node still gets the node menu (onNodeContextMenu)
          // and never a stray pane menu.
          onContextMenu={(e) => {
            if ((e.target as HTMLElement)?.classList?.contains("react-flow__pane")) {
              e.preventDefault();
              setMenu(null);
              setPaneMenu({ x: e.clientX, y: e.clientY });
            }
          }}
        >
          {/* Polite live region narrating selection changes — gives screen-reader users a sense of
              "you are here" on a canvas that's otherwise an opaque SVG graph. */}
          <div className="mm-sr-only" aria-live="polite">
            {selectionAnnounce}
          </div>
          {/* Always-present, read-only SR list of the map's relationships (cross-links) — otherwise
              non-focusable SVG edges, invisible to assistive tech, listed nowhere else. (UI-5 a11y tail.) */}
          {relationshipsSr}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            // Drag-to-relate: pulling from a topic's hover handle onto another topic draws a cross-link
            // (loose mode lets the drag end anywhere on the target node, not just its anchor handle).
            nodesConnectable
            connectionMode={ConnectionMode.Loose}
            onConnect={(c) => {
              // Drag-to-relate drops onto a target node: draw the relationship immediately (no modal)
              // and open its label for INLINE editing on the line — type to label it, Escape/click-away
              // keeps it unlabelled. MindManager's frictionless-linking behaviour.
              if (c.source && c.target && c.source !== c.target) {
                const r = addLink(docRef.current, c.source, c.target, "");
                if (r.doc !== docRef.current) {
                  apply(r);
                  const created = (r.doc.links ?? []).find(
                    (l) => l.from === c.source && l.to === c.target,
                  );
                  if (created) setEditingLinkId(created.id);
                }
              }
            }}
            deleteKeyCode={null}
            // Keyboard is owned end-to-end by the app's custom keymap (keyIntent.ts on a document
            // listener): Tab=add-child, Enter=add-sibling, arrows=move selection, F2=rename, Delete,
            // reorder, undo/redo. React Flow's built-in node-keyboard a11y (Tab-to-node + arrow-move)
            // would otherwise fire alongside it and double-handle those keys — so disable RF's model
            // outright and make our keymap the single source of truth. The accessible tree lives in the
            // Outline panel (role="tree"); canvas nodes carry names/roles but aren't RF tab stops. (UI-5)
            disableKeyboardA11y
            nodesFocusable={false}
            edgesFocusable={false}
            zoomOnDoubleClick={false}
            colorMode={(theme ?? mindManagerTheme).type}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={3}
            // Big-map virtualisation: above a node-count threshold, let React Flow cull off-screen
            // nodes/edges from the DOM so pan/zoom/edit stays fluid (nodes carry measured sizes, which
            // RF needs to compute visibility). Off on smaller maps to avoid pop-in + per-frame overhead.
            onlyRenderVisibleElements={shouldVirtualize(nodes.length)}
            // Restore a saved viewport (lossless tab switch) when present; else fit to view on mount.
            // Read from the mount-captured session so a later re-render (after App clears the one-shot
            // cache) can't flip fitView back on and re-fit away the restored viewport.
            fitView={!mountSession.current?.viewport}
            defaultViewport={mountSession.current?.viewport}
            // Plain left-drag on empty canvas draws a marquee; middle/right drag pans.
            panOnDrag={[1, 2]}
            // Trackpad/touch navigation follows the iPad model: two-finger/wheel pans the map,
            // Ctrl/⌘ + wheel (and pinch) zooms around the pointer instead of jumping the camera.
            panOnScroll
            panOnScrollSpeed={0.85}
            zoomOnScroll
            zoomOnPinch
            autoPanSpeed={22}
            selectionOnDrag
            selectionKeyCode={null}
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            onSelectionChange={onSelectionChange}
            onNodeClick={(ev, node) => {
              // In "Link to…" mode, the next click on a *different* node completes the relationship —
              // silently (no modal), then opens the new line's label for inline editing.
              if (linkingFrom && node.id !== linkingFrom) {
                const from = linkingFrom;
                setLinkingFrom(null);
                const r = addLink(docRef.current, from, node.id, "");
                if (r.doc !== docRef.current) {
                  apply(r);
                  const created = (r.doc.links ?? []).find(
                    (l) => l.from === from && l.to === node.id,
                  );
                  if (created) setEditingLinkId(created.id);
                }
                return;
              }
              setLinkingFrom(null);
              setMenu(null);
              clearEdgeSelection();
              clearOverlaySelection();
              // A modified click extends the selection — React Flow toggles it and we mirror the
              // result via onSelectionChange; a plain click is a single (anchor) select.
              if (ev.shiftKey || ev.metaKey || ev.ctrlKey) return;
              selectOnly(node.id);
              fireSelect(node.id);
            }}
            onEdgeClick={(_, edge) => {
              // Selecting a relationship opens the EdgeInspector; clear node + overlay (mutually
              // exclusive), and the menu / link-draw gesture.
              if (edge.type !== "crosslink") return;
              setMenu(null);
              setLinkingFrom(null);
              selectOnly(null);
              fireSelect(null);
              clearOverlaySelection();
              setSelectedShapeId(null);
              setSelectedEdgeId(edge.id);
              fireSelectEdge(edge.id);
            }}
            onEdgeDoubleClick={(_, edge) => {
              // Inline-edit a relationship's label right on the canvas (double-click the line).
              if (edge.type === "crosslink") setEditingLinkId(edge.id);
            }}
            onPaneClick={() => {
              setLinkingFrom(null);
              selectOnly(null);
              fireSelect(null);
              clearEdgeSelection();
              clearOverlaySelection();
              setSelectedShapeId(null);
              setMenu(null);
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              clearEdgeSelection();
              clearOverlaySelection();
              setSelectedShapeId(null);
              // Keep an existing multi-selection when right-clicking one of its members — so the menu
              // can offer bulk actions instead of collapsing to a single node (the natural mouse path
              // for batch work). Otherwise select just this node.
              const sel = selectedIdsRef.current;
              if (!(sel.size > 1 && sel.has(node.id))) {
                selectOnly(node.id);
                fireSelect(node.id);
              }
              setMenu({ x: e.clientX, y: e.clientY, id: node.id });
            }}
            onNodeDrag={(_, node) => handleDrag(node.id, node.position)}
            onNodeDragStop={(e, node) =>
              handleDragStop(node.id, node.position, {
                shift: e.shiftKey,
                ctrl: e.ctrlKey || e.metaKey,
              })
            }
            onEdgeContextMenu={(e, edge) => {
              e.preventDefault();
              if (edge.type !== "crosslink") return;
              // Select the edge (so the EdgeInspector reflects it, mirroring onEdgeClick) and open
              // the relationship context menu — no more jump-straight-to-delete confirm.
              setMenu(null);
              setLinkingFrom(null);
              selectOnly(null);
              fireSelect(null);
              clearOverlaySelection();
              setSelectedShapeId(null);
              setSelectedEdgeId(edge.id);
              fireSelectEdge(edge.id);
              setEdgeMenu({ x: e.clientX, y: e.clientY, id: edge.id });
            }}
          >
            <BackgroundImage url={renderDoc.meta?.backgroundImage} />
            <DiagramBackdrop backdrop={renderDoc.backdrop} />
            <ShapeLayer
              shapes={renderDoc.shapes ?? EMPTY_SHAPES}
              selectedId={selectedShapeId}
              onSelect={selectShape}
              onMove={(id, x, y) => {
                // A container carries the topics inside it; a plain shape just moves. One undo step.
                const rects = getNodes().map((n) => ({
                  id: n.id,
                  x: n.position.x,
                  y: n.position.y,
                  w: n.measured?.width ?? 0,
                  h: n.measured?.height ?? 0,
                }));
                apply(moveShapeAndCapture(docRef.current, id, x, y, rects));
              }}
              onResize={(id, x, y, w, h) => apply(setShapeRect(docRef.current, id, x, y, w, h))}
              onColor={(id, c) => apply(setShapeColor(docRef.current, id, c))}
              onKind={(id, k) => apply(setShapeKind(docRef.current, id, k))}
              onDelete={(id) => {
                apply(deleteShape(docRef.current, id));
                setSelectedShapeId(null);
              }}
            />
            <BraceConnectors braces={braces} />
            <Boundaries
              boundaries={boundaries}
              selectedId={selectedOverlay?.kind === "boundary" ? selectedOverlay.id : null}
              onSelect={handleSelectBoundary}
              onContextMenu={(e, id) => openOverlayMenu(e, { kind: "boundary", id })}
              accent={renderDoc.meta?.accentColor}
            />
            <Summaries
              summaries={summaries}
              onCommitLabel={handleCommitSummaryLabel}
              selectedId={selectedOverlay?.kind === "summary" ? selectedOverlay.id : null}
              onSelect={handleSelectSummaryOverlay}
              onContextMenu={(e, id) => openOverlayMenu(e, { kind: "summary", id })}
            />
            <Callouts
              items={calloutItems}
              onCommit={handleCommitCallout}
              onDelete={handleDeleteCallout}
              selectedId={selectedOverlay?.kind === "callout" ? selectedOverlay.id : null}
              onSelect={handleSelectCallout}
              onContextMenu={(e, nodeId, calloutId) =>
                openOverlayMenu(e, { kind: "callout", id: calloutId, nodeId })
              }
            />
            <NodePopover
              selectedId={selectedId}
              editingId={editingId}
              doc={renderDoc}
              onToggleCollapse={(id) => apply(toggleCollapse(docRef.current, id))}
              onOpenNote={editingApi.openNote}
              onCyclePriority={editingApi.cyclePriority}
              onStartLink={(id) => {
                setLinkingFrom(id);
                onHintRef.current?.(t("canvas.hint.linkingPointer"));
              }}
              onMore={openNodeMenuAt}
            />
            <CoachMark show={showCoach} rootId={renderDoc.root.id} touch={isMobile} />
            <DropLabel dropTargetId={dropTargetId} doc={renderDoc} />
            {/* Sibling-reorder insertion line (#8): a bar at the target node's top/bottom edge. */}
            {insertEdge
              ? (() => {
                  const n = nodes.find((m) => m.id === insertEdge.id);
                  if (!n) return null;
                  const w = n.measured?.width ?? 0;
                  const h = n.measured?.height ?? 0;
                  const y = insertEdge.after ? n.position.y + h : n.position.y;
                  return (
                    <ViewportPortal>
                      <div
                        style={{
                          position: "absolute",
                          left: n.position.x - 4,
                          top: y - 1.5,
                          width: w + 8,
                          height: 3,
                          background: "#1b8a5e",
                          borderRadius: 2,
                          boxShadow: "0 0 0 1px rgba(255,255,255,0.7)",
                          pointerEvents: "none",
                          zIndex: 5,
                        }}
                      />
                    </ViewportPortal>
                  );
                })()
              : null}
            {renderDoc.meta?.legend ? <LegendPanel doc={renderDoc} /> : null}
            {guides.length > 0 ? (
              <ViewportPortal>
                {guides.map((g, i) => (
                  <div
                    key={`${g.axis}:${g.pos}:${i}`}
                    style={{
                      position: "absolute",
                      background: "#f5a623",
                      pointerEvents: "none",
                      ...(g.axis === "x"
                        ? { left: g.pos, top: g.start, width: 1, height: g.end - g.start }
                        : { left: g.start, top: g.pos, height: 1, width: g.end - g.start }),
                    }}
                  />
                ))}
              </ViewportPortal>
            ) : null}
            <Controls showInteractive={false} />
            <StatusBar
              topics={nodes.length}
              selected={selectedIds.size}
              activeView={activeView}
              onSetView={onSetView}
              onResetZoom={() =>
                zoomTo(1, { duration: reducedMotionRef.current ? 0 : motion.dur.viewport })
              }
              onFitSelection={() => {
                const ids = [...selectedIds];
                if (ids.length)
                  fitView({
                    nodes: ids.map((id) => ({ id })),
                    duration: reducedMotionRef.current ? 0 : motion.dur.fit,
                  });
              }}
            />
            <MinimapPanel open={minimapOpen} onToggle={toggleMinimap} />
          </ReactFlow>
          {edgeMenu ? (
            <ContextMenu
              x={edgeMenu.x}
              y={edgeMenu.y}
              onClose={() => setEdgeMenu(null)}
              menuAriaLabel={t("canvas.menu.relationshipActions")}
              sheet={isMobile}
            >
              {(() => {
                const id = edgeMenu.id;
                const link = (docRef.current.links ?? []).find((l) => l.id === id);
                const patch = (p: Parameters<typeof setLinkStyle>[2]) =>
                  apply(setLinkStyle(docRef.current, id, p));
                return (
                  <>
                    <MenuItem
                      label={t("canvas.link.editLabel")}
                      onSelect={() => {
                        setEditingLinkId(id);
                        setEdgeMenu(null);
                      }}
                    />
                    <MenuSeparator />
                    <MenuLabel>{t("canvas.link.arrowheads")}</MenuLabel>
                    <div className="mm-menu-row">
                      {(
                        [
                          ["to", "→"],
                          ["from", "←"],
                          ["both", "↔"],
                          ["none", "—"],
                        ] as const
                      ).map(([arrow, glyph]) => (
                        <button
                          key={arrow}
                          type="button"
                          className="mm-menu-chip"
                          aria-label={t("canvas.arrowheadsNamed", { arrow })}
                          aria-pressed={(link?.arrow ?? "to") === arrow}
                          data-on={(link?.arrow ?? "to") === arrow || undefined}
                          onClick={() => patch({ arrow })}
                        >
                          {glyph}
                        </button>
                      ))}
                    </div>
                    <MenuLabel>{t("canvas.link.line")}</MenuLabel>
                    <div className="mm-menu-row">
                      {(["dashed", "solid", "dotted"] as const).map((dash) => (
                        <button
                          key={dash}
                          type="button"
                          className="mm-menu-chip"
                          aria-label={t("canvas.link.lineStyle", { style: dash })}
                          aria-pressed={(link?.dash ?? "dashed") === dash}
                          data-on={(link?.dash ?? "dashed") === dash || undefined}
                          onClick={() => patch({ dash })}
                        >
                          {dash}
                        </button>
                      ))}
                    </div>
                    <MenuLabel>{t("panel.type")}</MenuLabel>
                    <div className="mm-menu-row">
                      {(["relates-to", "depends-on", "causes", "supports", "blocks"] as const).map(
                        // `kind`, not `t` — the loop variable shadowed the translation function, which
                        // is why the aria-label below stayed hardcoded through the first canvas pass.
                        (kind) => (
                          <button
                            key={kind}
                            type="button"
                            className="mm-menu-chip"
                            aria-label={t("canvas.link.typeNamed", { type: kind })}
                            aria-pressed={(link?.type ?? "relates-to") === kind}
                            data-on={(link?.type ?? "relates-to") === kind || undefined}
                            onClick={() => patch({ type: kind })}
                          >
                            {kind}
                          </button>
                        ),
                      )}
                    </div>
                    <MenuSeparator />
                    <MenuItem
                      label={t("panel.deleteRelationship")}
                      danger
                      onSelect={() => {
                        apply(deleteLink(docRef.current, id));
                        setEdgeMenu(null);
                      }}
                    />
                  </>
                );
              })()}
            </ContextMenu>
          ) : null}
          {menu ? (
            <ContextMenu
              x={menu.x}
              y={menu.y}
              onClose={() => setMenu(null)}
              menuAriaLabel={t("canvas.menu.topicActions")}
              sheet={isMobile}
            >
              {(() => {
                const id = menu.id;
                // Bulk menu: when the right-clicked node is part of a multi-selection, operate on the
                // whole set (the natural mouse path for batch work — was previously impossible because
                // right-click collapsed the selection). Reuses the existing bulk ops.
                const selSet = selectedIdsRef.current;
                if (selSet.size > 1 && selSet.has(id)) {
                  return (
                    <BulkNodeMenu
                      ids={[...selSet]}
                      getDoc={() => docRef.current}
                      apply={apply}
                      onDelete={() => deleteSelectionWithUndo()}
                    />
                  );
                }
                const items: TopicMenuItem[] = [
                  {
                    id: "add-child",
                    label: t("canvas.menu.addChild"),
                    shortcut: "Tab",
                    run: () => apply(addChild(docRef.current, id), true),
                  },
                  {
                    id: "add-sibling",
                    label: t("canvas.menu.addSibling"),
                    shortcut: "Enter",
                    run: () => apply(addSibling(docRef.current, id), true),
                  },
                  {
                    id: "rename",
                    label: t("common.rename"),
                    shortcut: "F2",
                    run: () => startEdit(id),
                  },
                  {
                    id: "add-note",
                    label: t("canvas.menu.addNote"),
                    run: () => {
                      selectOnly(id);
                      fireSelect(id);
                      onOpenNoteRef.current?.();
                    },
                  },
                  {
                    id: "link",
                    label: t("canvas.menu.linkTo"),
                    shortcut: "Ctrl/⌘+Shift+L",
                    run: () => setLinkingFrom(id),
                  },
                  {
                    id: "callout",
                    label: t("canvas.menu.addCallout"),
                    run: () => apply(addCallout(docRef.current, id)),
                  },
                  {
                    id: "boundary",
                    label: t("canvas.menu.groupInBoundary"),
                    run: () => apply(groupBranch(docRef.current, id)),
                  },
                  {
                    id: "summary",
                    label: t("canvas.menu.summarizeBranch"),
                    run: () => apply(groupSummary(docRef.current, id)),
                  },
                  {
                    id: "copy",
                    label: t("canvas.menu.copyBranch"),
                    shortcut: "Ctrl/⌘+C",
                    run: () => {
                      const n = findAnyNode(docRef.current, id);
                      if (n) setBranches([structuredClone(n)]);
                    },
                  },
                ];
                // Export this branch (B4): scoped export of the subtree, only for a non-leaf node
                // (a lone topic has nothing to scope — the whole-map export already covers it).
                if ((findAnyNode(docRef.current, id)?.children.length ?? 0) > 0)
                  items.push({
                    id: "export",
                    label: t("canvas.menu.exportBranch"),
                    run: () => onExportBranchRef.current?.(id),
                  });
                // Cross-map paste: show only when the branch clipboard has something (it persists in
                // localStorage, so branches copied in another map show up here too).
                const clips = getBranches();
                if (clips.length)
                  items.push({
                    id: "paste",
                    label: t("canvas.menu.pasteBranches", { n: clips.length }),
                    shortcut: "Ctrl/⌘+Shift+V",
                    run: () => apply(addSubtree(docRef.current, id, clips)),
                  });
                items.push({
                  id: "collapse",
                  label: t("canvas.menu.collapseExpand"),
                  run: () => apply(toggleCollapse(docRef.current, id)),
                });
                items.push({
                  id: "lock",
                  label: findAnyNode(docRef.current, id)?.locked
                    ? t("canvas.menu.unlockPosition")
                    : t("canvas.menu.lockPosition"),
                  run: () => apply(toggleLocked(docRef.current, id)),
                });
                // Detach a central-tree branch out to a floating topic; re-attach a floating one to
                // the centre. (Either way you can also just drag it.)
                const isFloatingTop = (docRef.current.floatingTopics ?? []).some(
                  (f) => f.id === id,
                );
                if (isFloatingTop)
                  items.push({
                    id: "reattach",
                    label: t("canvas.menu.reattach"),
                    run: () => apply(reparent(docRef.current, id, docRef.current.root.id)),
                  });
                else if (id !== docRef.current.root.id)
                  items.push({
                    id: "detach",
                    label: t("canvas.menu.detach"),
                    run: () => apply(detachBranch(docRef.current, id)),
                  });
                items.push({
                  id: "delete",
                  label: t("common.delete"),
                  shortcut: "Del",
                  run: () => deleteNodeWithUndo(id),
                  danger: true,
                });
                // Live marker/priority state so the quick-setters reflect the node (and toggle off).
                const node = findAnyNode(docRef.current, id);
                const activeMarkers = node?.icons ?? [];
                const curPriority = node?.task?.priority;
                return (
                  <>
                    {items.map((item) => (
                      <MenuItem
                        key={item.id}
                        label={item.label}
                        danger={item.danger}
                        shortcut={item.shortcut}
                        onSelect={item.run}
                      />
                    ))}
                    <MenuSeparator />
                    {/* Inline marker quick-setter (the "Set marker" submenu): toggle several without
                      closing, mirroring the inspector's MarkerBar but reachable in one right-click. */}
                    <MenuLabel>{t("common.markers")}</MenuLabel>
                    <div className="mm-menu-row">
                      {MARKER_PALETTE.map((m) => {
                        const on = activeMarkers.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            className="mm-menu-chip"
                            aria-pressed={on}
                            aria-label={
                              on
                                ? t("canvas.removeMarkerNamed", { marker: m })
                                : t("canvas.addMarkerNamed", { marker: m })
                            }
                            data-on={on || undefined}
                            onClick={() => apply(toggleIcon(docRef.current, id, m))}
                          >
                            {markerImage(m) ? (
                              <img src={markerImage(m) as string} alt={m} width={16} height={16} />
                            ) : (
                              m
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Inline priority quick-setter (the "Set priority" submenu). */}
                    <MenuLabel>{t("common.priority")}</MenuLabel>
                    <div className="mm-menu-row">
                      {PRIORITY_LEVELS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="mm-menu-chip"
                          aria-pressed={curPriority === p}
                          data-on={curPriority === p || undefined}
                          onClick={() =>
                            apply(
                              setPriority(docRef.current, id, curPriority === p ? undefined : p),
                            )
                          }
                        >
                          {priorityLabel(p)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="mm-menu-chip"
                        aria-pressed={!curPriority}
                        data-on={!curPriority || undefined}
                        onClick={() => apply(setPriority(docRef.current, id, undefined))}
                      >
                        {t("common.none")}
                      </button>
                    </div>
                    {/* "Move project" (item 14): shift every task date in THIS branch by a preset,
                        preserving relative offsets. Shown only when the branch actually has dated
                        tasks. The shiftDates op is a no-op when nothing's dated, so this stays honest. */}
                    {(() => {
                      let hasDated = false;
                      const scope = findAnyNode(docRef.current, id);
                      if (scope)
                        walkNodeTree(scope, (n) => {
                          if (n.task?.start || n.task?.due) hasDated = true;
                        });
                      if (!hasDated) return null;
                      return (
                        <>
                          <MenuLabel>{t("canvas.menu.shiftDates")}</MenuLabel>
                          <div className="mm-menu-row">
                            {(
                              [
                                [t("canvas.menu.shiftMinus1w"), -7],
                                [t("canvas.menu.shiftMinus1d"), -1],
                                [t("canvas.menu.shift1d"), 1],
                                [t("canvas.menu.shift1w"), 7],
                                [t("canvas.menu.shift1mo"), 30],
                              ] as const
                            ).map(([label, days]) => (
                              <button
                                key={label}
                                type="button"
                                className="mm-menu-chip"
                                aria-label={t("canvas.menu.shiftDatesBy", { n: days })}
                                onClick={() => apply(shiftDates(docRef.current, days, id))}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                    <MenuSeparator />
                    <label
                      className="mm-menu-label"
                      style={{ display: "block", textTransform: "none", letterSpacing: 0 }}
                    >
                      {t("canvas.menu.branchLayout")}
                      <select
                        className="mm-select"
                        defaultValue={findNode(docRef.current, menu.id)?.layout ?? ""}
                        onChange={(e) => {
                          apply(
                            setNodeLayout(docRef.current, menu.id, e.target.value || undefined),
                          );
                          setMenu(null);
                        }}
                        style={{ width: "100%", marginTop: 4 }}
                      >
                        <option value="">{t("canvas.branchLayout.default")}</option>
                        <option value="org-down">{t("toolbar.orgChart")}</option>
                        <option value="org-up">{t("toolbar.orgChart2")}</option>
                        <option value="right">{t("cmd.layout.right")}</option>
                        <option value="left">{t("cmd.layout.left")}</option>
                        <option value="radial">{t("canvas.branchLayout.radial")}</option>
                        <option value="timeline">{t("cmd.layout.timeline")}</option>
                        <option value="fishbone">{t("cmd.layout.fishbone")}</option>
                        <option value="grid">{t("common.grid")}</option>
                        <option value="brace">{t("canvas.branchLayout.brace")}</option>
                      </select>
                    </label>
                    {/* Map side — pin a main branch to a half of the two-sided map (else auto-balance).
                      Only meaningful for a root child in the "side" layout. */}
                    {direction === "side" &&
                    !renderDoc.meta?.freeform &&
                    renderDoc.root.children.some((c) => c.id === menu.id) ? (
                      <label
                        className="mm-menu-label"
                        style={{ display: "block", textTransform: "none", letterSpacing: 0 }}
                      >
                        {t("canvas.menu.mapSide")}
                        <select
                          className="mm-select"
                          defaultValue={findNode(docRef.current, menu.id)?.side ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            apply(
                              setNodeSide(
                                docRef.current,
                                menu.id,
                                v === "left" || v === "right" ? v : undefined,
                              ),
                            );
                            setMenu(null);
                          }}
                          style={{ width: "100%", marginTop: 4 }}
                        >
                          <option value="">{t("canvas.branchSide.auto")}</option>
                          <option value="left">{t("canvas.branchSide.left")}</option>
                          <option value="right">{t("canvas.branchSide.right")}</option>
                        </select>
                      </label>
                    ) : null}
                    <MenuLabel>{t("common.branchColour")}</MenuLabel>
                    <div className="mm-menu-row">
                      {["#c2701a", "#3f6fb0", "#1b8a5e", "#b23b6a", "#8a6d2f", "#6a5acd"].map(
                        (c) => {
                          const on = findNode(docRef.current, id)?.branchColor === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              className="mm-menu-chip"
                              aria-label={t("canvas.menu.branchColourNamed", { colour: c })}
                              aria-pressed={on}
                              data-on={on || undefined}
                              onClick={() => apply(setBranchColor(docRef.current, id, on ? "" : c))}
                              style={{ background: c, width: 18, height: 18, padding: 0 }}
                            />
                          );
                        },
                      )}
                      <button
                        type="button"
                        className="mm-menu-chip"
                        onClick={() => apply(setBranchColor(docRef.current, id, ""))}
                      >
                        {t("panel.default")}
                      </button>
                    </div>
                    <MenuLabel>{t("canvas.menu.branchLine")}</MenuLabel>
                    <div className="mm-menu-row">
                      {(["solid", "dashed", "dotted"] as const).map((d) => {
                        const on = (findNode(docRef.current, id)?.lineDash ?? "solid") === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            className="mm-menu-chip"
                            aria-pressed={on}
                            data-on={on || undefined}
                            onClick={() => apply(setLineDash(docRef.current, id, d))}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    {/* Roll-up (mirror another map) — bind this topic to a source map so its children
                        mirror that map; shown only when the library has other maps (I11). */}
                    {libraryMaps.length > 0 ? (
                      <>
                        <MenuLabel>{t("toolbar.rollUpMirrorAnotherMap")}</MenuLabel>
                        <div style={{ padding: "2px 6px" }}>
                          <select
                            className="mm-select"
                            style={{ width: "100%" }}
                            value={findNode(docRef.current, id)?.rollup ?? ""}
                            onChange={(e) => {
                              apply(setRollup(docRef.current, id, e.target.value || undefined));
                              setMenu(null);
                            }}
                            aria-label={t("toolbar.bindRollUpSource")}
                          >
                            {findNode(docRef.current, id)?.rollup ? (
                              <option value="">{t("toolbar.unbind")}</option>
                            ) : (
                              <option value="">{t("toolbar.bindSourceMap")}</option>
                            )}
                            {libraryMaps
                              .filter((mm) => mm.id !== docRef.current.id)
                              .map((mm) => (
                                <option key={mm.id} value={mm.id}>
                                  {mm.title || t("common.untitled")}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    ) : null}
                  </>
                );
              })()}
            </ContextMenu>
          ) : null}
          {/* Empty-pane right-click menu — the one canvas surface that did nothing on right-click. */}
          {paneMenu ? (
            <ContextMenu
              x={paneMenu.x}
              y={paneMenu.y}
              onClose={() => setPaneMenu(null)}
              menuAriaLabel={t("canvas.menu.canvasActions")}
              sheet={isMobile}
            >
              <MenuItem
                label={t("canvas.pane.addTopic")}
                onSelect={() => apply(addFloatingTopic(docRef.current, ""), true)}
              />
              {getBranches().length ? (
                <MenuItem
                  label={t("canvas.menu.pasteBranches", { n: getBranches().length })}
                  onSelect={() => {
                    const clips = getBranches();
                    if (clips.length === 0) return;
                    // Drop each copied branch in as a floating topic, folded into one undo step.
                    let doc = docRef.current;
                    for (const c of clips) doc = pasteBranch(doc, null, c).doc;
                    apply({ doc });
                  }}
                />
              ) : null}
              <MenuSeparator />
              <MenuItem
                label={t("canvas.pane.fitToView")}
                onSelect={() =>
                  fitView({ duration: reducedMotionRef.current ? 0 : motion.dur.fit })
                }
              />
              <MenuItem
                label={t("canvas.pane.resetZoom")}
                onSelect={() =>
                  zoomTo(1, { duration: reducedMotionRef.current ? 0 : motion.dur.viewport })
                }
              />
            </ContextMenu>
          ) : null}
          {/* Right-click menu for a boundary / summary / callout overlay (recolour · shape · delete).
              The overlay was selected on open, so the selection-based ops target it. */}
          {overlayMenu ? (
            <ContextMenu
              x={overlayMenu.x}
              y={overlayMenu.y}
              onClose={() => setOverlayMenu(null)}
              menuAriaLabel={t("canvas.menu.overlayActions")}
              sheet={isMobile}
            >
              {(() => {
                const ov = overlayMenu.overlay;
                const recolour = (c: string) => {
                  withSelectedOverlay((s) => OVERLAY_OPS[s.kind].color(docRef.current, s, c));
                  fireSelectOverlay(ov);
                  setOverlayMenu(null);
                };
                const SHAPES = [
                  ["roundRect", "Rounded"],
                  ["rect", "Square"],
                  ["ellipse", "Ellipse"],
                  ["cloud", "Cloud"],
                  ["polygon", "Polygon"],
                ] as const;
                return (
                  <>
                    <MenuLabel>{t("canvas.shape.recolour")}</MenuLabel>
                    <div className="mm-menu-row">
                      {colors.strokeSwatches.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="mm-menu-chip"
                          aria-label={t("common.colourNamed", { colour: c })}
                          style={{ background: c }}
                          onClick={() => recolour(c)}
                        />
                      ))}
                      <button type="button" className="mm-menu-chip" onClick={() => recolour("")}>
                        {t("panel.default")}
                      </button>
                    </div>
                    {ov.kind === "boundary" ? (
                      <>
                        <MenuLabel>{t("panel.shape")}</MenuLabel>
                        <div className="mm-menu-row">
                          {SHAPES.map(([sh, lbl]) => (
                            <button
                              key={sh}
                              type="button"
                              className="mm-menu-chip"
                              onClick={() => {
                                withSelectedOverlay((s) =>
                                  setBoundaryShape(docRef.current, s.id, sh),
                                );
                                fireSelectOverlay(ov);
                                setOverlayMenu(null);
                              }}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                        <MenuLabel>{t("panel.outline")}</MenuLabel>
                        <div className="mm-menu-row">
                          {(["solid", "dashed", "dotted"] as const).map((d) => (
                            <button
                              key={d}
                              type="button"
                              className="mm-menu-chip"
                              onClick={() => {
                                withSelectedOverlay((s) =>
                                  setBoundaryDash(docRef.current, s.id, d),
                                );
                                fireSelectOverlay(ov);
                                setOverlayMenu(null);
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <MenuSeparator />
                    <MenuItem
                      label={t("common.delete")}
                      danger
                      onSelect={() => {
                        deleteSelectedOverlay();
                        setOverlayMenu(null);
                      }}
                    />
                  </>
                );
              })()}
            </ContextMenu>
          ) : null}
          {linkingFrom ? (
            <div
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                padding: "5px 12px",
                background: `var(--mm-root-bg, ${colors.menu.linkBg})`,
                color: `var(--mm-root-color, ${colors.menu.linkColor})`,
                borderRadius: 8,
                font: "13px system-ui, sans-serif",
                boxShadow: "0 2px 10px #0004",
                pointerEvents: "none",
              }}
            >
              {t("canvas.hint.clickTargetToLink")}
            </div>
          ) : null}
        </section>
      </LinkEditContext.Provider>
    </EditingContext.Provider>
  );
}

export function FlowMindMap(props: MindMapProps) {
  return (
    <ReactFlowProvider>
      <FlowInner key={props.doc.id} {...props} />
    </ReactFlowProvider>
  );
}
