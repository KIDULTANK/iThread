import { type Catalogue, registerMessages } from "../../i18n/registry";

// English messages for the CANVAS — the topic node, its affordances and the on-canvas menus.
//
// These live here rather than in `i18n/core.ts` on purpose. The canvas is a ~100 kB LAZY chunk
// (`FlowMindMap`), so its strings belong in that chunk: putting them in the eager core catalogue would
// move them onto the initial-load path, which `scripts/size-budget.mjs` caps. Registration happens on
// import, so the messages arrive exactly when the canvas does.
//
// Imports `registerMessages` from `../../i18n/registry`, NOT from the `../../i18n` barrel — the barrel
// pulls in the eager core catalogue, which would defeat the whole arrangement. There's a test that
// asserts these strings are absent from the entry chunk.

export const CANVAS_EN = {
  "canvas.bulk.selectedCount": { one: "{n} topic selected", other: "{n} topics selected" },
  "canvas.shapeTitle": "{kind} shape",
  "canvas.expand": "Expand",
  "canvas.collapse": "Collapse",

  // Status-bar counts. These were `{n} topic{n === 1 ? "" : "s"}` — a hand-rolled English plural,
  // which is precisely the shape i18n/registry.ts calls out as the reason plural messages exist:
  // English needs two forms, Slavic four, Arabic six, and a ternary can only ever express two.
  "canvas.topicCount": { one: "{n} topic", other: "{n} topics" },
  "canvas.selectedCount": { one: "{n} selected", other: "{n} selected" },
  "canvas.arrowheadsNamed": "Arrowheads: {arrow}",
  "canvas.addMarkerNamed": "Add marker {marker}",
  "canvas.removeMarkerNamed": "Remove marker {marker}",
  // Inline rich-text toolbar (shown while editing a topic)
  "canvas.format.bold": "Bold (Ctrl/⌘+B)",
  "canvas.format.italic": "Italic (Ctrl/⌘+I)",
  "canvas.format.underline": "Underline (Ctrl/⌘+U)",
  "canvas.format.textColour": "Text colour {colour}",

  // Node affordances
  "canvas.node.relateGrip": "Drag onto another topic to link them",
  "canvas.node.wrapGrip": "Drag to set the topic's text-wrap width",
  "canvas.node.showNote": "Show note",
  "canvas.node.positionLocked": "Position locked — right-click to unlock",
  "canvas.node.positionLockedShort": "Position locked",
  "canvas.node.rollUpSource": "Roll-up source",
  "canvas.node.addChild": "Add child (Tab)",
  "canvas.node.addSibling": "Add sibling (Enter)",
  "canvas.node.wrapWidth": "Wrap width: {width}. Drag or use arrow keys to change.",
  "canvas.node.editTopic": "Edit topic",
  "canvas.node.editTopicNamed": "Edit topic: {topic}",
  "canvas.node.followLink": "Follow link: {url}",
  "canvas.node.rollUpMirrors": 'Roll-up: mirrors "{title}" — Refresh roll-ups to pull the latest',
  "canvas.node.rollUpMirrorsUnknown":
    "Roll-up: this topic mirrors another map — Refresh roll-ups to pull the latest",
  // The collapsed-branch peek footer. Plural-formed even though English needs one wording for both
  // categories, because a locale that inflects "more" needs somewhere to put the second form.
  "canvas.node.moreChildren": { one: "…({n} more)", other: "…({n} more)" },

  // One-time coaches shown on hover until the user has done the thing once. The mouse and touch
  // wordings are separate messages, not one string with a device word swapped — a locale may name the
  // gesture differently in each, and CSS picks which span is visible.
  "canvas.coach.editMouse": "Double-click or F2 to edit",
  "canvas.coach.editTouch": "Double-tap to edit",
  "canvas.coach.relate": "Drag the dot onto another topic to link",

  // On-canvas menus raised from the editor
  "canvas.menu.insertCommand": "Insert command",
  "canvas.menu.linkToTopic": "Link to a topic",

  // --- FlowMindMap ---------------------------------------------------------------------------------
  // The canvas itself: its accessible region name, the transient hints it raises, and the three
  // right-click menus (relationship, topic, empty pane) plus the shape toolbar.
  //
  // A handful of FlowMindMap's labels are NOT here: where the English matched a message the eager
  // catalogue already had for the same control, the call site references that key instead — the
  // per-branch layout override offers the same layouts as the map-wide picker, so `cmd.layout.right`
  // and friends are shared rather than duplicated. Referencing an eager key from this lazy chunk costs
  // only the key string; the core catalogue is always loaded before the canvas is.

  "canvas.region.label": "Mind map: {title}",
  "canvas.region.untitledMap": "Untitled",

  // Transient hints. The two "Linking —" wordings differ because one path is reachable by pointer and
  // the other only by keyboard, and each names the gestures that actually work there.
  "canvas.hint.rootUndeletable": "The central topic can't be deleted.",
  "canvas.hint.linkingKeyboard": "Linking — arrow to a target, Enter to link, Esc to cancel.",
  "canvas.hint.linkingPointer":
    "Linking — click or arrow to a target, Enter to link, Esc to cancel.",
  "canvas.hint.selectToDuplicate": "Select a topic to duplicate (not the central one).",
  "canvas.hint.branchDuplicated": "Branch duplicated.",
  "canvas.hint.nothingToPaste": "Nothing to paste — copy a branch first (Ctrl/⌘+C).",
  // Plural rather than a `=== 1` ternary at the call site: English needs two forms, Slavic four, and
  // `Intl.PluralRules` picks the arm from `n` without the call site knowing the locale's boundaries.
  "canvas.hint.branchCopied": {
    one: "Branch copied — paste with Ctrl/⌘+Shift+V.",
    other: "{n} branches copied — paste with Ctrl/⌘+Shift+V.",
  },
  "canvas.hint.branchPasted": {
    one: "Branch pasted under the selection.",
    other: "{n} branches pasted under the selection.",
  },

  // Relationship (edge) menu
  "canvas.link.editLabel": "Edit label",
  "canvas.link.arrowheads": "Arrowheads",
  "canvas.link.line": "Line",
  "canvas.link.lineStyle": "Line style: {style}",
  "canvas.link.typeNamed": "Relationship type: {type}",

  // Topic context menu
  "canvas.menu.addChild": "Add child",
  "canvas.menu.addSibling": "Add sibling",
  "canvas.menu.addNote": "Add note",
  "canvas.menu.linkTo": "Link to…",
  "canvas.menu.addCallout": "Add callout",
  "canvas.menu.groupInBoundary": "Group in boundary",
  "canvas.menu.summarizeBranch": "Summarize branch",
  "canvas.menu.copyBranch": "Copy branch",
  "canvas.menu.exportBranch": "Export this branch…",
  "canvas.menu.pasteBranches": {
    one: "Paste branch here",
    other: "Paste {n} branches here",
  },
  "canvas.menu.collapseExpand": "Collapse / expand",
  "canvas.menu.lockPosition": "Lock position",
  "canvas.menu.unlockPosition": "Unlock position",
  "canvas.menu.reattach": "Re-attach to centre",
  "canvas.menu.detach": "Detach to floating topic",

  // Date shifting. The preset chips are messages too — a locale may not abbreviate day/week/month the
  // way English does — and the aria-label is plural-formed so "by 1 day" doesn't read "by 1 days".
  "canvas.menu.shiftDates": "Shift task dates (this branch)",
  "canvas.menu.shiftMinus1w": "−1w",
  "canvas.menu.shiftMinus1d": "−1d",
  "canvas.menu.shift1d": "+1d",
  "canvas.menu.shift1w": "+1w",
  "canvas.menu.shift1mo": "+1mo",
  "canvas.menu.shiftDatesBy": {
    one: "Shift this branch's task dates by {n} day",
    other: "Shift this branch's task dates by {n} days",
  },

  // Per-branch layout override and side pinning
  "canvas.menu.branchLayout": "Branch layout",
  "canvas.branchLayout.default": "Default (map)",
  "canvas.branchLayout.radial": "Radial",
  "canvas.branchLayout.brace": "Brace",
  "canvas.menu.mapSide": "Map side",
  "canvas.branchSide.auto": "Auto (balance)",
  "canvas.branchSide.left": "Left side",
  "canvas.branchSide.right": "Right side",

  // Branch styling
  "canvas.menu.branchColourNamed": "Branch colour {colour}",
  "canvas.menu.branchLine": "Branch line",

  // Roll-up (mirror another map) has NO keys here on purpose — the topic menu and the toolbar's Insert
  // menu offer the same three controls, so this file references `toolbar.rollUpMirrorAnotherMap`,
  // `toolbar.bindSourceMap` and `toolbar.bindRollUpSource` instead. A duplicate-text test enforces it.

  // Empty-pane menu
  "canvas.pane.addTopic": "Add topic here",
  "canvas.pane.fitToView": "Fit to view",
  "canvas.pane.resetZoom": "Reset zoom (100%)",

  // Canvas-shape toolbar
  "canvas.shape.recolour": "Recolour",
  // Trailing space is deliberate: the label reads "New tag: #foo", with the `#tag` in its own span.
  "canvas.slash.newTagPrefix": "New tag: ",
  // Context-menu accessible names, and the chip labels prettier wrapped onto their own lines.
  "canvas.menu.relationshipActions": "Relationship actions",
  "canvas.menu.topicActions": "Topic actions",
  "canvas.menu.canvasActions": "Canvas actions",
  "canvas.menu.overlayActions": "Overlay actions",
  // One concept — "reset to the default colour" — shared by the branch-colour and shape-recolour
  // chips. They were two keys until the duplicate check refused them.
  "canvas.hint.clickTargetToLink": "Click a target node to draw a relationship · Esc to cancel",
  // --- the rest of the canvas chunk -----------------------------------------------------------------
  // CanvasOverlays, BulkNodeMenu, ShapeLayer, NodePopover, CrosslinkEdge, slashCommands. All in the
  // lazy FlowMindMap chunk, so these cost the entry bundle nothing.
  "canvas.switchView": "Switch view",
  "canvas.zoomToFitTheSelection": "Zoom to fit the selection",
  "canvas.hideMinimap": "Hide minimap",
  "canvas.showMinimap": "Show minimap",
  "canvas.minimap": "Minimap ▾",
  "canvas.minimap2": "Minimap ▴",
  "canvas.startYourMap": "Start your map",
  "canvas.groupInABoundary": "Group in a boundary",
  "canvas.clearPriorityOnTheSelection": "Clear priority on the selection",
  "canvas.defaultBranchColourOnThe": "Default branch colour on the selection",
  "canvas.deleteShape": "Delete shape",
  "canvas.matrix": "Matrix",
  "canvas.moreActions": "More actions",
  "canvas.openNote": "Open note",
  "canvas.cyclePriority": "Cycle priority",
  "canvas.addPriority": "Add priority",
  "canvas.dragToReshapeTheRelationship": "Drag to reshape the relationship",
  "canvas.reshapeRelationship": "Reshape relationship",
  "canvas.label": "label…",
  "canvas.addChildTopic": "Add child topic",
  "canvas.addSiblingTopic": "Add sibling topic",
  "canvas.markAsToDo": "Mark as to-do",
  "canvas.markAsDone": "Mark as done",
  "canvas.dueToday": "Due today",
  "canvas.highPriority": "High priority",
  "canvas.addANote": "Add a note",
  "canvas.starMarker": "Star marker",
  // Interpolated canvas labels. Plural where a count drives the wording.
  "canvas.switchToView": "Switch to {view} view",
  "canvas.bulk.deleteTopics": { one: "Delete {n} topic", other: "Delete {n} topics" },
  "canvas.bulk.toggleMarker": "Toggle marker {marker} on the selection",
  "canvas.bulk.setPriority": "Set priority {level} on the selection",
  "canvas.bulk.branchColour": "Branch colour {colour} on the selection",
  "canvas.shapeColour": "Shape colour {colour}",

  // Empty-map coachmark. These interleave prose with <kbd> markup, so they are rendered through
  // `tNodes` (i18n/nodes.tsx) rather than `t` — one message per sentence, with the key names as
  // placeholders the translator can move anywhere. The key names themselves stay literal in the JSX:
  // `Tab` and `Enter` denote physical keys and a locale does not rename them.
  "canvas.coach.editKeys":
    "Press {child} for a child · {sibling} for a sibling · double-click to rename",
  "canvas.coach.multiSelect": "{shift}-drag the canvas to select several topics",
  "canvas.coach.touchKeys": "Tap {add} on a topic to add a child · double-tap a topic to rename",

  // Drag-to-reparent label. Was hardcoded and invisible to the guard — no detector matches JSX text
  // that is broken up by an interpolation — and the component shadowed `t` with a local, so migrating
  // it needed the rename above.
  "canvas.makeChildOf": "↳ Make child of “{topic}”",
} as const satisfies Catalogue;

export type CanvasKey = keyof typeof CANVAS_EN;

registerMessages("en", CANVAS_EN);
