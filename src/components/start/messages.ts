import { type Catalogue, registerMessages } from "../../i18n/registry";

// English messages for the START SCREEN — the library, capture card, template/example galleries,
// sidebar, map cards and the map dialogs.
//
// Chunk-local, like the canvas catalogue. The whole Start screen is a lazy chunk (`StartScreen-*.js`),
// so these strings cost the entry bundle nothing; putting them in `i18n/core.ts` would move every one
// of them onto the initial-load path that `scripts/size-budget.mjs` caps.
//
// Imports `registerMessages` from `../../i18n/registry`, NOT the `../../i18n` barrel — the barrel pulls
// in the eager core catalogue, which would defeat the arrangement. Registration happens on import, so
// the messages arrive exactly when the Start screen does.
//
// Strings whose English already existed elsewhere are NOT duplicated here: the call site references the
// existing key instead. A test fails on duplicate text across catalogues, and reuse is also what keeps
// the migration nearly free in bundle terms.

export const START_EN = {
  "start.heroSub":
    "Capture a thought, paste an outline, or open a blank canvas — it all becomes a map you own.",
  "start.moveMapToTrashConfirm":
    "Move “{name}” to the Trash? You can restore it from Trash until you empty it.",
  // Straight ampersand, not the HTML entity: t() returns a plain string React ESCAPES rather than
  // decodes, so "&amp;" captured from JSX source would have shipped to the user literally.
  "start.localAndPrivate":
    "Local & private — runs in your browser, works offline, nothing leaves this device.",
  "start.aboutLocalFirst":
    "{app} is a local-first, offline mind-mapping studio — a self-hosted alternative to MindManager. Your maps live in your browser (IndexedDB) and on disk; there are no accounts, no servers, and no telemetry. Nothing leaves this device.",
  "start.aboutFormats":
    "Format-agnostic: one canonical model, with importers and exporters for MindManager, Markdown, OPML, FreeMind, Mermaid, XMind and more — so your work is never locked in. Install it as a PWA to use it fully offline.",
  "start.readAndReference": "Read & reference",
  "start.referenceBlurb":
    "The companion book Thinking in Maps, the user guide, and more — each opens in a new tab.",
  "start.updateBlurb":
    "Installed as a PWA, iThread updates itself; check here to pull a new version now.",

  "start.startYourOwn": "Start your own",
  "start.examplesExplain": {
    one: "Complete, worked maps — open one to explore, then make it your own. The same set as the editor's New-map gallery. {n} example.",
    other:
      "Complete, worked maps — open one to explore, then make it your own. The same set as the editor's New-map gallery. {n} examples.",
  },
  "start.noExamplesMatch": 'No examples match "{query}".',
  "start.viewWord": "view",
  "start.layoutExplain":
    "A layout is a {view} you can switch any time from the toolbar — your topics don't move. Open a blank map in one to start.",
  "start.create": "Create",
  "start.thinkingInMapsExplain":
    "{book} is the companion book: the why and how of mapping, worked examples, and every feature in context.",
  "start.noTemplatesMatch": 'No templates match "{query}".',
  "start.emptyTrashCount": "Empty Trash ({n})",
  "start.unpin": "Unpin",

  "start.cmdkForAnyCommand": "⌘K for any command",
  "start.readPdf": "Read (PDF)",
  "start.readEpub": "Read (EPUB)",
  "start.moveNamedTo": "Move “{name}” to…",
  "start.topLevelNoFolder": "Top level (no folder)",
  "start.openTheCommandPalette": "Open the command palette",
  "start.pressCtrlKAnywhereTo": "Press Ctrl/⌘ + K anywhere to search and run any action.",
  "start.rightClickATopic": "Right-click a topic",
  "start.openTheContextMenuFor": "Open the context menu for markers, priority, colour and more.",
  "start.dragATopicSDot": "Drag a topic's dot to relate",
  "start.pullFromANodeS": "Pull from a node's side grip onto another to draw a relationship.",
  "start.exportToPowerpointPdf": "Export to PowerPoint / PDF",
  "start.shareAMapAsPptx": "Share a map as .pptx, PDF, PNG or SVG from the Export menu.",
  "start.learnTheApp": "Learn the app",
  "start.fourShortcutsThatMakeThe": "Four shortcuts that make the editor faster.",
  "start.eGLaunchPlanFor": "e.g. Launch plan for Q3",
  "start.organizeMyResearch": "Organize my research",
  "start.mapTheNewOnboarding": "Map the new onboarding",
  "start.pasteAnOutlineIndentationOr":
    "Paste an outline — indentation or # levels set the hierarchy:\\n\\n# Launch\\n  Product\\n    Beta\\n  Marketing",
  "start.twoSided": "Two-sided",
  "start.orgChart": "Org chart",
  "start.typeATopic": "Type a topic",
  "start.pasteAnOutline": "Paste an outline",
  "start.blankCanvas": "Blank canvas",
  "start.growTheMap": "Grow the map",
  "start.turnIntoAMap": "Turn into a map",
  "start.openCanvas": "Open canvas",
  "start.localFirstMindMapping": "Local-first mind mapping",
  "start.whatSOnYourMind": "What's on your mind?",
  "start.try": "Try",
  "start.searchMapsAndCommands": "Search maps and commands…",
  "start.newBlankMap": "New blank map",
  "start.importAFile": "Import a file",
  "start.browseTemplates": "Browse templates",
  "start.browseExamples": "Browse examples",
  "start.browseLayouts": "Browse layouts",
  "start.learnMindMapping": "Learn mind mapping",
  "start.pinned": "Pinned",
  "start.mapActions": "Map actions",
  "start.pinToTop": "Pin to top",
  "start.open": "Open",
  "start.duplicate": "Duplicate",
  "start.moveToFolder": "Move to folder…",
  "start.export": "Export…",
  "start.renameMap": "Rename map",
  "start.mapName": "Map name",
  "start.newMapName": "New map name",
  "start.moveToTrash": "Move to Trash",
  "start.moveMapToTrash": "Move map to Trash",
  "start.searchAndCommands": "Search and commands",
  "start.ctrlK": "Ctrl K",
  "start.searchCommands": "Search & commands",
  "start.dismiss": "Dismiss",
  "start.captureAThoughtBelowThen":
    "Capture a thought below, then tap ＋ on a topic to grow it — pinch to zoom.",
  "start.captureAThoughtBelowThen2":
    "Capture a thought below, then press Tab to add topics and ⌘K for anything.",
  "start.viewAllMaps": "View all maps →",
  "start.browseAllTemplates": "Browse all templates →",
  "start.browseAllExamples": "Browse all examples →",
  "start.newHere": "New here?",
  "start.pickUpWhereYouLeft": "Pick up where you left off",
  "start.startFromATemplate": "Start from a template",
  "start.orOpenAWorkedExample": "Or open a worked example",
  "start.startSections": "Start sections",
  "start.sectionsMenu": "Sections menu",
  "start.closeSectionsMenu": "Close sections menu",
  "start.start": "Start",
  "start.layouts": "Layouts",
  "start.import": "Import",
  "start.about": "About",
  "start.trash": "Trash",
  "start.bookThinkingInMapsPdf": "Book — Thinking in Maps (PDF)",
  "start.bookThinkingInMapsEpub": "Book — Thinking in Maps (EPUB)",
  "start.updates": "Updates",
  "start.openSourceAndASibling": "Open-source, and a sibling to TP Studio and MECE Studio.",
  "start.thinkingInMaps": "Thinking in Maps",
  "start.softwareApacheLicense20": "Software — Apache License 2.0 · Book & docs — CC BY-NC 4.0",
  "start.searchYourMaps": "Search your maps…",
  "start.searchYourMaps2": "Search your maps",
  "start.sortMaps": "Sort maps",
  "start.folderName": "Folder name",
  "start.noMapsHereYetMove": "No maps here yet — move one in from its ⋯ menu.",
  "start.renameFolder": "Rename folder",
  "start.newFolder": "New folder",
  "start.deleteFolder": "Delete folder",
  "start.newFolder2": "＋ New folder",
  "start.newFolderMoveHere": "＋ New folder & move here",
  "start.recentlyEdited": "Recently edited",
  "start.nameAZ": "Name A–Z",
  "start.mostNodes": "Most nodes",
  "start.browseTemplates2": "Browse templates →",
  "start.noMapsYetStartFresh": "No maps yet — start fresh, or open a template.",
  "start.searchExamples": "Search examples…",
  "start.oneFileOpensAsA": "One file opens as a map · multiple import into the library",
  "start.supportedFormats": "Supported formats",
  "start.dropAFileHereOr": "Drop a file here, or click to browse",
  "start.allRight": "All right",
  "start.allLeft": "All left",
  "start.onion": "Onion",
  "start.funnel": "Funnel",
  "start.venn2": "Venn (2)",
  "start.venn3": "Venn (3)",
  "start.structuralLayouts": "Structural layouts",
  "start.diagramBackdrops": "Diagram backdrops",
  "start.aGeometricFrameBehindFree": "A geometric frame behind free-positioned topics.",
  "start.startCentral": "Start central",
  "start.putTheSubjectInThe":
    "Put the subject in the middle and grow outward — the centre keeps everything anchored to one idea.",
  "start.oneKeywordPerBranch": "One keyword per branch",
  "start.aSingleWordOrShort":
    "A single word or short phrase per node. It's faster to scan and forces you to distil the thought.",
  "start.radialHierarchy": "Radial hierarchy",
  "start.mainBranchesNearTheCentre":
    "Main branches near the centre, detail further out. Distance from the centre = level of detail.",
  "start.colourByTheme": "Colour by theme",
  "start.giveEachMainBranchIts":
    "Give each main branch its own colour so the eye groups related ideas at a glance.",
  "start.crossLinks": "Cross-links",
  "start.drawARelationshipArrowBetween":
    "Draw a relationship arrow between branches that connect — maps aren't only trees.",
  "start.captureThenTidy": "Capture, then tidy",
  "start.getEverythingDownFirstRearrange":
    "Get everything down first; rearrange, group, and prune afterwards. Don't edit while you brainstorm.",
  "start.aFewPrinciplesThatMake":
    "A few principles that make maps clearer and faster to think with.",
  "start.goDeeperTheBook": "Go deeper — the book",
  // Recent's date buckets. These are LABELS ONLY — `Recent.tsx` groups on stable ids, never on the
  // rendered text. It used to group on the text, which meant a translated label could no longer match
  // the English one `groupOf()` returned, and the whole bucket (with every map in it) disappeared from
  // the page. Three of the six were already hardcoded English here for the same reason.
  "start.today": "Today",
  "start.yesterday": "Yesterday",
  "start.earlierThisWeek": "Earlier this week",
  "start.thisMonth": "This month",
  "start.older": "Older",
  "start.notYetSaved": "Not yet saved",
  "start.yourMapsNewestFirst": "Your maps, newest first.",
  "start.searchTemplates": "Search templates…",
  "start.deleteForever": "Delete forever",
  "start.trashIsEmpty": "Trash is empty.",
  "start.suggestionLaunch": "Plan a product launch",
  "start.newMapNamed": 'New map: "{name}"',
  "start.openFolder": "Open folder {name}",
  "start.noMapsMatch": "No maps match \u201c{query}\u201d.",
  // Whole paragraphs. One message each, not per line: prettier wrapped them, and rewriting only the
  // flagged tail would leave half a sentence hardcoded.
  "start.importBlurb":
    "Drop a file or pick one — it opens as a new map. Everything is parsed in your browser; nothing is uploaded.",
  "start.trashBlurb":
    "Deleted maps are kept here until you empty the Trash — restore one anytime. Emptying is permanent (it also drops the map's version history).",
  "start.templatesBlurb": {
    one: "Every starter map from the New-map gallery. Pick one and it opens pre-filled — unlike a layout, which is an empty view. {n} template · Blank canvas lives in the Start screen.",
    other:
      "Every starter map from the New-map gallery. Pick one and it opens pre-filled — unlike a layout, which is an empty view. {n} templates · Blank canvas lives in the Start screen.",
  },

  // Interleaves prose with <kbd> markup, so it renders through `tNodes` (i18n/nodes.tsx) as one
  // message rather than three fragments a translator cannot reorder.
  "start.keyboardFirst":
    "Keyboard-first: {sibling} adds a sibling, {child} adds a child. Pick a starting layout (you can switch it any time):",
} as const satisfies Catalogue;

export type StartKey = keyof typeof START_EN;

registerMessages("en", START_EN);
